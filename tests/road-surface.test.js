// road-surface.test.js - Automated tests for Phase 11: Road Physics & Continuous Contact Surface

import assert from 'node:assert';
import { LogicalGraph } from '../js/builder/graph-model.js';
import { PieceManager } from '../js/builder/piece-manager.js';
import { budgetManager } from '../js/economy/budget.js';
import { getRoundConfig } from '../js/config/round-config.js';
import { PhysicsBridgeBuilder } from '../js/physics/physics-bridge-builder.js';
import { RoadSurface } from '../js/physics/road-surface.js';

console.log('Testing Road Physics & Continuous Contact Surface (Phase 11)...');

const round1 = getRoundConfig(1);

// ---------------------------------------------------------------------------
// 1. Elevation Query on Flat Road Deck
// ---------------------------------------------------------------------------
{
  const graph = new LogicalGraph();
  graph.initEnvironment(round1.cliffs);
  budgetManager.init(round1.budget);

  // Flat road at y = 600 from x=0 to 400
  PieceManager.addPieceTransaction(graph, budgetManager, round1, {
    equation: '600',
    rangeMin: 0,
    rangeMax: 400,
    material: 'road',
    isRoad: true
  });

  const world = PhysicsBridgeBuilder.buildPhysicsWorld(graph);
  const road = new RoadSurface(world);

  // Query midpoint at x = 200
  const qMid = road.queryAtX(200);
  assert.strictEqual(qMid.onRoad, true);
  assert.strictEqual(Math.round(qMid.y), 600);
  assert.strictEqual(qMid.normalX, 0);
  assert.strictEqual(qMid.normalY, 1); // Normal points straight up
  assert.strictEqual(qMid.slopeAngle, 0);

  // Query entrance and exit
  const qStart = road.queryAtX(0);
  assert.strictEqual(qStart.onRoad, true);
  assert.strictEqual(Math.round(qStart.y), 600);

  const qEnd = road.queryAtX(400);
  assert.strictEqual(qEnd.onRoad, true);
  assert.strictEqual(Math.round(qEnd.y), 600);

  // Out of bounds query
  const qOut = road.queryAtX(450);
  assert.strictEqual(qOut.onRoad, false);
}

// ---------------------------------------------------------------------------
// 2. Elevation Query on Sloped / Curved Road Deck
// ---------------------------------------------------------------------------
{
  const round3 = getRoundConfig(3); // Left cliff at (0, 600), Right cliff at (400, 700)
  const graph = new LogicalGraph();
  graph.initEnvironment(round3.cliffs);
  budgetManager.init(round3.budget);

  // Sloped linear road: y = 0.25*x + 600
  PieceManager.addPieceTransaction(graph, budgetManager, round3, {
    equation: '0.25*x + 600',
    rangeMin: 0,
    rangeMax: 400,
    material: 'road',
    isRoad: true
  });

  const world = PhysicsBridgeBuilder.buildPhysicsWorld(graph);
  const road = new RoadSurface(world);

  const qMid = road.queryAtX(200);
  assert.strictEqual(qMid.onRoad, true);
  assert.strictEqual(Math.round(qMid.y), 650); // 0.25*200 + 600 = 650

  // Tangent and slope angle should be positive
  assert.ok(qMid.slopeAngle > 0, 'Sloped road should have positive slope angle');
  assert.ok(qMid.normalY > 0, 'Normal should point upward');
}

// ---------------------------------------------------------------------------
// 3. Dynamic Wheel Contact Load Distribution
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
  const road = new RoadSurface(world);

  // Apply a 1000 N downward wheel load at x = 100
  const applied = road.applyContactLoad(100, 0, -1000);
  assert.strictEqual(applied, true);

  // Verify that nodes around x=100 received downward forces
  let totalDownwardForce = 0;
  for (const node of world.nodes.values()) {
    if (node.forceY < 0) {
      totalDownwardForce += Math.abs(node.forceY);
    }
  }

  assert.strictEqual(Math.round(totalDownwardForce), 1000, 'Sum of distributed node forces must equal 1000 N load');
}

// ---------------------------------------------------------------------------
// 4. Gap and Discontinuity Detection on Broken Road
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
  const road = new RoadSurface(world);

  // Initially continuous
  assert.strictEqual(road.checkContinuity(0, 400).continuous, true);

  // Break a road segment in the middle (e.g. at x ~ 200)
  for (const seg of world.roadSegments) {
    const mid = (seg.nodeA.initialX + seg.nodeB.initialX) / 2;
    if (Math.abs(mid - 200) < 10) {
      seg.break();
      break;
    }
  }

  // Continuity check should now detect the missing gap (use step = 0.25 to resolve 0.5m segments)
  const contRes = road.checkContinuity(0, 400, 0.25);
  assert.strictEqual(contRes.continuous, false, 'Broken road must be detected as discontinuous');
  assert.ok(contRes.gapAtX !== undefined);
}

console.log('  PASS: Road Physics & Continuous Contact Surface (Phase 11) tests');
