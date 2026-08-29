// stage-select.test.js - Automated tests for Phase 18: Stage Selection Page

import assert from 'node:assert';
import { StageSelectManager } from '../js/ui/stage-select.js';
import { eventBus } from '../js/core/event-bus.js';
import { EVENTS } from '../js/config/constants.js';

console.log('Testing Stage Selection Page (Phase 18)...');

// 1. Stage Select Manager Instantiation & Standalone Defaults
{
  const stageManager = new StageSelectManager();
  assert.strictEqual(stageManager.playerData, null, 'Initial playerData should be null');
  assert.strictEqual(stageManager.isStageUnlocked(1), true, 'Stage 1 must be unlocked by default');
  assert.strictEqual(stageManager.isStageUnlocked(2), true, 'Stage 2 must be unlocked in standalone fallback');
  assert.strictEqual(stageManager.isStageUnlocked(3), true, 'Stage 3 must be unlocked in standalone fallback');
}

// 2. Custom Player Data & Progression Rules
{
  const stageManager = new StageSelectManager();
  stageManager.setPlayerData({
    name: 'Team Alpha',
    roundsCompleted: [1]
  });

  assert.strictEqual(stageManager.isStageUnlocked(1), true, 'Stage 1 unlocked');
  assert.strictEqual(stageManager.isStageUnlocked(2), true, 'Stage 2 unlocked because Round 1 completed');
  assert.strictEqual(stageManager.isStageUnlocked(3), false, 'Stage 3 locked because Round 2 not completed');
  assert.strictEqual(stageManager.isStageCompleted(1), true);
  assert.strictEqual(stageManager.isStageCompleted(2), false);
}

// 3. Stage Selection Event Emission
{
  const stageManager = new StageSelectManager();
  let selectedRound = null;

  eventBus.on(EVENTS.STAGE_SELECTED || 'STAGE_SELECTED', ({ roundNumber }) => {
    selectedRound = roundNumber;
  });

  stageManager.selectStage(3);
  assert.strictEqual(selectedRound, 3, 'STAGE_SELECTED event must convey selected roundNumber');
}

console.log('  PASS: Stage Selection Page (Phase 18) tests');
