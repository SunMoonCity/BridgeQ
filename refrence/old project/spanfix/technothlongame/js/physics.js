// physics.js
// Owns: the Matter.js engine/world, converting Piece objects into real
// physics bodies/constraints, material-property mapping, break detection,
// and generic load bodies. Does NOT know about cars, traffic, stages, or
// scoring -- that orchestration lives entirely in loadtest.js.

// -----------------------------------------------------------------------
// Module state
// -----------------------------------------------------------------------
let engine = null;
let world = null;
let jointCache = new Map();   // "x,y" key -> Matter.js body, shared across pieces
let storedCliffs = [];
let storedGround = { y: 0, xMin: 0, xMax: 0 };

// -----------------------------------------------------------------------
// A. Engine + world setup
// gravity.y is NEGATIVE because our coordinate system treats increasing
// y as UP (cliffs are above ground) -- Matter.js gravity is just a raw
// vector, so it must pull toward decreasing y to feel like "down" here.
// -----------------------------------------------------------------------
function createEngine() {
  const eng = Matter.Engine.create();
  eng.gravity.y = -1;
  return eng;
}

// -----------------------------------------------------------------------
// B. Ground as a real, solid physics body (not just an abstract range)
//
// FIX (collision): collisionFilter.group = -1 means this body will NEVER
// collide with any other body that also has group -1 (all our structure
// bodies below share this same group). This does NOT disable collision
// with cars -- addLoadBody() deliberately leaves cars at the default
// group (0), so car-vs-structure collision is untouched. This only
// silences the non-physical joint-vs-joint / ground-vs-joint overlap
// that comes from using overlapping circles as a joint convenience.
// See project testing session notes: confirmed via isolation test that,
// without this, 21 overlapping road-point circles produce up to ~37
// units of pure collision-correction drift with zero constraints.
// -----------------------------------------------------------------------
function createGroundBody(ground) {
  const width = ground.xMax - ground.xMin;
  const centerX = (ground.xMin + ground.xMax) / 2;
  const thickness = 2;
  // Body sits BELOW the ground line (more negative y), so its top
  // surface is exactly at ground.y -- solid ground for anything above it.
  const body = Matter.Bodies.rectangle(centerX, ground.y - thickness / 2, width, thickness, {
    isStatic: true,
    collisionFilter: { group: -1 }
  });
  Matter.World.add(world, body);
  return body;
}

// Shared with createCliffBodies below -- the cliff anchor circle's
// radius. Pulled into one constant so the platform's landing height
// (top of circle) can never silently drift out of sync with the
// circle's actual size if this number is ever changed.
const CLIFF_RADIUS = 4;

// -----------------------------------------------------------------------
// C. Cliff bodies -- static anchors, registered into the joint cache too,
// so pieces attaching to a cliff automatically reuse this exact body.
// FIX (collision): same collisionFilter.group = -1 as ground/joints.
//
// NEW: each cliff also gets a flat rectangular PLATFORM alongside its
// small anchor circle -- a real landing surface for cars, instead of a
// tiny 4-radius circle. The platform extends OUTWARD only (away from the
// bridge span, off the far side of each cliff) -- e.g. left of the left
// cliff, right of the right cliff -- so it never overlaps the bridge
// itself. Its INNER edge sits exactly at cliff.x.
//
// HEIGHT: the platform's TOP surface is set to match the TOP of the
// cliff circle (cliff.y + CLIFF_RADIUS), not cliff.y itself -- so a car
// landing on the platform sits level with the highest point of the
// cliff anchor, not floating above or sinking below it.
//
// PER-ROUND: this reads cliff.y directly from whatever `cliffs` array is
// passed into initWorld() -- which comes from round-config.js's per-round
// cliff data (e.g. Round 3's different cliff heights). No cliff height
// is hardcoded here, so the platform automatically follows whatever
// round-config.js provides, same as the circle already does.
//
// The circle is UNCHANGED and still owns the joint cache entry -- pieces
// still attach to it exactly as before. The platform is purely an added
// landing surface, not a joint.
// -----------------------------------------------------------------------
function createCliffPlatform(cliff, direction, width = 8) {
  const thickness = 2;
  const topY = cliff.y + CLIFF_RADIUS; // top of the cliff circle
  // Inner edge at cliff.x, extending `width` units OUTWARD (away from
  // the span) in the given direction. Center sits half a width out.
  const centerX = cliff.x + direction * (width / 2);
  const body = Matter.Bodies.rectangle(
    centerX, topY - thickness / 2, width, thickness,
    { isStatic: true, collisionFilter: { group: -1 } }
  );
  Matter.World.add(world, body);
  return body;
}

function createCliffBodies(cliffs) {
  // Figure out which cliff is "leftmost" vs "rightmost" so each platform
  // extends away from the span, not into it.
  const minX = Math.min(...cliffs.map(c => c.x));
  const maxX = Math.max(...cliffs.map(c => c.x));

  return cliffs.map(cliff => {
    const body = Matter.Bodies.circle(cliff.x, cliff.y, CLIFF_RADIUS, {
      isStatic: true,
      collisionFilter: { group: -1 }
    });
    Matter.World.add(world, body);
    jointCache.set(pointKey({ x: cliff.x, y: cliff.y }), body);

    // Leftmost cliff -> platform extends further LEFT (direction -1).
    // Rightmost cliff -> platform extends further RIGHT (direction +1).
    // (If only one cliff, or cliffs share the same x, defaults to -1.)
    const direction = cliff.x === maxX && maxX !== minX ? 1 : -1;
    createCliffPlatform(cliff, direction); // NEW -- solid landing surface

    return body;
  });
}

// -----------------------------------------------------------------------
// D. Shared joint cache -- ensures pieces touching the same point reuse
// the SAME body, so force actually transmits between connected pieces.
// -----------------------------------------------------------------------
function pointKey(point, precision = 2) {
  return `${point.x.toFixed(precision)},${point.y.toFixed(precision)}`;
}

// FIX (collision): same collisionFilter.group = -1 as ground/cliffs, so
// adjacent road/pillar joint points (spaced 0.5 apart, radius 3, hence
// ~5.5 units of geometric overlap by design) don't fight the solver.
function getOrCreatePointBody(point, isAnchor) {
  const key = pointKey(point);
  if (jointCache.has(key)) return jointCache.get(key);

  const body = Matter.Bodies.circle(point.x, point.y, 3, {
    isStatic: isAnchor,
    collisionFilter: { group: -1 }
  });
  Matter.World.add(world, body);
  jointCache.set(key, body);
  return body;
}

// -----------------------------------------------------------------------
// E. Deciding whether a point should be a static (anchor) or dynamic
// (free) body.
// -----------------------------------------------------------------------
function isAnchorPoint(point, cliffs, ground, tolerance = 0.05) {
  const touchesCliff = cliffs.some(c =>
    Math.abs(c.x - point.x) < tolerance && Math.abs(c.y - point.y) < tolerance
  );
  const touchesGround =
    Math.abs(point.y - ground.y) < tolerance &&
    point.x >= ground.xMin - tolerance &&
    point.x <= ground.xMax + tolerance;

  return touchesCliff || touchesGround;
}

// -----------------------------------------------------------------------
// F. Material properties -> constraint settings
// -----------------------------------------------------------------------
function buildConstraint(bodyA, bodyB, material) {
  const constraint = Matter.Constraint.create({
    bodyA,
    bodyB,
    stiffness: material.elasticity,
    length: Matter.Vector.magnitude(Matter.Vector.sub(bodyA.position, bodyB.position))
  });

  // Matter.js has no native "breaking" concept -- this is our own
  // property, checked manually every tick in checkBreaks().
  constraint.breakThreshold =
    ((material.tensileStrength + material.compressionStrength) / 2) *
    (1 - material.brittleness / 100);

  return constraint;
}

// -----------------------------------------------------------------------
// G. Building ONE piece into the physics world
// -----------------------------------------------------------------------
function buildPiece(piece, materialsLookup) {
  const material = materialsLookup[piece.material];
  let prevBody = null;

  piece.points.forEach(point => {
    const anchor = isAnchorPoint(point, storedCliffs, storedGround);
    const body = getOrCreatePointBody(point, anchor);

    if (prevBody) {
      const constraint = buildConstraint(prevBody, body, material);
      Matter.World.add(world, constraint);
    }
    prevBody = body;
  });
}

// -----------------------------------------------------------------------
// H. Building the WHOLE bridge -- orchestrator
// -----------------------------------------------------------------------
function buildBridge(pieces, materialsLookup) {
  pieces.forEach(piece => buildPiece(piece, materialsLookup));
}

// -----------------------------------------------------------------------
// I. Break detection -- runs every tick, removes over-stressed constraints
// -----------------------------------------------------------------------
function checkBreaks() {
  const broken = [];

  Matter.Composite.allConstraints(world).forEach(c => {
    if (c.breakThreshold === undefined) return; // not one of our piece constraints

    const currentLength = Matter.Vector.magnitude(
      Matter.Vector.sub(c.bodyA.position, c.bodyB.position)
    );
    const stretch = currentLength - c.length;

    if (stretch > c.breakThreshold) {
      Matter.World.remove(world, c);
      broken.push(c);
    }
  });

  return broken;
}

// -----------------------------------------------------------------------
// J. Generic load body -- no knowledge of "cars" or "stages"
// Deliberately NOT given a collisionFilter -- stays at Matter's default
// group (0), so it collides normally with the structure (ground,
// cliffs, road/pillar joints). Only structure-vs-structure collision is
// silenced (see Sections B/C/D above); structure-vs-load stays real.
// -----------------------------------------------------------------------
function addLoadBody(x, y, weight) {
  const body = Matter.Bodies.circle(x, y, 5, { density: weight / 100 });
  Matter.World.add(world, body);
  return body;
}

// -----------------------------------------------------------------------
// K. Step function -- advances the simulation, returns whatever broke
// -----------------------------------------------------------------------
function step(deltaMs = 1000 / 60) {
  Matter.Engine.update(engine, deltaMs);
  return checkBreaks();
}

// -----------------------------------------------------------------------
// L. Remove a body from the world -- used by loadtest.js to clean up cars
// once they've finished crossing, so the world doesn't accumulate
// indefinitely over a long test run.
// -----------------------------------------------------------------------
function removeBody(body) {
  Matter.World.remove(world, body);
}

// -----------------------------------------------------------------------
// Setup entry point -- call this once per round, before building anything
// -----------------------------------------------------------------------
function initWorld(cliffs, ground) {
  engine = createEngine();
  world = engine.world;
  jointCache = new Map();
  storedCliffs = cliffs;
  storedGround = ground;

  createGroundBody(ground);
  createCliffBodies(cliffs);
}

// -----------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------
export {
  initWorld,
  buildBridge,
  addLoadBody,
  step,
  removeBody
};