// piece-manager.js - Atomic piece transactions (add, delete, budget verification, and rollback)

import { parseEquation } from './equation-parser.js';
import { sampleEquation } from './sampler.js';
import { isValidMaterial } from '../config/materials.js';
import { eventBus } from '../core/event-bus.js';
import { EVENTS } from '../config/constants.js';

export class PieceManager {
  /**
   * Execute an atomic piece creation transaction
   * @param {LogicalGraph} graph
   * @param {BudgetManager} budgetManager
   * @param {object} roundConfig
   * @param {object} inputParams - { equation, orientation, rangeMin, rangeMax, material, isRoad }
   * @returns {{ success: boolean, piece?: object, error?: string, cost?: number }}
   */
  static addPieceTransaction(graph, budgetManager, roundConfig, {
    equation,
    orientation = 'y-of-x',
    rangeMin,
    rangeMax,
    material = 'steel',
    isRoad = false
  }) {
    // 1. Validate Material
    if (!isValidMaterial(material)) {
      return { success: false, error: `Invalid or unknown material: '${material}'.` };
    }

    // 2. Determine variable name based on orientation
    const varName = orientation === 'x-of-y' ? 'y' : 'x';

    // 3. Parse Equation safely
    const parseResult = parseEquation(equation, varName);
    if (!parseResult.success) {
      return { success: false, error: parseResult.error };
    }

    // 4. Sample Geometry with bounds validation
    const resolution = (roundConfig && roundConfig.sampleResolution) || 0.5;
    const bounds = roundConfig ? roundConfig.allowedRegion : null;

    const sampleResult = sampleEquation(
      parseResult.evaluate,
      rangeMin,
      rangeMax,
      orientation,
      resolution,
      bounds
    );

    if (!sampleResult.success) {
      return { success: false, error: sampleResult.error };
    }

    // 5. Calculate Cost
    const costCalc = budgetManager.calculatePieceCost(sampleResult.points, material);
    if (costCalc.cost <= 0) {
      return { success: false, error: 'Calculated piece cost is zero or invalid.' };
    }

    // 6. Check Budget Affordability
    if (!budgetManager.canAfford(costCalc.cost)) {
      return {
        success: false,
        error: `Insufficient budget: piece costs ₹${costCalc.cost.toFixed(0)}, but only ₹${budgetManager.getRemaining().toFixed(0)} remains.`,
        cost: costCalc.cost
      };
    }

    // 7. Generate Piece ID and Charge Budget
    const nextPieceId = (graph.pieceIdCounter || 0) + 1;
    const chargeResult = budgetManager.charge(nextPieceId, costCalc.cost);
    if (!chargeResult.success) {
      return { success: false, error: chargeResult.error };
    }
    
    // 8. Commit Piece to Logical Graph
    const graphResult = graph.addPiece({
      id: nextPieceId,
      equation,
      orientation,
      domain: [rangeMin, rangeMax],
      material,
      isRoad: isRoad || material === 'road',
      points: sampleResult.points,
      cost: costCalc.cost
    });
    

    // 9. Atomic Rollback if graph commit fails
    if (!graphResult.success) {
      budgetManager.refund(nextPieceId);
      return { success: false, error: graphResult.error };
    }

    // 10. Emit Event
    eventBus.emit(EVENTS.PIECE_PLOTTED, {
      piece: graphResult.piece,
      cost: costCalc.cost,
      spent: budgetManager.getSpent(),
      remaining: budgetManager.getRemaining()
    });

    return {
      success: true,
      piece: graphResult.piece,
      cost: costCalc.cost,
      spent: budgetManager.getSpent(),
      remaining: budgetManager.getRemaining()
    };
  }

  /**
   * Execute an atomic piece deletion transaction with refund
   * @param {LogicalGraph} graph
   * @param {BudgetManager} budgetManager
   * @param {number} pieceId
   * @returns {{ success: boolean, removedPiece?: object, error?: string, refunded?: number }}
   */
  static deletePieceTransaction(graph, budgetManager, pieceId) {
    if (!graph.pieces.has(pieceId)) {
      return { success: false, error: `Piece ID ${pieceId} does not exist in graph.` };
    }

    const removeResult = graph.removePiece(pieceId);
    if (!removeResult.success) {
      return { success: false, error: removeResult.error };
    }

    // Refund cost
    const refundResult = budgetManager.refund(pieceId);
    const refunded = refundResult.success ? refundResult.refunded : 0;

    eventBus.emit(EVENTS.PIECE_DELETED, {
      pieceId,
      refunded,
      spent: budgetManager.getSpent(),
      remaining: budgetManager.getRemaining()
    });

    return {
      success: true,
      removedPiece: removeResult.removedPiece,
      refunded,
      spent: budgetManager.getSpent(),
      remaining: budgetManager.getRemaining()
    };
  }
}
