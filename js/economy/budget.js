// budget.js - Budget ledger and cost management

import { eventBus } from '../core/event-bus.js';
import { EVENTS } from '../config/constants.js';
import { getMaterial } from '../config/materials.js';

class BudgetManager {
  constructor() {
    this.totalBudget = 0;
    this.spent = 0;
    this.ledger = new Map(); // pieceId -> cost
  }

  init(budgetLimit) {
    this.totalBudget = typeof budgetLimit === 'number' ? budgetLimit : 0;
    this.spent = 0;
    this.ledger.clear();
    this.emitChange();
  }

  getSpent() {
    return this.spent;
  }

  getRemaining() {
    return Math.max(0, this.totalBudget - this.spent);
  }

  getRemainingBudget() {
    return this.getRemaining();
  }

  getTotalBudget() {
    return this.totalBudget;
  }

  canAfford(cost) {
    return this.totalBudget <= 0 || (this.spent + cost <= this.totalBudget);
  }

  calculatePieceCost(sampledPoints, materialKey) {
    if (!Array.isArray(sampledPoints) || sampledPoints.length < 2) {
      return { cost: 0, length: 0 };
    }

    const mat = getMaterial(materialKey);
    const costPerUnit = mat ? mat.costPerUnit : 10;

    let length = 0;
    for (let i = 1; i < sampledPoints.length; i++) {
      const dx = sampledPoints[i].x - sampledPoints[i - 1].x;
      const dy = sampledPoints[i].y - sampledPoints[i - 1].y;
      length += Math.sqrt(dx * dx + dy * dy);
    }

    return {
      cost: length * costPerUnit,
      length
    };
  }

  charge(pieceId, cost) {
    if (this.ledger.has(pieceId)) {
      return { success: false, error: 'Piece ID already exists in ledger.' };
    }

    if (!this.canAfford(cost)) {
      return {
        success: false,
        error: `Insufficient budget: piece costs ₹${cost.toFixed(0)}, remaining ₹${this.getRemaining().toFixed(0)}.`
      };
    }

    this.ledger.set(pieceId, cost);
    this.spent += cost;
    this.emitChange();
    return { success: true, spent: this.spent, remaining: this.getRemaining() };
  }

  refund(pieceId) {
    if (!this.ledger.has(pieceId)) {
      return { success: false, error: 'No charge on record for this piece ID.' };
    }

    const cost = this.ledger.get(pieceId);
    this.ledger.delete(pieceId);
    this.spent -= cost;
    this.emitChange();
    return { success: true, refunded: cost, spent: this.spent, remaining: this.getRemaining() };
  }

  emitChange() {
    eventBus.emit(EVENTS.BUDGET_CHANGED, {
      total: this.totalBudget,
      spent: this.spent,
      remaining: this.getRemaining()
    });
  }
}

export const budgetManager = new BudgetManager();
