// graph.js
// Owns: the JSXGraph board, drawing cliffs + ground, reading build inputs,
// plotting pieces, tap-to-select + Delete button, the hanging-piece
// recovery flow, the material picker, and charging/refunding budget as
// pieces are placed/deleted. Does NOT decide connection/structure logic
// itself (piece.js), does NOT decide cost math (budget.js), does NOT
// decide material properties (materials.js) -- it only orchestrates
// calls into those and reflects the results in the DOM.
//
// CHANGE FROM PREVIOUS VERSION: this file no longer self-initializes on
// module load. Everything now waits for main.js to call
// initBoardForRound(round) with that round's config. This is what lets
// the same file serve Round 1, 2, and 3 instead of being frozen on
// Round 1's hardcoded cliffs.

import {
  createPiece,
  connectsToStructure,
  registerPiece,
  addHanging,
  initRound,
  deletePieceById,
  recheckHangingPieces,
  purgeHanging
} from './piece.js';

import { getMaterialsList, isValidMaterial, MATERIALS } from './materials.js';
import { chargePiece, refundPiece } from './budget.js';
import { updateHud } from './main.js';

// -----------------------------------------------------------------------
// A. Board initialization -- pan/zoom locked for exam use
// -----------------------------------------------------------------------
function initBoard(containerId, boundingBox) {
  return JXG.JSXGraph.initBoard(containerId, {
    boundingbox: boundingBox,
    axis: true,
    pan: { enabled: false },
    zoom: { enabled: false, wheel: false }
  });
}

// -----------------------------------------------------------------------
// A.1 Bounding box -- NEW. Computed dynamically from the round's own
// cliffs + ground instead of a hardcoded box, so any round's geometry
// (Round 1's 400x600 span, Round 3's uneven cliff heights, or anything
// added later) automatically fits the visible board without needing a
// hand-tuned box per round.
//
// JSXGraph's boundingbox format is [xMin, yMax, xMax, yMin] -- i.e.
// top-left corner then bottom-right corner, NOT [xMin, yMin, xMax, yMax]
// like you might expect. Easy to get backwards, so it's isolated here.
//
// paddingRatio adds breathing room around the geometry (10% of the
// larger span by default) so cliffs/ground don't sit flush against the
// board's edge.
// -----------------------------------------------------------------------
function computeBoundingBox(round, paddingRatio = 0.1) {
  const xs = round.cliffs.map(c => c.x).concat([round.ground.xMin, round.ground.xMax]);
  const ys = round.cliffs.map(c => c.y).concat([round.ground.y]);

  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);

  const spanX = xMax - xMin;
  const spanY = yMax - yMin;
  const padding = Math.max(spanX, spanY) * paddingRatio;

  return [xMin - padding, yMax + padding, xMax + padding, yMin - padding];
}

// -----------------------------------------------------------------------
// B. Drawing cliffs
// -----------------------------------------------------------------------
function drawCliffs(board, cliffData) {
  return cliffData.map(cliff =>
    board.create('point', [cliff.x, cliff.y], { name: cliff.name || '', fixed: true, color: 'red' })
  );
}

// -----------------------------------------------------------------------
// C. Drawing the ground line
// -----------------------------------------------------------------------
function drawGround(board, ground) {
  return board.create('segment', [[ground.xMin, ground.y], [ground.xMax, ground.y]], {
    strokeColor: 'brown', strokeWidth: 3, fixed: true
  });
}

// -----------------------------------------------------------------------
// D. Material picker -- NEW. Reads the round's materialMode to decide
// whether the student gets a choice at all.
//
// 'fixed' (Round 1): dropdown is hidden/disabled, and every piece placed
// this round is silently forced to round.fixedMaterial, regardless of
// whatever the (disabled) dropdown happens to show.
//
// 'choice' (Round 2/3): dropdown is rebuilt from materials.js's live
// list, so if materials.js ever adds/removes an option, this always
// stays in sync without graph.js needing to know the material names.
// -----------------------------------------------------------------------
let currentRound = null; // module-level so getInputValues() can read materialMode/fixedMaterial

function populateMaterialPicker(round) {
  const select = document.getElementById('materialInput');
  if (!select) return;

  select.innerHTML = ''; // clear any previous round's options

  if (round.materialMode === 'fixed') {
    const option = document.createElement('option');
    option.value = round.fixedMaterial;
    option.textContent = round.fixedMaterial;
    select.appendChild(option);
    select.disabled = true;
    return;
  }

  select.disabled = false;
  getMaterialsList().forEach(m => {
    const option = document.createElement('option');
    option.value = m.key;
    option.textContent = `${m.label} (${m.costPerUnit}/unit)`;
    select.appendChild(option);
  });
}

// -----------------------------------------------------------------------
// E. Reading input fields -- materialMode 'fixed' overrides whatever the
// (disabled) dropdown holds, so a stale/disabled select value can never
// leak through as the piece's material.
// -----------------------------------------------------------------------
function getInputValues() {
  const material = currentRound && currentRound.materialMode === 'fixed'
    ? currentRound.fixedMaterial
    : document.getElementById('materialInput').value;

  return {
    equation: document.getElementById('equationInput').value,
    rangeMin: parseFloat(document.getElementById('rangeMin').value),
    rangeMax: parseFloat(document.getElementById('rangeMax').value),
    material,
    orientation: document.getElementById('orientationInput').value
  };
}

// -----------------------------------------------------------------------
// F. Displaying messages to the student
// -----------------------------------------------------------------------
function showMessage(text, isError = false) {
  const el = document.getElementById('messageBox');
  el.textContent = text;
  el.style.color = isError ? 'red' : 'green';
}

// -----------------------------------------------------------------------
// G. Selection state -- tapping a piece SELECTS it and reveals the
// Delete button; it does NOT delete immediately.
// -----------------------------------------------------------------------
let selectedPieceId = null;

function selectPiece(id) {
  selectedPieceId = id;
  document.getElementById('deleteButton').style.display = 'inline-block';
}

function clearSelection() {
  selectedPieceId = null;
  document.getElementById('deleteButton').style.display = 'none';
}

// -----------------------------------------------------------------------
// H. Plotting a piece's curve, wiring tap-to-select onto it
// -----------------------------------------------------------------------
function plotPieceCurve(board, piece) {
  const xs = piece.points.map(p => p.x);
  const ys = piece.points.map(p => p.y);
  const curveObj = board.create('curve', [xs, ys], { strokeColor: 'blue', strokeWidth: 2 });

  curveObj.on('down', () => selectPiece(piece.id));

  return curveObj;
}

// -----------------------------------------------------------------------
// I. id -> curve object -- covers registered AND hanging pieces alike.
// -----------------------------------------------------------------------
const curveMap = new Map();

// -----------------------------------------------------------------------
// J. Actual delete logic -- runs when the Delete button is clicked.
// NEW: refunds the piece's cost via budget.js, in BOTH branches below
// (registered piece and hanging piece) -- this is a STUDENT-INITIATED
// delete, which is the one case budget.js's refundPiece is meant for.
// The auto-purge cleanup in handleNewPiece (section L) does NOT refund --
// that's a confirmed game-design decision (wasted material for not
// reconnecting in time), not plumbing left unfinished.
// -----------------------------------------------------------------------
function handleDeleteClick(board, id) {
  const result = deletePieceById(id);

  if (!result) {
    // Not a registered piece -- it was hanging.
    refundPiece(id);
    updateHud(currentRound);

    purgeHanging([id]);
    const curveObj = curveMap.get(id);
    if (curveObj) board.removeObject(curveObj);
    curveMap.delete(id);
    showMessage('Removed hanging piece. Refunded.', false);
    return;
  }

  refundPiece(id);
  updateHud(currentRound);

  const deletedCurve = curveMap.get(id);
  if (deletedCurve) board.removeObject(deletedCurve);
  curveMap.delete(id);

  if (result.newlyHanging.length > 0) {
    result.newlyHanging.forEach(p => {
      const c = curveMap.get(p.id);
      if (c) c.setAttribute({ strokeColor: 'orange' });
    });
    showMessage(
      `Removed piece. Refunded. ${result.newlyHanging.length} piece(s) are now hanging -- ` +
      `connect them with your next piece, or they will be removed (unrefunded).`,
      true
    );
  } else {
    showMessage('Piece removed. Refunded.', false);
  }
}

// -----------------------------------------------------------------------
// K. Handling a newly plotted piece. Charging already happened earlier
// in handlePlotClick, before this is ever reached -- so by this point
// the piece is guaranteed paid for.
// -----------------------------------------------------------------------
function handleNewPiece(board, piece, curveObj) {
  const connected = connectsToStructure(piece);

  curveMap.set(piece.id, curveObj);

  if (connected) {
    registerPiece(piece);
  }

  const { reconnected, stillHanging } = recheckHangingPieces();

  reconnected.forEach(p => {
    const c = curveMap.get(p.id);
    if (c) c.setAttribute({ strokeColor: 'blue' });
  });

  if (stillHanging.length > 0) {
    // NOT refunded -- confirmed decision, see section J's comment.
    stillHanging.forEach(p => {
      const c = curveMap.get(p.id);
      if (c) board.removeObject(c);
      curveMap.delete(p.id);
    });
    purgeHanging(stillHanging.map(p => p.id));
  }

  if (!connected) {
    addHanging(piece);
    curveObj.setAttribute({ strokeColor: 'orange' });
  }

  const parts = [];
  parts.push(connected ? 'Piece connected successfully.' : 'This piece does not connect -- it is hanging.');
  if (reconnected.length > 0) parts.push(`${reconnected.length} piece(s) reconnected.`);
  if (stillHanging.length > 0) parts.push(`${stillHanging.length} hanging piece(s) removed, unrefunded (not reconnected in time).`);

  showMessage(parts.join(' '), !connected || stillHanging.length > 0);
}

// -----------------------------------------------------------------------
// L. Click handler -- orchestrator. NEW: validates material and charges
// budget BEFORE the piece is plotted or registered at all. If either
// check fails, the piece never touches the board, piece.js, or curveMap --
// exactly as if the click never happened, aside from the error message.
// -----------------------------------------------------------------------
function handlePlotClick(board) {
  const { equation, rangeMin, rangeMax, material, orientation } = getInputValues();

  if (!isValidMaterial(material)) {
    showMessage(`Unknown material: '${material}'`, true);
    return;
  }

  const piece = createPiece(equation, rangeMin, rangeMax, material, orientation);

  if (piece.error) {
    showMessage(piece.error, true);
    return;
  }

  const chargeResult = chargePiece(piece, materialsLookupFor(currentRound));
  if (!chargeResult.success) {
    showMessage(chargeResult.error, true);
    return; // piece is NOT plotted, NOT registered -- as if never created
  }

  updateHud(currentRound);

  const curveObj = plotPieceCurve(board, piece);
  handleNewPiece(board, piece, curveObj);
}

// budget.chargePiece expects a materialsLookup object keyed by material
// name -- materials.js's MATERIALS export already matches that shape, so
// this just re-exposes it without graph.js needing to know its internal
// structure beyond "import it and pass it through." Takes `round` as a
// parameter for symmetry with other per-round functions even though it's
// unused right now -- if a future round ever restricts WHICH materials
// are chargeable (not just which are pickable), this is where that
// filtering would go.
function materialsLookupFor(round) {
  return MATERIALS;
}

// -----------------------------------------------------------------------
// M. Disable build phase -- NEW. Called by main.js when time expires or
// the player clicks Test Bridge early. Locks every build control so no
// further pieces can be placed once testing has started.
// -----------------------------------------------------------------------
function disableBuildPhase() {
  const ids = ['plotButton', 'deleteButton', 'equationInput', 'rangeMin', 'rangeMax', 'materialInput', 'orientationInput'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = true;
  });
  clearSelection();
}

// -----------------------------------------------------------------------
// N. Round-aware initialization -- NEW. Replaces the old self-running
// block at the bottom of this file. main.js calls this once per round,
// with that round's full config object (from round-config.js).
//
// IMPORTANT: plotButton/deleteButton listeners are wired up ONLY ONCE,
// the very first time this runs (see listenersWired guard below) -- NOT
// once per round. If they were re-attached every round, by Round 3 each
// click would fire 3 stacked handlers, plotting/deleting the same piece
// multiple times. Instead, the handlers always read `activeBoard`
// (module-level, reassigned below), so one set of listeners correctly
// targets whichever round's board is currently active.
// -----------------------------------------------------------------------
let activeBoard = null;
let listenersWired = false;

function initBoardForRound(round) {
  currentRound = round;

  const board = initBoard('jxgbox', computeBoundingBox(round));
  drawCliffs(board, round.cliffs);
  drawGround(board, round.ground);
  initRound(round.cliffs, round.ground);
  populateMaterialPicker(round);

  activeBoard = board;
  curveMap.clear();
  clearSelection();

  // Re-enable build controls in case a previous round left them
  // disabled via disableBuildPhase().
  const ids = ['plotButton', 'equationInput', 'rangeMin', 'rangeMax', 'orientationInput'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = false;
  });
  if (round.materialMode === 'choice') {
    const select = document.getElementById('materialInput');
    if (select) select.disabled = false;
  }

  if (!listenersWired) {
    document.getElementById('plotButton').addEventListener('click', () => handlePlotClick(activeBoard));
    document.getElementById('deleteButton').addEventListener('click', () => {
      if (selectedPieceId !== null) {
        handleDeleteClick(activeBoard, selectedPieceId);
        clearSelection();
      }
    });
    listenersWired = true;
  }

  return board;
}

// -----------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------
export {
  initBoardForRound,
  disableBuildPhase
};