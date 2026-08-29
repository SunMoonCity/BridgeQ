// round-progression.test.js - Automated tests for Phase 15: Round Progression

import assert from 'node:assert';
import { LogicalGraph } from '../js/builder/graph-model.js';
import { PieceManager } from '../js/builder/piece-manager.js';
import { budgetManager } from '../js/economy/budget.js';
import { getRoundConfig, getTotalRounds } from '../js/config/round-config.js';
import { gameController } from '../js/core/game-controller.js';
import { gameState } from '../js/core/game-state.js';
import { timer } from '../js/core/timer.js';
import { eventBus } from '../js/core/event-bus.js';
import { EVENTS, GAME_STATES } from '../js/config/constants.js';

console.log('Testing Round Progression (Phase 15)...');

// 1. Total Rounds Verification
{
  assert.strictEqual(getTotalRounds(), 3, 'Game must configure exactly 3 competition rounds');
}

// 2. Loading Round 1 (Equal Cliff Heights)
{
  const graph = new LogicalGraph();
  const round1 = getRoundConfig(1);

  gameController.bindDependencies({
    graph,
    renderer: { setRound: () => {}, setGraph: () => {} },
    buildController: { roundConfig: null, setSelectedPiece: () => {} }
  });

  const success = gameController.loadRound(1);
  assert.strictEqual(success, true);
  assert.strictEqual(gameController.currentRoundNumber, 1);
  assert.strictEqual(budgetManager.getTotalBudget(), round1.budget);
  assert.strictEqual(timer.getRemaining(), round1.buildTimeSeconds);
  assert.strictEqual(graph.fixedVertexIds.size, 2);

  const anchorLeft = graph.canonicalVertices.get('v_1');
  const anchorRight = graph.canonicalVertices.get('v_2');
  assert.strictEqual(anchorLeft.y, 600);
  assert.strictEqual(anchorRight.y, 600); // Equal cliff heights in Round 1
}

// 3. Loading Round 3 (Differential Cliff Elevation)
{
  const graph = new LogicalGraph();
  const round3 = getRoundConfig(3);

  gameController.bindDependencies({
    graph,
    renderer: { setRound: () => {}, setGraph: () => {} },
    buildController: { roundConfig: null, setSelectedPiece: () => {} }
  });

  const success = gameController.loadRound(3);
  assert.strictEqual(success, true);
  assert.strictEqual(gameController.currentRoundNumber, 3);
  assert.strictEqual(budgetManager.getTotalBudget(), round3.budget);
  assert.strictEqual(timer.getRemaining(), round3.buildTimeSeconds);

  const anchorLeft = graph.canonicalVertices.get('v_1');
  const anchorRight = graph.canonicalVertices.get('v_2');
  assert.strictEqual(anchorLeft.y, 600);
  assert.strictEqual(anchorRight.y, 700); // Differential height (+100m) in Round 3
}

// 4. Sequential Round Advancement (Round 1 -> Round 2 -> Round 3 -> Competition Complete)
{
  const graph = new LogicalGraph();

  let completedSummary = null;
  gameController.bindDependencies({
    graph,
    renderer: { setRound: () => {}, setGraph: () => {} },
    buildController: { roundConfig: null, setSelectedPiece: () => {} },
    onGameComplete: (summary) => {
      completedSummary = summary;
    }
  });

  gameController.startCompetition();
  assert.strictEqual(gameController.currentRoundNumber, 1);

  // Simulate Round 1 success 5/5
  eventBus.emit(EVENTS.ROUND_COMPLETED, { stagesPassed: 5, totalStages: 5, score: '5/5' });
  assert.strictEqual(gameController.roundScores.get(1).score, '5/5');

  // Advance to Round 2
  gameController.nextRound();
  assert.strictEqual(gameController.currentRoundNumber, 2);

  // Simulate Round 2 success 4/5
  eventBus.emit(EVENTS.STAGE_FAILED, { stage: 5, stagesPassed: 4, totalStages: 5, reason: 'MEMBER_SNAP' });
  assert.strictEqual(gameController.roundScores.get(2).score, '4/5');

  // Advance to Round 3
  gameController.nextRound();
  assert.strictEqual(gameController.currentRoundNumber, 3);

  // Simulate Round 3 success 5/5
  eventBus.emit(EVENTS.ROUND_COMPLETED, { stagesPassed: 5, totalStages: 5, score: '5/5' });
  assert.strictEqual(gameController.roundScores.get(3).score, '5/5');

  // Finish competition
  gameController.nextRound();
  assert.ok(completedSummary, 'Game completion summary must be produced');
  assert.strictEqual(completedSummary.totalStagesPassed, 14); // 5 + 4 + 5 = 14
  assert.strictEqual(completedSummary.overallScore, '14/15');
}

console.log('  PASS: Round Progression (Phase 15) tests');
