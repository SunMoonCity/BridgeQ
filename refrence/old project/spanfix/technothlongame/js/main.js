// main.js
// Owns: the overall game loop / round orchestration. Nothing about
// pieces, physics, or materials lives here directly -- this file only
// calls into the other modules in the right order and reacts to their
// results. Think of this as the "conductor", not a "player".
//
// FLOW PER ROUND:
//   1. Load round config (cliffs, ground, budget, material mode, time)
//   2. Reset piece.js's connection state + budget.js's ledger
//   3. Initialize graph.js's board for THIS round's geometry
//   4. Start the countdown timer
//   5. Player builds (graph.js handles plot/delete clicks internally,
//      calling into piece.js + budget.js as needed -- main.js doesn't
//      micromanage individual clicks)
//   6. Build phase ends -- either timer expires, or player clicks
//      "Test Bridge" early
//   7. Run loadtest.js's runLoadTest() against whatever got built
//   8. Show result, compute score, offer "Next Round"
//
// NOTE: graph.js currently self-initializes on module load with
// hardcoded Round-1-only cliffs. It needs a refactor (next step after
// this file) to instead export an initBoardForRound(roundConfig)
// function that main.js calls here in step 3. This file is written
// assuming that refactor exists.

import { getRoundConfig, getTotalRounds } from './round-config.js';
import { initRound as initPieceState, getAllPieces } from './piece.js';
import { initBudget, getSpent, getRemaining, getBudgetLimit } from './budget.js';
import { startTimer, stopTimer, formatTime } from './timer.js';
import { runLoadTest } from './loadtest.js';
import { MATERIALS } from './materials.js';
import { initBoardForRound, disableBuildPhase } from './graph.js';
// ^ initBoardForRound + disableBuildPhase don't exist in graph.js yet --
//   this is the interface main.js needs from it. Flagged for the
//   graph.js refactor.

// -----------------------------------------------------------------------
// A. Game-wide state -- which round we're on, and each round's outcome,
// so a final summary can be shown after the last round.
// -----------------------------------------------------------------------
let currentRoundNumber = 1;
const roundResults = []; // { roundNumber, stagesPassed, totalStages, spent, remaining }

// -----------------------------------------------------------------------
// B. Start a round -- the entry point for both "game just launched" and
// "player clicked Next Round".
// -----------------------------------------------------------------------
function startRound(roundNumber) {
  const round = getRoundConfig(roundNumber);
  if (!round) {
    showFinalSummary(); // no more rounds -- game over
    return;
  }

  currentRoundNumber = roundNumber;

  // Reset per-round engines before anything gets built against them.
  initPieceState(round.cliffs, round.ground);
  initBudget(round.budget);

  // graph.js needs the round's geometry + material mode to draw the
  // board and populate (or lock) the material picker.
  initBoardForRound(round);

  updateHud(round);

  startTimer(
    round.buildTimeSeconds,
    (remaining) => onTimerTick(remaining),
    () => onBuildPhaseEnd(round)
  );
}

// -----------------------------------------------------------------------
// C. Timer tick -- just pushes the formatted time into the HUD. main.js
// owns this wiring since timer.js deliberately stays DOM-free.
// -----------------------------------------------------------------------
function onTimerTick(remainingSeconds) {
  const el = document.getElementById('statTime');
  if (el) el.textContent = formatTime(remainingSeconds);
}

// -----------------------------------------------------------------------
// D. Live budget/round HUD -- called on round start and after every
// charge/refund so the player always sees current numbers.
// (graph.js's chargePiece/refundPiece calls should trigger this too --
// simplest way is graph.js calling a main.js-exported updateHud() after
// each one, wired in during the graph.js refactor.)
// -----------------------------------------------------------------------
function updateHud(round) {
  const spentEl = document.getElementById('statSpent');
  const remainingEl = document.getElementById('statRemaining');
  if (spentEl) spentEl.textContent = getSpent().toFixed(2);
  if (remainingEl) {
    const remaining = getRemaining();
    remainingEl.textContent = remaining === null ? 'Unlimited' : remaining.toFixed(2);
  }
  const roundEl = document.getElementById('statRound');
  if (roundEl) roundEl.textContent = `${round.label} (${round.id}/${getTotalRounds()})`;
}

// -----------------------------------------------------------------------
// E. Build phase ends -- either the timer expired, or the player hit
// "Test Bridge" manually before time ran out (see wireTestButton below,
// both paths funnel here).
// -----------------------------------------------------------------------
function onBuildPhaseEnd(round) {
  stopTimer();
  disableBuildPhase(); // graph.js: hide plot/delete controls, lock inputs

  const result = runLoadTest(getAllPieces(), MATERIALS, round.cliffs, round.ground);

  roundResults.push({
    roundNumber: round.id,
    stagesPassed: result.stagesPassed,
    totalStages: result.totalStages,
    completedAllStages: result.completedAllStages,
    spent: getSpent(),
    remaining: getRemaining()
  });

  showRoundResult(round, result);
}

// -----------------------------------------------------------------------
// F. "Test Bridge" button -- lets the player end the build phase early.
// Funnels into the exact same onBuildPhaseEnd path as a timer expiry, so
// there's only ever one place that runs the test.
// -----------------------------------------------------------------------
function wireTestButton() {
  const btn = document.getElementById('testBridgeButton');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const round = getRoundConfig(currentRoundNumber);
    onBuildPhaseEnd(round);
  });
}

// -----------------------------------------------------------------------
// G. Result display -- placeholder rendering. ui.js will likely replace
// the innerHTML calls here with something nicer; this just proves the
// data flow end to end.
// -----------------------------------------------------------------------
function showRoundResult(round, result) {
  const el = document.getElementById('resultBox');
  if (!el) return;

  const message = result.completedAllStages
    ? `${round.label} complete! All ${result.totalStages} stages passed.`
    : `${round.label} ended: ${result.stagesPassed}/${result.totalStages} stages passed before failure.`;

  el.innerHTML = `
    <p>${message}</p>
    <button id="nextRoundButton">Next Round</button>
  `;

  document.getElementById('nextRoundButton').addEventListener('click', () => {
    startRound(currentRoundNumber + 1);
  });
}

// -----------------------------------------------------------------------
// H. Final summary once getRoundConfig() runs out of rounds.
// -----------------------------------------------------------------------
function showFinalSummary() {
  const el = document.getElementById('resultBox');
  if (!el) return;

  const totalStagesPassed = roundResults.reduce((sum, r) => sum + r.stagesPassed, 0);
  const rows = roundResults
    .map(r => `<li>${r.roundNumber}: ${r.stagesPassed}/${r.totalStages} stages, remaining budget ${r.remaining ?? 'N/A'}</li>`)
    .join('');

  el.innerHTML = `
    <h2>Game Over</h2>
    <p>Total stages passed across all rounds: ${totalStagesPassed}</p>
    <ul>${rows}</ul>
  `;
}

// -----------------------------------------------------------------------
// I. Entry point
// -----------------------------------------------------------------------
wireTestButton();
startRound(1);

// -----------------------------------------------------------------------
// Exports -- ui.js may want to call updateHud() directly after
// budget-affecting actions (charge/refund), so it's exported.
// -----------------------------------------------------------------------
export { updateHud, startRound };