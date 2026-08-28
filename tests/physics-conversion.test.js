// physics-conversion.test.js - Automated tests for Phase 9: Graph to Physics Conversion

import assert from 'node:assert';
import { LogicalGraph } from '../js/builder/graph-model.js';
import { PieceManager } from '../js/builder/piece-manager.js';
import { budgetManager } from '../js/economy/budget.js';
import { getRoundConfig } from '../js/config/round-config.js';
import { PhysicsBridgeBuilder } from '../js/physics/physics-bridge-builder.js';
import { PhysicsWorld } from '../js/physics/physics-world.js';
import { PhysicsNode } from '../js/physics/physics-node.js';
import { StructuralConstraint } from '../js/physics/structural-constraint.js';

console.log('Testing Graph to Physics Conversion (Phase 9)...');

const round1 = getRoundConfig(1);

// ---------------------------------------------------------------------------
// 1. Invariant: 1 Canonical Vertex = Exactly 1 Physics Node
// ---------------------------------------------------------------------------
{
  const graph = new LogicalGraph();
  graph.initEnvironment(round1.cliffs);
  budgetManager.init(round1.budget);

  // Piece 1: Straight road from 0 to 200 at y=600
  const p1 = PieceManager.addPieceTransaction(graph, budgetManager, round1, {
    equation: '600',
    rangeMin: 0,
    rangeMax: 200,
    material: 'road',
    isRoad: true
  });
  assert.strictEqual(p1.success, true);

  // Piece 2: Arch meeting at (200, 600)
  const p2 = PieceManager.addPieceTransaction(graph, budgetManager, round1, {
    equation: '600',
    rangeMin: 200,
    rangeMax: 400,
    material: 'road',
    isRoad: true
  });
  assert.strictEqual(p2.success, true);

  // Verify that the junction (200, 600) is a single canonical vertex
  const junctionVertex = graph.findCanonicalVertexAt(200, 600);
  assert.ok(junctionVertex, 'Junction canonical vertex must exist');

  // Convert graph to physics
  const world = PhysicsBridgeBuilder.buildPhysicsWorld(graph);

  // Assert 1:1 node mapping
  assert.strictEqual(world.nodeCount, graph.vertexCount, 'Physics node count must equal logical canonical vertex count exactly');
  assert.strictEqual(world.constraintCount, graph.edgeCount, 'Physics constraint count must equal logical edge count exactly');

  // Assert junction node exists as exactly 1 physics node
  const physicsJunctionNode = world.getNode(junctionVertex.id);
  assert.ok(physicsJunctionNode, 'Junction physics node must exist in world');
  assert.strictEqual(physicsJunctionNode.initialX, 200);
  assert.strictEqual(physicsJunctionNode.initialY, 600);
  assert.strictEqual(physicsJunctionNode.isFixed, false);
}

// ---------------------------------------------------------------------------
// 2. Fixed Anchor Vertices mapped to Static Anchors (invMass === 0)
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

  const leftAnchorNode = world.getNode('v_1'); // Fixed cliff anchor at (0, 600)
  const rightAnchorNode = world.getNode('v_2'); // Fixed cliff anchor at (400, 600)

  assert.ok(leftAnchorNode, 'Left anchor physics node must exist');
  assert.ok(rightAnchorNode, 'Right anchor physics node must exist');
  assert.strictEqual(leftAnchorNode.isFixed, true, 'Left anchor must be fixed');
  assert.strictEqual(rightAnchorNode.isFixed, true, 'Right anchor must be fixed');
  assert.strictEqual(leftAnchorNode.invMass, 0, 'Fixed anchor invMass must be 0');
  assert.strictEqual(rightAnchorNode.invMass, 0, 'Fixed anchor invMass must be 0');
  assert.strictEqual(leftAnchorNode.mass, Infinity, 'Fixed anchor mass must be Infinity');
}

// ---------------------------------------------------------------------------
// 3. Dynamic Nodes have Valid Lumped Masses and invMass
// ---------------------------------------------------------------------------
{
  const graph = new LogicalGraph();
  graph.initEnvironment(round1.cliffs);
  budgetManager.init(round1.budget);

  PieceManager.addPieceTransaction(graph, budgetManager, round1, {
    equation: '600',
    rangeMin: 0,
    rangeMax: 100,
    material: 'steel'
  });

  const world = PhysicsBridgeBuilder.buildPhysicsWorld(graph);

  for (const node of world.nodes.values()) {
    if (!node.isFixed) {
      assert.ok(node.mass > 0, 'Dynamic node must have positive mass');
      assert.ok(node.invMass > 0, 'Dynamic node must have positive invMass');
      assert.strictEqual(node.invMass, 1 / node.mass, 'invMass must equal 1 / mass');
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Constraints have Valid Rest Lengths, Materials, and Stress Calculators
// ---------------------------------------------------------------------------
{
  const graph = new LogicalGraph();
  graph.initEnvironment(round1.cliffs);
  budgetManager.init(round1.budget);

  PieceManager.addPieceTransaction(graph, budgetManager, round1, {
    equation: '600',
    rangeMin: 0,
    rangeMax: 100,
    material: 'concrete'
  });

  const world = PhysicsBridgeBuilder.buildPhysicsWorld(graph);

  for (const constraint of world.constraints.values()) {
    assert.ok(constraint.restLength > 0, 'Rest length must be positive');
    assert.strictEqual(constraint.materialKey, 'concrete', 'Constraint material must match piece');
    assert.strictEqual(constraint.isBroken, false, 'Initial constraint must not be broken');
    assert.strictEqual(constraint.calculateStress(), 0, 'Resting constraint stress must be 0.0');
  }
}

// ---------------------------------------------------------------------------
// 5. Road Segments Sorted West-to-East
// ---------------------------------------------------------------------------
{
  const graph = new LogicalGraph();
  graph.initEnvironment(round1.cliffs);
  budgetManager.init(round1.budget);

  // Add road in segments
  PieceManager.addPieceTransaction(graph, budgetManager, round1, {
    equation: '600',
    rangeMin: 200,
    rangeMax: 400,
    material: 'road',
    isRoad: true
  });
  PieceManager.addPieceTransaction(graph, budgetManager, round1, {
    equation: '600',
    rangeMin: 0,
    rangeMax: 200,
    material: 'road',
    isRoad: true
  });

  const world = PhysicsBridgeBuilder.buildPhysicsWorld(graph);

  assert.ok(world.roadSegments.length > 0, 'Road segments must be registered in physics world');

  // Verify monotonic increasing X ordering of road segments
  for (let i = 1; i < world.roadSegments.length; i++) {
    const prevMinX = Math.min(world.roadSegments[i - 1].nodeA.initialX, world.roadSegments[i - 1].nodeB.initialX);
    const currMinX = Math.min(world.roadSegments[i].nodeA.initialX, world.roadSegments[i].nodeB.initialX);
    assert.ok(currMinX >= prevMinX, 'Road segments must be sorted monotonically from West to East');
  }
}

// ---------------------------------------------------------------------------
// 6. Node Reset and Rest State Verification
// ---------------------------------------------------------------------------
{
  const node = new PhysicsNode('test_1', 50, 100, false, 5.0);
  node.x = 75; // Simulate displacement
  node.y = 120;
  node.prevX = 70;
  node.prevY = 115;
  node.applyForce(10, -5);

  assert.strictEqual(node.vx, 5);
  assert.strictEqual(node.vy, 5);
  assert.strictEqual(node.forceX, 10);
  assert.strictEqual(node.forceY, -5);

  node.reset();
  assert.strictEqual(node.x, 50);
  assert.strictEqual(node.y, 100);
  assert.strictEqual(node.prevX, 50);
  assert.strictEqual(node.prevY, 100);
  assert.strictEqual(node.vx, 0);
  assert.strictEqual(node.vy, 0);
  assert.strictEqual(node.forceX, 0);
  assert.strictEqual(node.forceY, 0);
}

console.log('  PASS: Graph to Physics Conversion (Phase 9) tests');
