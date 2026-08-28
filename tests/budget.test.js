// budget.test.js - Unit tests for BudgetManager and arc length cost calculations

import assert from 'node:assert';
import { budgetManager } from '../js/economy/budget.js';

console.log('Testing Budget Manager...');

// 1. Initialize budget
budgetManager.init(1000);
assert.strictEqual(budgetManager.getTotalBudget(), 1000, 'Total budget should be 1000');
assert.strictEqual(budgetManager.getSpent(), 0, 'Spent should start at 0');
assert.strictEqual(budgetManager.getRemaining(), 1000, 'Remaining should start at 1000');

// 2. Arc length cost calculation: straight line from (0,0) to (30,40) => length 50
const straightSegment = [
  { x: 0, y: 0 },
  { x: 30, y: 40 }
];

const steelCost = budgetManager.calculatePieceCost(straightSegment, 'steel');
// Steel costs 15 per unit => 50 * 15 = 750
assert.strictEqual(steelCost.length, 50, 'Arc length of (0,0)-(30,40) should be 50');
assert.strictEqual(steelCost.cost, 750, 'Cost of 50 units steel should be 750');

// 3. Charge piece within budget
const chargeResult1 = budgetManager.charge('piece_1', steelCost.cost);
assert.strictEqual(chargeResult1.success, true, 'Charging affordable piece should succeed');
assert.strictEqual(budgetManager.getSpent(), 750, 'Spent should be 750');
assert.strictEqual(budgetManager.getRemaining(), 250, 'Remaining should be 250');

// 4. Charge piece exceeding budget
const chargeResult2 = budgetManager.charge('piece_2', 300);
assert.strictEqual(chargeResult2.success, false, 'Charging unaffordable piece should fail');
assert.strictEqual(budgetManager.getSpent(), 750, 'Spent should remain 750 after rejected charge');

// 5. Refund piece
const refundResult = budgetManager.refund('piece_1');
assert.strictEqual(refundResult.success, true, 'Refund should succeed');
assert.strictEqual(budgetManager.getSpent(), 0, 'Spent should be 0 after refund');
assert.strictEqual(budgetManager.getRemaining(), 1000, 'Remaining should be 1000 after refund');

console.log('  PASS: Budget tests');
