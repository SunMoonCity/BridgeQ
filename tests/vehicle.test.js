// vehicle.test.js - Automated tests for Phase 12: Vehicle Dynamics & Wheel Load

import assert from 'node:assert';
import { LogicalGraph } from '../js/builder/graph-model.js';
import { PieceManager } from '../js/builder/piece-manager.js';
import { budgetManager } from '../js/economy/budget.js';
import { getRoundConfig } from '../js/config/round-config.js';
import { PhysicsBridgeBuilder } from '../js/physics/physics-bridge-builder.js';
import { RoadSurface } from '../js/physics/road-surface.js';
import { Vehicle } from '../js/physics/vehicle.js';
import { FailureDetector, FAILURE_REASONS } from '../js/physics/failure-detector.js';

console.log('Testing Vehicle Dynamics & Wheel Load (Phase 12)...');

const round1 = getRoundConfig(1);

// ---------------------------------------------------------------------------
// 1. Vehicle Movement & Elevation Tracking on Flat Road
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

  const vehicle = new Vehicle({
    id: 1,
    mass: 100,
    speed: 25,
    startX: 0,
    endX: 400
  });

  assert.strictEqual(vehicle.x, 0);
  assert.strictEqual(vehicle.hasEntered, false);
  assert.strictEqual(vehicle.hasCrossed, false);
  assert.strictEqual(vehicle.hasFallen, false);

  // Update vehicle for 1 second (60 steps of 1/60s)
  const dt = 1 / 60;
  for (let i = 0; i < 60; i++) {
    vehicle.update(dt, road, -9.81);
  }

  // At speed 25 m/s, vehicle should travel ~25 meters in 1 second
  assert.strictEqual(vehicle.hasEntered, true);
  assert.ok(Math.abs(vehicle.x - 25) < 1.0, `Vehicle X should be ~25m, got ${vehicle.x}`);
  assert.strictEqual(Math.round(vehicle.y), 600, 'Vehicle elevation should remain at 600m');
  assert.strictEqual(Math.round(vehicle.angle), 0, 'Chassis pitch angle should be 0 on flat road');
}

// ---------------------------------------------------------------------------
// 2. Wheel Weight Load Transmission into Bridge Road Nodes
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

  const vehicle = new Vehicle({
    id: 2,
    mass: 150, // 150 kg mass -> weight = 150 * -9.81 = -1471.5 N
    speed: 25,
    startX: 100
  });

  // Step once
  vehicle.update(1 / 60, road, -9.81);

  // Sum vertical forces received by world nodes
  let totalAppliedForceY = 0;
  for (const node of world.nodes.values()) {
    if (node.forceY < 0) {
      totalAppliedForceY += Math.abs(node.forceY);
    }
  }

  const expectedWeight = 150 * 9.81;
  assert.ok(
    Math.abs(totalAppliedForceY - expectedWeight) < 1.0,
    `Total downward force applied to bridge (${totalAppliedForceY}) must match vehicle weight (${expectedWeight})`
  );
}

// ---------------------------------------------------------------------------
// 3. Successful Crossing Detection
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

  const vehicle = new Vehicle({
    id: 3,
    mass: 50,
    speed: 25,
    startX: 0,
    endX: 400
  });

  // Drive vehicle completely across (400m / 25 m/s = 16 seconds = 960 steps)
  const dt = 1 / 60;
  for (let i = 0; i < 1000; i++) {
    vehicle.update(dt, road, -9.81);
    if (vehicle.hasCrossed) break;
  }

  assert.strictEqual(vehicle.hasCrossed, true, 'Vehicle must successfully complete crossing');
  assert.strictEqual(vehicle.hasFallen, false, 'Vehicle must not fall on intact bridge');
  assert.ok(vehicle.x >= 400, 'Vehicle X must reach or exceed 400m');
}

// ---------------------------------------------------------------------------
// 4. Broken Bridge & Falling Detection
// ---------------------------------------------------------------------------
{
  const graph = new LogicalGraph();
  graph.initEnvironment(round1.cliffs);
  budgetManager.init(round1.budget);

  // Incomplete road only from x=0 to 100 (gap in the middle)
  PieceManager.addPieceTransaction(graph, budgetManager, round1, {
    equation: '600',
    rangeMin: 0,
    rangeMax: 100,
    material: 'road',
    isRoad: true
  });

  const world = PhysicsBridgeBuilder.buildPhysicsWorld(graph);
  const road = new RoadSurface(world);
  const failureDetector = new FailureDetector();

  const vehicle = new Vehicle({
    id: 4,
    mass: 100,
    speed: 25,
    startX: 0,
    endX: 400,
    fallThresholdY: 500
  });

  const dt = 1 / 60;
  for (let i = 0; i < 800; i++) {
    vehicle.update(dt, road, -9.81);
    if (vehicle.hasFallen) break;
  }

  assert.strictEqual(vehicle.hasFallen, true, 'Vehicle driving off incomplete road must be marked as fallen');
  assert.strictEqual(vehicle.hasCrossed, false);
  assert.ok(vehicle.y < 500, 'Vehicle Y must fall below threshold');

  // Check FailureDetector recognizes vehicle fall
  const failRes = failureDetector.check(world, 5.0, [vehicle]);
  assert.strictEqual(failRes.failed, true);
  assert.strictEqual(failRes.failure.reason, FAILURE_REASONS.VEHICLE_FALL);
  assert.strictEqual(failRes.failure.vehicleId, 4);
}

// ---------------------------------------------------------------------------
// 5. Vehicle Angle Alignment on Sloped Terrain (Round 3)
// ---------------------------------------------------------------------------
{
  const round3 = getRoundConfig(3);
  const graph = new LogicalGraph();
  graph.initEnvironment(round3.cliffs);
  budgetManager.init(round3.budget);

  // Linear ramp: y = 0.25*x + 600 (slope = +0.25)
  PieceManager.addPieceTransaction(graph, budgetManager, round3, {
    equation: '0.25*x + 600',
    rangeMin: 0,
    rangeMax: 400,
    material: 'road',
    isRoad: true
  });

  const world = PhysicsBridgeBuilder.buildPhysicsWorld(graph);
  const road = new RoadSurface(world);

  const vehicle = new Vehicle({
    id: 5,
    mass: 100,
    speed: 20,
    startX: 100
  });

  vehicle.update(1 / 60, road, -9.81);

  // Expected angle = atan(0.25) ~ 0.24497 rad
  const expectedAngle = Math.atan(0.25);
  assert.ok(
    Math.abs(vehicle.angle - expectedAngle) < 0.01,
    `Vehicle pitch angle (${vehicle.angle}) should align with road slope (${expectedAngle})`
  );
}

console.log('  PASS: Vehicle Dynamics & Wheel Load (Phase 12) tests');
