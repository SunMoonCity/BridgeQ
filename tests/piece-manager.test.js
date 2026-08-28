// piece-manager.test.js - Comprehensive test suite for PieceManager atomic transactions

import assert from 'node:assert';
import { LogicalGraph } from '../js/builder/graph-model.js';
import { budgetManager } from '../js/economy/budget.js';
import { PieceManager } from '../js/builder/piece-manager.js';
import { getRoundConfig } from '../js/config/round-config.js';

console.log('Testing Piece Manager & Atomic Build Transactions...');

const round1 = getRoundConfig(1);

// 1. Successful Piece Creation Transaction
{
  const graph = new LogicalGraph();
  graph.initEnvironment(round1.cliffs);
  budgetManager.init(5000);

  const res = PieceManager.addPieceTransaction(graph, budgetManager, round1, {
    equation: '600', // Constant road beam from cliff to cliff
    orientation: 'y-of-x',
    rangeMin: 0,
    rangeMax: 100,
    material: 'steel',
    isRoad: true
  });

  assert.strictEqual(res.success, true, 'Valid piece transaction must succeed');
  assert.ok(res.cost > 0, 'Cost must be calculated');
  assert.strictEqual(graph.pieceCount, 1, 'Graph should have 1 piece');
  assert.strictEqual(budgetManager.getSpent(), res.cost, 'Spent budget should equal piece cost');
  assert.strictEqual(budgetManager.getRemaining(), 5000 - res.cost, 'Remaining budget must match');
}

// 2. Unaffordable Piece Rejection (Atomic Invariant: Graph and Budget MUST remain unchanged)
{
  const graph = new LogicalGraph();
  graph.initEnvironment(round1.cliffs);
  budgetManager.init(100); // Small budget of 100

  const initialGraphPieceCount = graph.pieceCount;
  const initialGraphVertexCount = graph.vertexCount;
  const initialSpent = budgetManager.getSpent();

  // Try to place a long expensive beam (400m steel = ~6,000)
  const res = PieceManager.addPieceTransaction(graph, budgetManager, round1, {
    equation: '600',
    rangeMin: 0,
    rangeMax: 400,
    material: 'steel'
  });

  assert.strictEqual(res.success, false, 'Unaffordable piece must be rejected');
  assert.ok(res.error.includes('Insufficient budget'));

  // ATOMIC ROLLBACK VERIFICATION
  assert.strictEqual(graph.pieceCount, initialGraphPieceCount, 'Graph pieces must remain unchanged');
  assert.strictEqual(graph.vertexCount, initialGraphVertexCount, 'Graph vertices must remain unchanged');
  assert.strictEqual(budgetManager.getSpent(), initialSpent, 'Budget spent must remain unchanged');
}

// 3. Invalid Syntax Rejection (Atomic Rollback)
{
  const graph = new LogicalGraph();
  graph.initEnvironment(round1.cliffs);
  budgetManager.init(10000);

  const initialSpent = budgetManager.getSpent();

  const res = PieceManager.addPieceTransaction(graph, budgetManager, round1, {
    equation: '2*x + (unclosed',
    rangeMin: 0,
    rangeMax: 100,
    material: 'wood'
  });

  assert.strictEqual(res.success, false, 'Invalid syntax must fail transaction');
  assert.strictEqual(graph.pieceCount, 0, 'No piece committed');
  assert.strictEqual(budgetManager.getSpent(), initialSpent, 'Zero budget deducted');
}

// 4. Out-of-Bounds Rejection (Atomic Rollback)
{
  const graph = new LogicalGraph();
  graph.initEnvironment(round1.cliffs);
  budgetManager.init(10000);

  // yMax is 800 in round1, this goes to y = 900
  const res = PieceManager.addPieceTransaction(graph, budgetManager, round1, {
    equation: '900',
    rangeMin: 0,
    rangeMax: 100,
    material: 'wood'
  });

  assert.strictEqual(res.success, false, 'Out-of-bounds piece must be rejected');
  assert.strictEqual(graph.pieceCount, 0, 'No piece committed');
}

// 5. Piece Deletion with Exact Refund
{
  const graph = new LogicalGraph();
  graph.initEnvironment(round1.cliffs);
  budgetManager.init(10000);

  const addRes = PieceManager.addPieceTransaction(graph, budgetManager, round1, {
    equation: '600',
    rangeMin: 0,
    rangeMax: 100,
    material: 'concrete'
  });
  assert.strictEqual(addRes.success, true);
  const cost = addRes.cost;
  const pieceId = addRes.piece.id;

  assert.strictEqual(budgetManager.getSpent(), cost);

  // Delete piece
  const delRes = PieceManager.deletePieceTransaction(graph, budgetManager, pieceId);
  assert.strictEqual(delRes.success, true, 'Delete transaction must succeed');
  assert.strictEqual(delRes.refunded, cost, 'Refunded amount must equal original cost');
  assert.strictEqual(budgetManager.getSpent(), 0, 'Budget spent must reset to 0');
  assert.strictEqual(budgetManager.getRemaining(), 10000, 'Budget remaining must return to 10000');
  assert.strictEqual(graph.pieceCount, 0, 'Piece must be removed from graph');
}

console.log('  PASS: Piece Manager & Atomic Build Transaction tests');
