// validator.test.js - Comprehensive test suite for Phase 8 BridgeValidator

import assert from 'node:assert';
import { LogicalGraph } from '../js/builder/graph-model.js';
import { budgetManager } from '../js/economy/budget.js';
import { PieceManager } from '../js/builder/piece-manager.js';
import { BridgeValidator } from '../js/builder/validator.js';
import { getRoundConfig } from '../js/config/round-config.js';

console.log('Testing Bridge Validator (Phase 8 Pre-Flight Finalization)...');

const round1 = getRoundConfig(1);

// 1. Empty Bridge Validation Fails
{
  const graph = new LogicalGraph();
  graph.initEnvironment(round1.cliffs);
  budgetManager.init(round1.budget);

  const res = BridgeValidator.validate(graph, budgetManager, round1);
  assert.strictEqual(res.valid, false, 'Empty graph must fail validation');
  assert.ok(res.errors.some(e => e.includes('No bridge pieces constructed')));
}

// 2. Disconnected Floating Piece Fails
{
  const graph = new LogicalGraph();
  graph.initEnvironment(round1.cliffs);
  budgetManager.init(round1.budget);

  // Floating beam in the middle that does not touch cliff anchors (100 to 200 at y=500)
  PieceManager.addPieceTransaction(graph, budgetManager, round1, {
    equation: '500',
    rangeMin: 100,
    rangeMax: 200,
    material: 'steel'
  });

  const res = BridgeValidator.validate(graph, budgetManager, round1);
  assert.strictEqual(res.valid, false, 'Floating disconnected piece must fail validation');
  assert.ok(res.errors.some(e => e.includes('Disconnected floating structure')));
}

// 3. Piece Connected to Only One Cliff Support Fails Span Requirement
{
  const graph = new LogicalGraph();
  graph.initEnvironment(round1.cliffs);
  budgetManager.init(round1.budget);

  // Road starting at left cliff (x=0, y=600) but only extending to x=200
  PieceManager.addPieceTransaction(graph, budgetManager, round1, {
    equation: '600',
    rangeMin: 0,
    rangeMax: 200,
    material: 'road',
    isRoad: true
  });

  const res = BridgeValidator.validate(graph, budgetManager, round1);
  assert.strictEqual(res.valid, false, 'Bridge that does not reach both cliffs must fail');
  assert.ok(res.errors.some(e => e.includes('Bridge structure does not span across to all required cliff anchors') || e.includes('Road deck is not continuous')));
}

// 4. Fully Connected Steel Truss Without Road Fails Road Requirement
{
  const graph = new LogicalGraph();
  graph.initEnvironment(round1.cliffs);
  budgetManager.init(round1.budget);

  // Steel beam across 0 to 400 at y=600 (not road)
  PieceManager.addPieceTransaction(graph, budgetManager, round1, {
    equation: '600',
    rangeMin: 0,
    rangeMax: 400,
    material: 'steel',
    isRoad: false
  });

  const res = BridgeValidator.validate(graph, budgetManager, round1);
  assert.strictEqual(res.valid, false, 'Bridge without road deck must fail validation');
  assert.ok(res.errors.some(e => e.includes('No road deck pieces constructed')));
}

// 5. Valid Bridge (Continuous Road + Structural Supports) Passes Validation
{
  const graph = new LogicalGraph();
  graph.initEnvironment(round1.cliffs);
  budgetManager.init(round1.budget);

  // Continuous Road Deck (0 to 400 at y=600)
  const roadRes = PieceManager.addPieceTransaction(graph, budgetManager, round1, {
    equation: '600',
    rangeMin: 0,
    rangeMax: 400,
    material: 'road',
    isRoad: true
  });
  assert.strictEqual(roadRes.success, true);

  // Structural Support Arch Below Road (0 to 400 at y = 0.002*(x-200)^2 + 520)
  // At x=0: 0.002*40000 + 520 = 80 + 520 = 600 (snaps to west cliff anchor)
  // At x=400: 0.002*40000 + 520 = 600 (snaps to east cliff anchor)
  const archRes = PieceManager.addPieceTransaction(graph, budgetManager, round1, {
    equation: '0.002*(x - 200)^2 + 520',
    rangeMin: 0,
    rangeMax: 400,
    material: 'steel'
  });
  assert.strictEqual(archRes.success, true);

  const res = BridgeValidator.validate(graph, budgetManager, round1);
  assert.strictEqual(res.valid, true, 'Complete bridge with continuous road and supports must pass');
  assert.strictEqual(res.errors.length, 0);
  assert.ok(res.summary);
  assert.strictEqual(res.summary.pieceCount, 2);
  assert.ok(res.summary.roadEdgeCount > 0);
  assert.strictEqual(res.summary.fixedVertexIds.length, 2);
}

// 6. Budget Exceeded Failure Check
{
  const graph = new LogicalGraph();
  graph.initEnvironment(round1.cliffs);
  budgetManager.init(1000000);

  // Road across
  PieceManager.addPieceTransaction(graph, budgetManager, round1, {
    equation: '600',
    rangeMin: 0,
    rangeMax: 400,
    material: 'road',
    isRoad: true
  });

  // Artificially exceed budget limit
  budgetManager.totalBudget = 100;

  const res = BridgeValidator.validate(graph, budgetManager, round1);
  assert.strictEqual(res.valid, false, 'Validation must fail if budget is exceeded');
  assert.ok(res.errors.some(e => e.includes('Budget exceeded')));
}

console.log('  PASS: Bridge Validator (Phase 8 Pre-Flight Finalization) tests');
