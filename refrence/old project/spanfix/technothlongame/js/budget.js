// budget.js
// Owns: cost calculation for a placed piece, and the running budget
// tracker for the current round (spent so far, remaining, per-piece
// ledger so a delete can be refunded without recomputing anything).
//
// Explicitly OUT of scope for this file (per project MECE split):
//   - material properties/cost-per-unit data  -> materials.js
//   - whether a round even HAS a budget       -> round-config.js
//     (this file just takes whatever `budgetLimit` it's given — null
//     means unlimited, same convention round-config.js already uses)
//   - showing budget/cost on screen           -> ui.js
//   - deciding WHEN to call chargePiece/refundPiece -> graph.js / ui.js
//
// COORDINATION FLAG for whoever builds materials.js:
//   Every function here that touches cost expects a `materialsLookup`
//   object shaped like:
//     { steel: { costPerUnit: 5, ... }, wood: { costPerUnit: 1, ... } }
//   i.e. keyed by the exact same material-name strings piece.js stores
//   on `piece.material`, each value an object with AT LEAST a numeric
//   `costPerUnit` field. budget.js never imports materials.js directly
//   (keeps this file testable standalone, same pattern as piece.js) —
//   whoever wires graph.js/ui.js/main.js together is responsible for
//   importing materials.js's real data and passing it in here.
//
// COST MODEL (game-design choice, not physics):
//   cost = costPerUnit * (piece's arc length), where arc length is the
//   sum of straight-line distances between consecutive sampled points
//   already sitting on piece.points (piece.js produces these). This is
//   good-enough for a game — no calculus, and it naturally charges more
//   for longer/steeper pieces without needing a separate "length" input
//   from the student.
//
// CHARGE MODEL (game-design choice — FLAG FOR TEAM REVIEW, not yet
// confirmed against how graph.js currently deletes pieces):
//   - chargePiece() should be called the moment a piece is PLACED
//     (whether it ends up connected or hanging) — you paid for the
//     material either way.
//   - refundPiece() should be called ONLY on a piece the STUDENT chose
//     to delete via the Delete button (graph.js's handleDeleteClick,
//     both the "registered piece" and "hanging piece" branches).
//   - refundPiece() should NOT be called when graph.js auto-purges a
//     hanging piece that failed its one reconnect chance
//     (handleNewPiece's stillHanging cleanup) — that's treated as
//     wasted material, a consequence of not reconnecting in time, not
//     a refundable cancellation.
//   This distinction (manual delete vs. automatic purge) is a real
//   game-balance decision, not just plumbing — confirm with the team
//   before wiring graph.js to this file. See the delivery notes.
 
// -----------------------------------------------------------------------
// A. Module state — one round's budget at a time, reset via initBudget()
// -----------------------------------------------------------------------
let budgetLimit = null; // null = unlimited, matches round-config.js's convention
let spent = 0;
let ledger = new Map(); // pieceId -> cost charged for that piece
 
// -----------------------------------------------------------------------
// B. Setup / reset — call once per round, same spot main.js will call
// piece.js's initRound() from.
// -----------------------------------------------------------------------
function initBudget(limit) {
  budgetLimit = typeof limit === 'number' ? limit : null;
  spent = 0;
  ledger = new Map();
}
 
// -----------------------------------------------------------------------
// C. Arc length of a piece — sum of distances between consecutive
// sampled points. Works the same regardless of orientation ('y-of-x' vs
// 'x-of-y') since it only ever looks at piece.points' x/y values, never
// re-derives them from the equation.
// -----------------------------------------------------------------------
function calculatePieceLength(piece) {
  const points = piece && piece.points;
  if (!Array.isArray(points) || points.length < 2) return 0;
 
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return length;
}
 
// -----------------------------------------------------------------------
// D. Cost of a single piece — does NOT touch budget state, just computes
// a number (or an error). Useful for a "preview cost before you place
// it" UI feature later, separate from actually charging it.
// -----------------------------------------------------------------------
function calculatePieceCost(piece, materialsLookup) {
  const materialData = materialsLookup && materialsLookup[piece.material];
 
  if (!materialData || typeof materialData.costPerUnit !== 'number') {
    return { error: `Unknown material or missing costPerUnit: '${piece.material}'` };
  }
 
  const length = calculatePieceLength(piece);
  return { cost: length * materialData.costPerUnit, length };
}
 
// -----------------------------------------------------------------------
// E. Budget queries
// -----------------------------------------------------------------------
function canAfford(cost) {
  return budgetLimit === null || spent + cost <= budgetLimit;
}
 
function getSpent() {
  return spent;
}
 
function getRemaining() {
  return budgetLimit === null ? null : budgetLimit - spent;
}
 
function getBudgetLimit() {
  return budgetLimit;
}
 
// Mainly for ui.js/debugging — an array copy, not the live Map, so
// callers can't accidentally mutate ledger state from outside.
function getLedgerSnapshot() {
  return Array.from(ledger.entries()).map(([pieceId, cost]) => ({ pieceId, cost }));
}
 
// -----------------------------------------------------------------------
// F. Charging — the main entry point graph.js should call right after
// createPiece() succeeds, BEFORE registering/plotting it. If this
// returns success:false, graph.js should show the error and NOT plot
// the piece at all (same pattern as piece.js's {error} return).
// -----------------------------------------------------------------------
function chargePiece(piece, materialsLookup) {
  if (ledger.has(piece.id)) {
    return { success: false, error: 'This piece has already been charged (duplicate id).' };
  }
 
  const result = calculatePieceCost(piece, materialsLookup);
  if (result.error) {
    return { success: false, error: result.error };
  }
 
  if (!canAfford(result.cost)) {
    return {
      success: false,
      error: `Insufficient budget: this piece costs ${result.cost.toFixed(2)}, ` +
             `but only ${getRemaining().toFixed(2)} remains.`,
      cost: result.cost
    };
  }
 
  ledger.set(piece.id, result.cost);
  spent += result.cost;
 
  return { success: true, cost: result.cost, spent, remaining: getRemaining() };
}
 
// -----------------------------------------------------------------------
// G. Refunding — call ONLY for a student-initiated delete (see the
// CHARGE MODEL note at the top). Looks the cost up from the ledger
// rather than recomputing it, so it's correct even if materialsLookup
// isn't handy at delete time.
// -----------------------------------------------------------------------
function refundPiece(pieceId) {
  if (!ledger.has(pieceId)) {
    return { success: false, error: 'No charge on record for this piece id.' };
  }
 
  const cost = ledger.get(pieceId);
  ledger.delete(pieceId);
  spent -= cost;
 
  return { success: true, refunded: cost, spent, remaining: getRemaining() };
}
 
// -----------------------------------------------------------------------
// H. Exports
// -----------------------------------------------------------------------
export {
  initBudget,
  calculatePieceLength,
  calculatePieceCost,
  canAfford,
  chargePiece,
  refundPiece,
  getSpent,
  getRemaining,
  getBudgetLimit,
  getLedgerSnapshot
};