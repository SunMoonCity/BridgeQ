// loadtest.js
// Owns: the "traffic-style" staged car testing described in Section 4 of
// the project context. Orchestrates physics.js's initWorld/buildBridge/
// addLoadBody/step to drive a sequence of cars across the built bridge,
// stage by stage, with increasing difficulty, and reports how many
// stages were passed before failure (or all stages, if none failed).
//
// Does NOT know about scoring, budget, or UI — it just runs the test and
// returns a result object. main.js/ui.js turn that result into what the
// player sees.
//
// Depends on physics.js's exports: initWorld, buildBridge, addLoadBody, step.

import { initWorld, buildBridge, addLoadBody, step, removeBody } from './physics.js';

// -----------------------------------------------------------------------
// A. Stage data — this is loadtest.js's own domain (see Section 4.5:
// round-config.js only holds cliffs/ground/budget/buildTime, NOT this).
//
// Each stage: how many cars cross, how heavy each one is, and how far
// apart (in time) they're spawned. Difficulty ramps by INCREASING
// carCount and carWeight and DECREASING spawnGapMs (cars closer together
// in time = more of them on the bridge at once = harder).
//
// speed and carSpacingPx (fallback list edited by hand) are placeholders —
// this is a game, not a physics sim, so these numbers are tuned by
// playtesting, not derived from anything. Marked as "later polish" below.
// -----------------------------------------------------------------------
const STAGES = [
  { carCount: 2, carWeight: 40,  spawnGapMs: 1200 },
  { carCount: 3, carWeight: 60,  spawnGapMs: 900 },
  { carCount: 4, carWeight: 85,  spawnGapMs: 700 },
  { carCount: 5, carWeight: 110, spawnGapMs: 500 },
  { carCount: 6, carWeight: 140, spawnGapMs: 350 }
];

// Constant across all stages on purpose — the spec (Section 4.2) only
// calls out car count, weight, and spacing as the difficulty knobs, not
// speed. If playtesting says speed should scale too, that's a change to
// make deliberately, not a side effect of something else.
const CAR_SPEED = 30; // game units per second, horizontal
const STEP_MS = 1000 / 60; // matches physics.js's default tick
const MAX_TICKS_PER_STAGE = 60 * 60; // 60s of sim time safety cap per stage,
// so a car that somehow never reaches the far side (stuck on broken
// geometry, etc.) can't hang the test phase forever. Not a real
// "time limit" in the gameplay sense (Section 4.2 says test phase has
// none) — purely a safety valve against an infinite loop bug.

// How far before the near cliff / how far above the road a car spawns,
// so it does NOT spawn already overlapping the cliff or road bodies
// (overlapping spawn causes Matter.js to violently resolve the overlap
// on the very first tick — a false "break" unrelated to bridge strength).
const SPAWN_OFFSET_X = 2;
const SPAWN_OFFSET_Y =5;

// -----------------------------------------------------------------------
// B. Working out the bridge's span from the cliffs — cars always drive
// from one cliff toward the other, spawned just above the near cliff.
// Round 1 cliffs are the same height (Section 4.3), so y is shared.
// -----------------------------------------------------------------------
function getSpan(cliffs) {
  const [a, b] = cliffs;
  const startCliff = a.x <= b.x ? a : b;
  //start clif is not start
  const endCliff = a.x <= b.x ? b : a;
  return {
    startX: startCliff.x,
    endX: endCliff.x,
    startY: startCliff.y,
    endY: endCliff.y
    // two y for round 3
  };
}

// -----------------------------------------------------------------------
// C. One car = one physics load body + the bookkeeping loadtest.js needs
// that physics.js deliberately doesn't know about (has it finished
// crossing yet).
//
// FIX A: spawns BEFORE the near cliff and ABOVE the road (not exactly on
// top of an existing body), so it approaches/lands naturally instead of
// spawning already overlapping the cliff or road joint bodies.
// -----------------------------------------------------------------------
function spawnCar(span, weight, direction) {
  const spawnX = span.startX - direction * SPAWN_OFFSET_X;
  const spawnY = span.startY + SPAWN_OFFSET_Y;
  const body = addLoadBody(spawnX, spawnY, weight);

  Matter.Body.setVelocity(body, { x: direction * CAR_SPEED / 60, y: 0 });
  return { body, weight, done: false };
}

function hasCrossed(car, span, direction) {
  return direction > 0 ? car.body.position.x >= span.endX && car.body.position.y >= span.endY : car.body.position.x <= span.endX && car.body.position.y >= span.endY ;
}
// y rule


// -----------------------------------------------------------------------
// D. Run ONE stage: stagger-spawn its cars, step the simulation until
// every car has crossed (stage passes) or a break is reported (stage,
// and the whole test, fails immediately — Section 4.2: "Failure = ANY
// part of the bridge breaks... Testing stops IMMEDIATELY").
// -----------------------------------------------------------------------
function runStage(stageConfig, span) {
  const direction = 1; // all cars in Round 1 cross the same way, start->end
  const cars = [];
  let spawnedCount = 0;
  let elapsedMs = 0;
  let nextSpawnAtMs = 0;

  for (let tick = 0; tick < MAX_TICKS_PER_STAGE; tick++) {
// Spawn any car whose turn has come, respecting spawnGapMs spacing.
    if (spawnedCount < stageConfig.carCount && elapsedMs >= nextSpawnAtMs) {
      cars.push(spawnCar(span, stageConfig.carWeight, direction));
      spawnedCount++;
      nextSpawnAtMs = elapsedMs + stageConfig.spawnGapMs;
    }

    // FIX B: re-apply horizontal velocity to every car still in transit,
    // every tick. Matter.js bodies have air/surface friction on by
    // default, which continuously damps velocity — without reapplying
    // this, cars would gradually slow down instead of holding CAR_SPEED,
    // making spacing/timing unpredictable and risking false timeouts.
    // Only x is forced; y is left as whatever gravity/collisions produce,
    // so a car still falls normally if the road under it breaks.
    cars.forEach(car => {
      if (!car.done) {
        Matter.Body.setVelocity(car.body, {
          x: direction * CAR_SPEED / 60,
          y: car.body.velocity.y
        });
      }
    });


    const broken = step(STEP_MS);
    if (broken.length > 0) {
  return { passed: false, reason: 'break' };
}
 
    cars.forEach(car => {
      if (!car.done && hasCrossed(car, span, direction)) {
        car.done = true;
        // FIX C: clean up finished cars instead of leaving them in the
        // world indefinitely — they can no longer affect the bridge once
        // off it, so there's no reason to keep simulating them.
        removeBody(car.body);
      }
    });

    const allSpawned = spawnedCount === stageConfig.carCount;
    const allCrossed = cars.every(car => car.done);
    if (allSpawned && allCrossed) {
      return { passed: true };
    }

    elapsedMs += STEP_MS;
  }

  // Hit the safety cap without finishing or breaking — treat as a fail
  // so a stuck stage can't silently read as a pass. Flagged as a bug to
  // investigate, not an expected gameplay outcome.
  return { passed: false, reason: 'timeout' };
}

// -----------------------------------------------------------------------
// E. Run the WHOLE test phase: build the bridge once, then run stages in
// order until one fails or all of them pass. No cross-stage fatigue
// (Section 4.2) — a broken constraint is already permanently removed by
// physics.js, and surviving constraints carry no extra penalty between
// stages, so we just keep calling step() on the same world.
// -----------------------------------------------------------------------
function runLoadTest(pieces, materialsLookup, cliffs, ground) {
  initWorld(cliffs, ground);
  buildBridge(pieces, materialsLookup);

  const span = getSpan(cliffs);
  let stagesPassed = 0;
  let failed = false;

  for (const stageConfig of STAGES) {
    const result = runStage(stageConfig, span);
    if (!result.passed) {
      failed = true;
      break;
    }
    stagesPassed++;
  }

  // Section 4.4: loadtest.js only reports "stage reached", never a
  // continuous strength value. This return shape is deliberately just
  // enough for scoring (stages passed) + budget/time already tracked
  // elsewhere (budget.js, timer.js) to combine into the final score.
  return {
    stagesPassed,
    totalStages: STAGES.length,
    failed,
    completedAllStages: !failed && stagesPassed === STAGES.length
  };
}

// -----------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------
export {
  STAGES,
  runLoadTest
};