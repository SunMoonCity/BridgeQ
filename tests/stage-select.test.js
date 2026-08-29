// stage-select.test.js - Automated tests for Phase 18: Stage Selection & Sequential Round Progression

import assert from 'node:assert';
import { StageSelectManager } from '../js/ui/stage-select.js';
import { gameController } from '../js/core/game-controller.js';
import { eventBus } from '../js/core/event-bus.js';
import { EVENTS } from '../js/config/constants.js';

console.log('Testing Stage Selection Page (Phase 18 Sequential Unlocking)...');

// Reset gameController roundScores before testing
gameController.roundScores.clear();

// 1. Initial State: Stage 1 Unlocked, Stage 2 & 3 Locked
{
  const stageManager = new StageSelectManager();
  assert.strictEqual(stageManager.isStageUnlocked(1), true, 'Stage 1 must be unlocked initially');
  assert.strictEqual(stageManager.isStageUnlocked(2), false, 'Stage 2 must be locked initially');
  assert.strictEqual(stageManager.isStageUnlocked(3), false, 'Stage 3 must be locked initially');
}

// 2. Locked Stage Selection Attempts are Rejected
{
  const stageManager = new StageSelectManager();
  let selectedRound = null;

  const handler = ({ roundNumber }) => {
    selectedRound = roundNumber;
  };

  eventBus.on(EVENTS.STAGE_SELECTED || 'STAGE_SELECTED', handler);

  // Select Stage 1 -> Success
  const result1 = stageManager.selectStage(1);
  assert.strictEqual(result1, true, 'Selecting unlocked Stage 1 must succeed');
  assert.strictEqual(selectedRound, 1);

  // Select Stage 2 -> Blocked
  selectedRound = null;
  const result2 = stageManager.selectStage(2);
  assert.strictEqual(result2, false, 'Selecting locked Stage 2 must fail and return false');
  assert.strictEqual(selectedRound, null, 'STAGE_SELECTED event must NOT be emitted for locked stage');

  // Select Stage 3 -> Blocked
  const result3 = stageManager.selectStage(3);
  assert.strictEqual(result3, false, 'Selecting locked Stage 3 must fail and return false');

  eventBus.off(EVENTS.STAGE_SELECTED || 'STAGE_SELECTED', handler);
}

// 3. Completing Stage 1 Unlocks Stage 2 (Stage 3 Remains Locked)
{
  const stageManager = new StageSelectManager();
  stageManager.init();

  // Load Round 1 and simulate completion in gameController
  gameController.loadRound(1);
  gameController.onRoundTestComplete({ stagesPassed: 5, totalStages: 5, score: '5/5' });

  assert.strictEqual(stageManager.isStageCompleted(1), true, 'Stage 1 marked completed');
  assert.strictEqual(stageManager.isStageUnlocked(1), true, 'Stage 1 unlocked (replayable)');
  assert.strictEqual(stageManager.isStageUnlocked(2), true, 'Stage 2 unlocked after Stage 1 completion');
  assert.strictEqual(stageManager.isStageUnlocked(3), false, 'Stage 3 remains locked until Stage 2 completion');

  // Stage 2 can now be selected
  const result2 = stageManager.selectStage(2);
  assert.strictEqual(result2, true, 'Selecting newly unlocked Stage 2 must succeed');
}

// 4. Completing Stage 2 Unlocks Stage 3
{
  const stageManager = new StageSelectManager();
  stageManager.init();

  // Advance gameController to Round 2 and simulate completion (even with partial 3/5 score)
  gameController.loadRound(2);
  gameController.onRoundTestFailed({ stage: 4, stagesPassed: 3, totalStages: 5, reason: 'MEMBER_SNAP' });

  assert.strictEqual(stageManager.isStageCompleted(2), true, 'Stage 2 marked completed');
  assert.strictEqual(stageManager.isStageUnlocked(3), true, 'Stage 3 unlocked after Stage 2 completion');

  // Stage 3 can now be selected
  const result3 = stageManager.selectStage(3);
  assert.strictEqual(result3, true, 'Selecting newly unlocked Stage 3 must succeed');
}

// 5. Development Mode Override
{
  gameController.roundScores.clear(); // Reset progression
  const stageManager = new StageSelectManager();
  assert.strictEqual(stageManager.isStageUnlocked(2), false);

  stageManager.setDevMode(true);
  assert.strictEqual(stageManager.isStageUnlocked(2), true, 'Dev mode unlocks Stage 2');
  assert.strictEqual(stageManager.isStageUnlocked(3), true, 'Dev mode unlocks Stage 3');
}

console.log('  PASS: Stage Selection Page (Phase 18 Sequential Unlocking) tests');
