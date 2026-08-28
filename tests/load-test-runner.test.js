// load-test-runner.test.js - Automated tests for Phase 13: 5-Stage Sequential Load Test Runner

import assert from 'node:assert';
import { LogicalGraph } from '../js/builder/graph-model.js';
import { PieceManager } from '../js/builder/piece-manager.js';
import { budgetManager } from '../js/economy/budget.js';
import { getRoundConfig } from '../js/config/round-config.js';
import { PhysicsBridgeBuilder } from '../js/physics/physics-bridge-builder.js';
import { PhysicsSimulation } from '../js/physics/physics-simulation.js';
import { LoadTestRunner } from '../js/physics/load-test-runner.js';

console.log('Testing 5-Stage Sequential Load Test Runner (Phase 13)...');

const round1 = getRoundConfig(1);

// ---------------------------------------------------------------------------
// 1. Strong Bridge Passes All 5 Sequential Load Stages (Score: 5/5)
// ---------------------------------------------------------------------------
{
  const graph = new LogicalGraph();
  graph.initEnvironment(round1.cliffs);
  budgetManager.init(round1.budget);

  // Build a strong truss bridge:
  // 1. Road deck from x=0 to 400
  PieceManager.addPieceTransaction(graph, budgetManager, round1, {
    equation: '600',
    rangeMin: 0,
    rangeMax: 400,
    material: 'road',
    isRoad: true
  });

  // 2. Steel Arch support underneath
  PieceManager.addPieceTransaction(graph, budgetManager, round1, {
    equation: '0.002*(x - 200)^2 + 520',
    rangeMin: 0,
    rangeMax: 400,
    material: 'steel'
  });

  const world = PhysicsBridgeBuilder.buildPhysicsWorld(graph);
  const sim = new PhysicsSimulation(world);
  const runner = new LoadTestRunner(sim, round1);

  const completedStages = [];
  runner.onStageComplete = ({ stage, stagesPassed }) => {
    completedStages.push({ stage, stagesPassed });
  };

  const res = runner.runSync(15000);

  assert.strictEqual(res.stagesPassed, 5, 'Strong bridge must pass all 5 stages');
  assert.strictEqual(res.isComplete, true, 'Test must complete successfully');
  assert.strictEqual(res.isFailed, false, 'Test must not fail');
  assert.strictEqual(completedStages.length, 5, 'All 5 stages must trigger completion callback');
}

// ---------------------------------------------------------------------------
// 2. Weak Overloaded Bridge Fails Early (e.g. Stage 2 Collapse)
// ---------------------------------------------------------------------------
{
  const graph = new LogicalGraph();
  graph.initEnvironment(round1.cliffs);
  budgetManager.init(round1.budget);

  // Weak unsupported concrete beam spanning 400m
  PieceManager.addPieceTransaction(graph, budgetManager, round1, {
    equation: '600',
    rangeMin: 0,
    rangeMax: 400,
    material: 'concrete', // Low tensile strength (25)
    isRoad: true
  });

  const world = PhysicsBridgeBuilder.buildPhysicsWorld(graph);
  const sim = new PhysicsSimulation(world, {
    gravity: -20 // Higher gravity to induce early collapse under heavy vehicles
  });
  const runner = new LoadTestRunner(sim, round1);

  const res = runner.runSync(10000);

  assert.ok(res.stagesPassed < 5, 'Weak bridge must not pass all 5 stages');
  assert.strictEqual(res.isFailed, true, 'Test must be marked as failed');
  assert.ok(res.failureDetails, 'Failure diagnostics must be captured');
}

// ---------------------------------------------------------------------------
// 3. Multi-Car Spawning Intervals
// ---------------------------------------------------------------------------
{
  const graph = new LogicalGraph();
  graph.initEnvironment(round1.cliffs);
  budgetManager.init(round1.budget);

  PieceManager.addPieceTransaction(graph, budgetManager, round1, {
    equation: '600',
    rangeMin: 0,
    rangeMax: 400,
    material: 'road',
    isRoad: true
  });

  const world = PhysicsBridgeBuilder.buildPhysicsWorld(graph);
  const sim = new PhysicsSimulation(world);
  const runner = new LoadTestRunner(sim, round1);

  runner.start();

  // Step first tick to trigger initial vehicle spawn
  runner.step(1 / 60);

  // Stage 1 has 1 car
  assert.strictEqual(runner.activeVehicles.length, 1, 'Stage 1 starts with 1 car spawned');

  // Advance simulation to Stage 2 (carCount = 2, spawnGapSeconds = 1.8)
  // Run Stage 1 to completion
  while (runner.currentStageIndex === 0 && runner.isRunning) {
    runner.step(1 / 60);
  }

  assert.strictEqual(runner.stagesPassed, 1, 'Stage 1 must pass');
  assert.strictEqual(runner.currentStageIndex, 1, 'Runner should now be in Stage 2');
}

console.log('  PASS: 5-Stage Sequential Load Test Runner (Phase 13) tests');
