// graph-model.test.js - Comprehensive test suite for Logical Graph and Canonical Vertex System

import assert from 'node:assert';
import { LogicalGraph } from '../js/builder/graph-model.js';
import { SNAP_TOLERANCE } from '../js/config/constants.js';

console.log('Testing Logical Graph & Canonical Vertex System...');

// 1. Fixed Support Vertices Initialization
{
  const graph = new LogicalGraph();
  const anchors = [
    { x: 0, y: 600 },
    { x: 400, y: 600 }
  ];
  graph.initEnvironment(anchors);

  assert.strictEqual(graph.vertexCount, 2, 'Graph should have exactly 2 anchor vertices initially');
  assert.strictEqual(graph.fixedVertexIds.size, 2, 'There should be 2 fixed vertices');

  const v1 = graph.findCanonicalVertexAt(0, 600);
  assert.ok(v1, 'Should find anchor at (0, 600)');
  assert.strictEqual(v1.isFixed, true, 'Anchor must be fixed');
}

// 2. Piece Connection to Fixed Support
{
  const graph = new LogicalGraph();
  graph.initEnvironment([{ x: 0, y: 600 }, { x: 400, y: 600 }]);

  // Piece 1 connects to left cliff at (0, 600) and extends to (100, 580)
  const piece1Points = [
    { x: 0, y: 600 },
    { x: 50, y: 590 },
    { x: 100, y: 580 }
  ];

  const res = graph.addPiece({
    id: 1,
    equation: 'linear',
    material: 'steel',
    points: piece1Points
  });

  assert.strictEqual(res.success, true);
  // Total vertices should be: 2 initial anchors + 2 new points = 4 vertices (since (0,600) was reused!)
  assert.strictEqual(graph.vertexCount, 4, 'Anchor (0,600) should be reused, yielding 4 vertices');
  assert.strictEqual(graph.edgeCount, 2, '3 points should form 2 consecutive edges');
  assert.strictEqual(graph.isConnectedToSupports(1), true, 'Piece 1 connects to left support');
}

// 3. Piece-to-Piece Connection & Shared Junction Vertex
{
  const graph = new LogicalGraph();
  graph.initEnvironment([{ x: 0, y: 600 }, { x: 400, y: 600 }]);

  // Piece 1: (0,600) -> (100,580) -> (200,560)
  graph.addPiece({
    id: 1,
    points: [{ x: 0, y: 600 }, { x: 100, y: 580 }, { x: 200, y: 560 }]
  });

  // Piece 2 (attaches at junction (200, 560) and goes up to (200, 650))
  const res2 = graph.addPiece({
    id: 2,
    points: [{ x: 200, y: 560 }, { x: 200, y: 605 }, { x: 200, y: 650 }]
  });

  assert.strictEqual(res2.success, true);

  // Junction check: exactly ONE canonical vertex at (200, 560)
  const junctionVertex = graph.findCanonicalVertexAt(200, 560);
  assert.ok(junctionVertex, 'Junction vertex must exist');
  assert.strictEqual(junctionVertex.connectedPieceIds.size, 2, 'Junction vertex must reference both Piece 1 and Piece 2');
  assert.strictEqual(junctionVertex.connectedPieceIds.has(1), true);
  assert.strictEqual(junctionVertex.connectedPieceIds.has(2), true);

  // Total vertices: anchor(0,600) [1], (100,580) [2], junction(200,560) [3], other anchor(400,600) [4], (200,605) [5], (200,650) [6] => 6 vertices
  assert.strictEqual(graph.vertexCount, 6, 'Total canonical vertices should be 6 with no duplicates');
}

// 4. CRITICAL CONNECTIVITY TEST (Snap tolerance floating-point merging)
{
  const graph = new LogicalGraph(SNAP_TOLERANCE); // 0.05
  graph.initEnvironment([]);

  // Piece A ends at (10.0, 5.0)
  graph.addPiece({
    id: 101,
    points: [{ x: 0, y: 0 }, { x: 10.0, y: 5.0 }]
  });

  // Piece B starts at (10.000001, 5.0) - floating point offset well within SNAP_TOLERANCE (0.05)
  graph.addPiece({
    id: 102,
    points: [{ x: 10.000001, y: 5.0 }, { x: 20.0, y: 10.0 }]
  });

  // MANDATORY SPEC INVARIANT:
  // Expected: EXACTLY ONE canonical logical vertex at junction, total 3 canonical vertices for the whole line.
  // NOT 4 vertices.
  assert.strictEqual(
    graph.vertexCount,
    3,
    'CRITICAL: Piece A (10.0, 5.0) and Piece B (10.000001, 5.0) must merge into ONE canonical vertex (total 3 vertices)'
  );

  const sharedVertex = graph.findCanonicalVertexAt(10.0, 5.0);
  assert.ok(sharedVertex, 'Shared vertex must be found at junction');
  assert.strictEqual(sharedVertex.connectedPieceIds.size, 2, 'Shared vertex must belong to both pieces');
}

// 5. Disconnected Piece Detection
{
  const graph = new LogicalGraph();
  graph.initEnvironment([{ x: 0, y: 600 }, { x: 400, y: 600 }]);

  // Piece floating in mid-air at (200, 300) -> (250, 300)
  graph.addPiece({
    id: 99,
    points: [{ x: 200, y: 300 }, { x: 250, y: 300 }]
  });

  assert.strictEqual(graph.isConnectedToSupports(99), false, 'Floating piece must NOT be connected to supports');

  const components = graph.getConnectedComponents();
  assert.strictEqual(components.length, 3, 'There should be 3 separate components (2 isolated anchors + 1 floating piece)');
}

// 6. Piece Deletion and Garbage Collection of Unreferenced Vertices
{
  const graph = new LogicalGraph();
  graph.initEnvironment([{ x: 0, y: 600 }, { x: 400, y: 600 }]);

  graph.addPiece({
    id: 1,
    points: [{ x: 0, y: 600 }, { x: 50, y: 550 }, { x: 100, y: 500 }]
  });
  assert.strictEqual(graph.vertexCount, 4);

  const removeRes = graph.removePiece(1);
  assert.strictEqual(removeRes.success, true);
  assert.strictEqual(graph.pieceCount, 0);
  assert.strictEqual(graph.edgeCount, 0);
  // Non-fixed vertices (50,550) and (100,500) must be garbage-collected, leaving only the 2 fixed anchors
  assert.strictEqual(graph.vertexCount, 2, 'Deleting piece should clean up non-fixed vertices, leaving 2 fixed anchors');
}

console.log('  PASS: Logical Graph & Canonical Vertex tests');
