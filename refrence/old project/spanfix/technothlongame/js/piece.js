// piece.js
// Owns: creating valid Piece objects (with unique IDs), tracking which
// pieces are currently part of the connected structure vs. "hanging"
// (disconnected but not yet purged), and all connection-set logic.

// -----------------------------------------------------------------------
// B. Turn the equation string into a callable function
// -----------------------------------------------------------------------
function parseEquation(equationText, inputVarName = 'x') {
  try {
    return new Function(inputVarName, 'return ' + equationText + ';');
  } catch (err) {
    return null;
  }
}

// -----------------------------------------------------------------------
// C. Sample the function into discrete points across [rangeMin, rangeMax]
// -----------------------------------------------------------------------
function samplePoints(f, rangeMin, rangeMax, orientation, resolution = 0.5) {
  const points = [];
  for (let t = rangeMin; t <= rangeMax; t += resolution) {
    const output = f(t);
    if (!isFinite(output)) return null;

    points.push(
      orientation === 'x-of-y' ? { x: output, y: t } : { x: t, y: output }
    );
  }
  return points;
}

// -----------------------------------------------------------------------
// D. Validate the range itself
// -----------------------------------------------------------------------
function isValidRange(rangeMin, rangeMax) {
  return typeof rangeMin === 'number' && typeof rangeMax === 'number' && rangeMin < rangeMax;
}

// -----------------------------------------------------------------------
// E. Factory function — now assigns a unique id to every piece
// -----------------------------------------------------------------------
let pieceIdCounter = 0;

function createPiece(equationText, rangeMin, rangeMax, materialName, orientation = 'y-of-x') {
  if (!isValidRange(rangeMin, rangeMax)) {
    return { error: 'Invalid range: min must be less than max' };
  }

  const inputVarName = orientation === 'x-of-y' ? 'y' : 'x';
  const f = parseEquation(equationText, inputVarName);
  if (!f) {
    return { error: 'Invalid equation syntax' };
  }

  const points = samplePoints(f, rangeMin, rangeMax, orientation);
  if (!points) {
    return { error: 'Equation is undefined somewhere in this range' };
  }

  return {
    id: ++pieceIdCounter,
    equation: equationText,
    orientation,
    rangeMin,
    rangeMax,
    material: materialName,
    points
  };
}

// -----------------------------------------------------------------------
// F. Connection-set state and checks
// -----------------------------------------------------------------------
let allPieces = [];       // pieces currently part of the valid structure
let hangingPieces = [];   // pieces temporarily disconnected, awaiting one more chance
let connectedPoints = [];
let cliffSeedPoints = []; // kept separately so we can rebuild from scratch cleanly
let groundConfig = { y: 0, xMin: 0, xMax: 0 };

function initRound(cliffPoints, ground) {
  allPieces = [];
  hangingPieces = [];
  cliffSeedPoints = [...cliffPoints];
  connectedPoints = [...cliffPoints];
  groundConfig = ground;
  pieceIdCounter = 0;
}

function pointMatches(p1, p2, tolerance = 0.01) {
  return Math.abs(p1.x - p2.x) < tolerance && Math.abs(p1.y - p2.y) < tolerance;
}

function isOnGround(point, tolerance = 0.01) {
  return (
    Math.abs(point.y - groundConfig.y) < tolerance &&
    point.x >= groundConfig.xMin - tolerance &&
    point.x <= groundConfig.xMax + tolerance
  );
}

function connectsToStructure(piece) {
  return piece.points.some(point =>
    connectedPoints.some(cp => pointMatches(point, cp)) || isOnGround(point)
  );
}

function registerPiece(piece) {
  allPieces.push(piece);
  connectedPoints.push(...piece.points);
}

// Adds a piece directly to hangingPieces, no connectivity check —
// used when a piece has already been confirmed to NOT connect on creation.
function addHanging(piece) {
  hangingPieces.push(piece);
}

function getAllPieces() {
  return allPieces;
}

function getHangingPieces() {
  return hangingPieces;
}

// -----------------------------------------------------------------------
// G. Deleting a registered piece — rebuilds the whole structure from
// scratch using the remaining pieces (in original order), since deleting
// a piece from the middle can invalidate pieces that depended on it.
// Anything that fails to reconnect during rebuild becomes "hanging".
// -----------------------------------------------------------------------
function deletePieceById(id) {
  const idx = allPieces.findIndex(p => p.id === id);
  if (idx === -1) return null; // not a currently-registered piece

  const removed = allPieces[idx];
  const remaining = allPieces.filter(p => p.id !== id);

  // Reset and replay every remaining piece in its original order.
  allPieces = [];
  connectedPoints = [...cliffSeedPoints];
  const newlyHanging = [];

  remaining.forEach(piece => {
    if (connectsToStructure(piece)) {
      registerPiece(piece);
    } else {
      newlyHanging.push(piece);
    }
  });

  hangingPieces.push(...newlyHanging);

  return { removed, newlyHanging };
}

// -----------------------------------------------------------------------
// H. After a new piece is placed, give every hanging piece one chance to
// reconnect against the now-larger structure.
// -----------------------------------------------------------------------
function recheckHangingPieces() {
  const stillHanging = [];
  const reconnected = [];

  hangingPieces.forEach(piece => {
    if (connectsToStructure(piece)) {
      registerPiece(piece);
      reconnected.push(piece);
    } else {
      stillHanging.push(piece);
    }
  });

  hangingPieces = stillHanging;
  return { reconnected, stillHanging };
}

// -----------------------------------------------------------------------
// I. Permanently remove pieces that failed their one-chance recheck.
// -----------------------------------------------------------------------
function purgeHanging(ids) {
  hangingPieces = hangingPieces.filter(p => !ids.includes(p.id));
}

// -----------------------------------------------------------------------
// J. Exports
// -----------------------------------------------------------------------
export {
  createPiece,
  connectsToStructure,
  registerPiece,
  addHanging,
  initRound,
  getAllPieces,
  getHangingPieces,
  deletePieceById,
  recheckHangingPieces,
  purgeHanging
};