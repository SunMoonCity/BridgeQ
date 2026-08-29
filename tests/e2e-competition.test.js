// e2e-competition.test.js - Automated tests for Phase 19: Full End-to-End Competition Flow

import assert from 'node:assert';
import { LogicalGraph } from '../js/builder/graph-model.js';
import { PieceManager } from '../js/builder/piece-manager.js';
import { BridgeValidator } from '../js/builder/validator.js';
import { PhysicsBridgeBuilder } from '../js/physics/physics-bridge-builder.js';
import { PhysicsSimulation } from '../js/physics/physics-simulation.js';
import { LoadTestRunner } from '../js/physics/load-test-runner.js';
import { gameController } from '../js/core/game-controller.js';
import { stageSelectManager } from '../js/ui/stage-select.js';
import { budgetManager } from '../js/economy/budget.js';
import { getRoundConfig } from '../js/config/round-config.js';
import { eventBus } from '../js/core/event-bus.js';
import { EVENTS } from '../js/config/constants.js';

console.log('Testing Full End-to-End Competition Flow (Phase 19)...');

// Helper to construct a valid simple straight bridge spanning left to right cliffs
function buildValidBridge(graph, budgetMgr, roundConfig) {
  const leftCliff = roundConfig.cliffs[0];
  const rightCliff = roundConfig.cliffs[roundConfig.cliffs.length - 1];

  // 1. Plot Road Deck piece spanning x=left to x=right at cliff height
  const roadRes = PieceManager.addPieceTransaction(graph, budgetMgr, roundConfig, {
    equation: `${leftCliff.y}`,
    orientation: 'y-of-x',
    rangeMin: leftCliff.x,
    rangeMax: rightCliff.x,
    material: 'road',
    isRoad: true
  });
  assert.strictEqual(roadRes.success, true, 'Road deck plot must succeed');

  // 2. Plot Steel Support Arch
  const steelRes = PieceManager.addPieceTransaction(graph, budgetMgr, roundConfig, {
    equation: `0.002*(x - 200)^2 + 520`,
    orientation: 'y-of-x',
    rangeMin: leftCliff.x,
    rangeMax: rightCliff.x,
    material: 'steel',
    isRoad: false
  });
  assert.strictEqual(steelRes.success, true, 'Steel arch plot must succeed');
}

// 1. Complete End-to-End Competition Run (Round 1 -> Round 2 -> Round 3 -> Victory)
{
  gameController.roundScores.clear();
  stageSelectManager.completedRounds.clear();

  // Step A: Select Stage 1
  const stage1Selected = stageSelectManager.selectStage(1);
  assert.strictEqual(stage1Selected, true, 'Stage 1 selection must succeed');

  gameController.loadRound(1);
  const round1Config = getRoundConfig(1);
  const graph1 = new LogicalGraph();
  graph1.initEnvironment(round1Config.cliffs);
  budgetManager.init(round1Config.budget);

  // Step B: Construct Bridge in Round 1
  buildValidBridge(graph1, budgetManager, round1Config);

  // Step C: Validate Bridge Structure
  const val1 = BridgeValidator.validate(graph1, budgetManager, round1Config);
  assert.strictEqual(val1.valid, true, 'Round 1 bridge must pass pre-flight validation');

  // Step D: Convert to Physics & Run Load Test
  const world1 = PhysicsBridgeBuilder.buildPhysicsWorld(graph1);
  const sim1 = new PhysicsSimulation(world1);
  const runner1 = new LoadTestRunner(sim1, round1Config);

  const res1 = runner1.runSync(15000);
  assert.strictEqual(res1.isComplete, true, 'Round 1 load test must complete successfully');
  assert.strictEqual(res1.stagesPassed, 5, 'Round 1 must pass all 5 load stages');

  // Notify controller of round completion
  gameController.onRoundTestComplete({ stagesPassed: 5, totalStages: 5, score: '5/5' });
  assert.strictEqual(stageSelectManager.isStageUnlocked(2), true, 'Stage 2 unlocked after Round 1 completion');

  // Step E: Select Stage 2
  const stage2Selected = stageSelectManager.selectStage(2);
  assert.strictEqual(stage2Selected, true, 'Stage 2 selection must succeed');

  gameController.loadRound(2);
  const round2Config = getRoundConfig(2);
  const graph2 = new LogicalGraph();
  graph2.initEnvironment(round2Config.cliffs);
  budgetManager.init(round2Config.budget);

  buildValidBridge(graph2, budgetManager, round2Config);
  const world2 = PhysicsBridgeBuilder.buildPhysicsWorld(graph2);
  const sim2 = new PhysicsSimulation(world2);
  const runner2 = new LoadTestRunner(sim2, round2Config);

  const res2 = runner2.runSync(15000);
  assert.strictEqual(res2.isComplete, true, 'Round 2 load test must complete');

  gameController.onRoundTestComplete({ stagesPassed: 5, totalStages: 5, score: '5/5' });
  assert.strictEqual(stageSelectManager.isStageUnlocked(3), true, 'Stage 3 unlocked after Round 2 completion');

  // Step F: Select Stage 3
  const stage3Selected = stageSelectManager.selectStage(3);
  assert.strictEqual(stage3Selected, true, 'Stage 3 selection must succeed');

  gameController.loadRound(3);
  const round3Config = getRoundConfig(3);
  const graph3 = new LogicalGraph();
  graph3.initEnvironment(round3Config.cliffs);
  budgetManager.init(round3Config.budget);

  // Plot Stage 3 bridge
  PieceManager.addPieceTransaction(graph3, budgetManager, round3Config, {
    equation: `600 + 0.25*x`,
    orientation: 'y-of-x',
    rangeMin: 0,
    rangeMax: 400,
    material: 'road',
    isRoad: true
  });
  PieceManager.addPieceTransaction(graph3, budgetManager, round3Config, {
    equation: `0.002*(x - 200)^2 + 520`,
    orientation: 'y-of-x',
    rangeMin: 0,
    rangeMax: 400,
    material: 'steel',
    isRoad: false
  });

  const world3 = PhysicsBridgeBuilder.buildPhysicsWorld(graph3);
  const sim3 = new PhysicsSimulation(world3);
  const runner3 = new LoadTestRunner(sim3, round3Config);
  const res3 = runner3.runSync(15000);

  gameController.onRoundTestComplete({ stagesPassed: res3.stagesPassed, totalStages: 5, score: `${res3.stagesPassed}/5` });

  // Finish Competition
  const overallSummary = gameController.finishCompetition();
  assert.ok(overallSummary, 'Overall competition summary must be generated');
  assert.strictEqual(overallSummary.maxPossibleStages, 15);
  assert.ok(overallSummary.totalStagesPassed > 0);
}

console.log('  PASS: Full End-to-End Competition Flow (Phase 19) tests');
