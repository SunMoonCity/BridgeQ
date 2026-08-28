// gravity-simulation.test.js - Automated tests for Phase 10: Structural Gravity Simulation

import assert from 'node:assert';
import { LogicalGraph } from '../js/builder/graph-model.js';
import { PieceManager } from '../js/builder/piece-manager.js';
import { budgetManager } from '../js/economy/budget.js';
import { getRoundConfig } from '../js/config/round-config.js';
import { PhysicsBridgeBuilder } from '../js/physics/physics-bridge-builder.js';
import { PhysicsSimulation } from '../js/physics/physics-simulation.js';
import { FAILURE_REASONS } from '../js/physics/failure-detector.js';

console.log('Testing Basic Structural Gravity Simulation (Phase 10)...');

const round1 = getRoundConfig(1);

// ---------------------------------------------------------------------------
// 1. Static Anchors Remain Strictly Fixed During Gravity Simulation
// ---------------------------------------------------------------------------
{
  const graph = new LogicalGraph();
  graph.initEnvironment(round1.cliffs);
  budgetManager.init(round1.budget);

  // Build a road span from (0, 600) to (400, 600)
  PieceManager.addPieceTransaction(graph, budgetManager, round1, {
    equation: '600',
    rangeMin: 0,
    rangeMax: 400,
    material: 'road',
    isRoad: true
  });

  const world = PhysicsBridgeBuilder.buildPhysicsWorld(graph);
  const sim = new PhysicsSimulation(world);

  const leftAnchor = world.getNode('v_1'); // (0, 600)
  const rightAnchor = world.getNode('v_2'); // (400, 600)

  // Run 120 ticks (2 seconds of gravity)
  const runResult = sim.runTicks(120);
  assert.strictEqual(runResult.completedTicks, 120);

  // Assert fixed anchors have NOT moved at all
  assert.strictEqual(leftAnchor.x, 0, 'Left anchor X must remain 0');
  assert.strictEqual(leftAnchor.y, 600, 'Left anchor Y must remain 600');
  assert.strictEqual(rightAnchor.x, 400, 'Right anchor X must remain 400');
  assert.strictEqual(rightAnchor.y, 600, 'Right anchor Y must remain 600');
}

// ---------------------------------------------------------------------------
// 2. Dynamic Nodes Deflect Under Gravity (Natural Sagging Equilibrium)
// ---------------------------------------------------------------------------
{
  const graph = new LogicalGraph();
  graph.initEnvironment(round1.cliffs);
  budgetManager.init(round1.budget);

  // Straight beam
  PieceManager.addPieceTransaction(graph, budgetManager, round1, {
    equation: '600',
    rangeMin: 0,
    rangeMax: 400,
    material: 'steel'
  });

  const world = PhysicsBridgeBuilder.buildPhysicsWorld(graph);
  const sim = new PhysicsSimulation(world);

  // Find midpoint node at x=200
  let midNode = null;
  for (const node of world.nodes.values()) {
    if (Math.abs(node.initialX - 200) < 1.0) {
      midNode = node;
      break;
    }
  }

  assert.ok(midNode, 'Midpoint node must exist');
  assert.strictEqual(midNode.initialY, 600);

  // Run 60 ticks of simulation
  sim.runTicks(60);

  // Midpoint should deflect downward under gravity (y < 600)
  assert.ok(midNode.y < 600, 'Midpoint node must sag downward under gravity');
  assert.ok(midNode.y > 500, 'Stable bridge deflection must remain bounded and not collapse completely');
}

// ---------------------------------------------------------------------------
// 3. Stresses are Generated and Measurable in Stretched Members
// ---------------------------------------------------------------------------
{
  const graph = new LogicalGraph();
  graph.initEnvironment(round1.cliffs);
  budgetManager.init(round1.budget);

  PieceManager.addPieceTransaction(graph, budgetManager, round1, {
    equation: '600',
    rangeMin: 0,
    rangeMax: 400,
    material: 'steel'
  });

  const world = PhysicsBridgeBuilder.buildPhysicsWorld(graph);
  const sim = new PhysicsSimulation(world);

  // Initial resting stress is 0
  const initialStresses = world.getEdgeStressMap();
  for (const stress of initialStresses.values()) {
    assert.strictEqual(stress, 0);
  }

  // Run simulation under gravity
  sim.runTicks(60);

  const deformedStresses = world.getEdgeStressMap();
  let maxStress = 0;
  for (const stress of deformedStresses.values()) {
    if (stress > maxStress) maxStress = stress;
  }

  assert.ok(maxStress > 0, 'Under gravity deformation, structural members must develop positive tension/compression stress');
}

// ---------------------------------------------------------------------------
// 4. Overload Failure Detection (Member Snap on Excessive Strain)
// ---------------------------------------------------------------------------
{
  const graph = new LogicalGraph();
  graph.initEnvironment(round1.cliffs);
  budgetManager.init(round1.budget);

  // Weak concrete beam spanning 400m under high gravity
  PieceManager.addPieceTransaction(graph, budgetManager, round1, {
    equation: '600',
    rangeMin: 0,
    rangeMax: 400,
    material: 'concrete' // Concrete is weak in tension (tensileStrength: 25)
  });

  const world = PhysicsBridgeBuilder.buildPhysicsWorld(graph);
  // Simulate extreme downward load / gravity
  const sim = new PhysicsSimulation(world, {
    gravity: -50.0 // 5x normal gravity to force structural overload
  });

  let failureReceived = null;
  sim.onFailure = (details) => {
    failureReceived = details;
  };

  const res = sim.runTicks(180);

  assert.strictEqual(res.failed, true, 'Overloaded bridge must trigger structural failure');
  assert.ok(res.failure, 'Failure details must be recorded');
  assert.ok(
    res.failure.reason === FAILURE_REASONS.MEMBER_SNAP || res.failure.reason === FAILURE_REASONS.EXCESSIVE_SAG,
    'Failure reason must be member snap or excessive sag'
  );
  assert.ok(failureReceived, 'onFailure callback must be executed');
}

// ---------------------------------------------------------------------------
// 5. Simulation Reset Restores Original Resting Geometry
// ---------------------------------------------------------------------------
{
  const graph = new LogicalGraph();
  graph.initEnvironment(round1.cliffs);
  budgetManager.init(round1.budget);

  PieceManager.addPieceTransaction(graph, budgetManager, round1, {
    equation: '600',
    rangeMin: 0,
    rangeMax: 400,
    material: 'steel'
  });

  const world = PhysicsBridgeBuilder.buildPhysicsWorld(graph);
  const sim = new PhysicsSimulation(world);

  sim.runTicks(60);
  assert.ok(sim.elapsedTime > 0);
  assert.ok(sim.tickCount === 60);

  sim.reset();

  assert.strictEqual(sim.elapsedTime, 0);
  assert.strictEqual(sim.tickCount, 0);
  assert.strictEqual(sim.isFailed, false);

  for (const node of world.nodes.values()) {
    assert.strictEqual(node.x, node.initialX);
    assert.strictEqual(node.y, node.initialY);
    assert.strictEqual(node.vx, 0);
    assert.strictEqual(node.vy, 0);
  }
}

console.log('  PASS: Basic Structural Gravity Simulation (Phase 10) tests');
