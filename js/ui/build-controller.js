// build-controller.js - Wires all Build Phase UI controls to PieceManager and BridgeRenderer
//
// Responsibilities:
//   1. Read equation, orientation, domain bounds, and material from the construction card inputs.
//   2. Call PieceManager.addPieceTransaction() on "Plot Piece" click.
//   3. Detect canvas clicks to select the nearest visible piece.
//   4. Call PieceManager.deletePieceTransaction() on "Delete" click.
//   5. Fire toast notifications for errors and successes.
//   6. Trigger character dialogue reactions.
//   7. Emit EVENTS.NOTIFICATION for any module to respond.

import { PieceManager } from '../builder/piece-manager.js';
import { BridgeValidator } from '../builder/validator.js';
import { eventBus } from '../core/event-bus.js';
import { gameState } from '../core/game-state.js';
import { timer } from '../core/timer.js';
import { EVENTS, GAME_STATES } from '../config/constants.js';

/** Euclidean distance between two points */
function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export class BuildController {
  /**
   * @param {object} deps - Injected dependencies
   * @param {import('../builder/graph-model.js').LogicalGraph}  deps.graph
   * @param {import('../economy/budget.js').BudgetManager}      deps.budgetManager
   * @param {import('../ui/renderer.js').BridgeRenderer}        deps.renderer
   * @param {object}                                            deps.roundConfig
   * @param {import('../ui/character.js').CharacterSystem}      deps.character
   */
  constructor({ graph, budgetManager, renderer, roundConfig, character }) {
    this.graph = graph;
    this.budgetManager = budgetManager;
    this.renderer = renderer;
    this.roundConfig = roundConfig;
    this.character = character;

    // Currently selected piece ID (null = nothing selected)
    this.selectedPieceId = null;

    // Canvas click selection threshold in screen pixels
    this.CLICK_SELECT_RADIUS_PX = 14;

    // DOM element references — populated in init()
    this.btnPlot = null;
    this.btnDelete = null;
    this.btnTest = null;
    this.eqInput = null;
    this.rangeMin = null;
    this.rangeMax = null;
    this.materialPicker = null;
    this.btnOrientY = null;
    this.btnOrientX = null;
    this.canvas = null;
  }

  /** Wire all DOM event listeners. Call once after DOMContentLoaded. */
  init() {
    this.btnPlot    = document.getElementById('btnPlot');
    this.btnDelete  = document.getElementById('btnDeleteSelected');
    this.btnTest    = document.getElementById('btnTestBridge');
    this.eqInput    = document.getElementById('eqInput');
    this.rangeMin   = document.getElementById('rangeMin');
    this.rangeMax   = document.getElementById('rangeMax');
    this.materialPicker = document.getElementById('materialPicker');
    this.btnOrientY = document.getElementById('btnOrientY');
    this.btnOrientX = document.getElementById('btnOrientX');
    this.canvas     = document.getElementById('gameCanvas');

    if (this.btnPlot)   this.btnPlot.addEventListener('click',   () => this.handlePlot());
    if (this.btnDelete) this.btnDelete.addEventListener('click', () => this.handleDelete());
    if (this.btnTest)   this.btnTest.addEventListener('click',   () => this.handleTestBridge());

    if (this.canvas) {
      this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
    }

    // Keyboard shortcut: Enter in equation box → Plot
    if (this.eqInput) {
      this.eqInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.handlePlot();
      });
    }
  }

  // ---------------------------------------------------------------------------
  // UI Helpers
  // ---------------------------------------------------------------------------

  /** Return the currently active orientation string */
  getOrientation() {
    if (this.btnOrientX && this.btnOrientX.classList.contains('active')) {
      return 'x-of-y';
    }
    return 'y-of-x';
  }

  /** Return the currently selected material key */
  getSelectedMaterial() {
    if (!this.materialPicker) return 'steel';
    const sel = this.materialPicker.querySelector('.material-option.selected');
    return sel ? sel.dataset.material : 'steel';
  }

  /** Show/hide the Delete button and sync renderer highlight */
  setSelectedPiece(pieceId) {
    this.selectedPieceId = pieceId;
    if (this.renderer) this.renderer.setSelectedPiece(pieceId);

    if (this.btnDelete) {
      this.btnDelete.style.display = pieceId !== null ? 'block' : 'none';
    }
  }

  /** Emit a NOTIFICATION event (picked up by ToastManager) */
  notify(message, type = 'info') {
    eventBus.emit(EVENTS.NOTIFICATION, { message, type });
  }

  // ---------------------------------------------------------------------------
  // Plot Piece
  // ---------------------------------------------------------------------------

  handlePlot() {
    const equation = this.eqInput ? this.eqInput.value.trim() : '';
    if (!equation) {
      this.notify('Please enter an equation before plotting.', 'warning');
      return;
    }

    const orientation = this.getOrientation();
    const material    = this.getSelectedMaterial();
    const rangeMin    = parseFloat(this.rangeMin ? this.rangeMin.value : '0');
    const rangeMax    = parseFloat(this.rangeMax ? this.rangeMax.value : '400');
    const isRoad      = material === 'road';
    if (isNaN(rangeMin) || isNaN(rangeMax)) {
      this.notify('Domain bounds must be valid numbers.', 'error');
      return;
    }
    if (rangeMin >= rangeMax) {
      this.notify('Min bound must be less than Max bound.', 'error');
      return;
    }
    const result = PieceManager.addPieceTransaction(
      this.graph,
      this.budgetManager,
      this.roundConfig,
      { equation, orientation, rangeMin, rangeMax, material, isRoad }
    );

    if (result.success) {
      const costStr = `₹${Math.round(result.cost).toLocaleString('en-IN')}`;
      const remStr  = `₹${Math.round(result.remaining).toLocaleString('en-IN')}`;
      this.notify(`Piece plotted! Cost: ${costStr} | Remaining: ${remStr}`, 'success');
      this.setSelectedPiece(null); // deselect previous

      // Vary Brij Bhushan's dialogue based on budget remaining
      const remainPct = result.remaining / this.budgetManager.getTotalBudget();
      if (this.character) {
        if (remainPct < 0.15) {
          this.character.setEmotion('😰');
          this.character.say(`Budget is critically low — only ${remStr} left! Plan carefully.`);
        } else if (remainPct < 0.35) {
          this.character.setEmotion('🤔');
          this.character.say(`Piece plotted! ${remStr} remaining. Make each piece count.`);
        } else {
          this.character.setEmotion('🙂');
          this.character.say(`Nice curve! ${remStr} still in the budget. Keep building!`);
        }
      }
    } else {
      this.notify(result.error || 'Failed to plot piece.', 'error');
      if (this.character) {
        this.character.setEmotion('😐');
        this.character.say(`Hmm, that didn't work: ${result.error}`);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Delete Selected Piece
  // ---------------------------------------------------------------------------

  handleDelete() {
    if (this.selectedPieceId === null) {
      this.notify('No piece selected. Click a bridge member first.', 'warning');
      return;
    }

    const result = PieceManager.deletePieceTransaction(
      this.graph,
      this.budgetManager,
      this.selectedPieceId
    );

    if (result.success) {
      const refStr = `₹${Math.round(result.refunded).toLocaleString('en-IN')}`;
      this.notify(`Piece removed. Refunded ${refStr}.`, 'info');
      this.setSelectedPiece(null);

      if (this.character) {
        this.character.setEmotion('🤔');
        this.character.say(`Piece removed and ${refStr} refunded. Redesign time!`);
      }
    } else {
      this.notify(result.error || 'Failed to delete piece.', 'error');
    }
  }

  // ---------------------------------------------------------------------------
  // Canvas Click — Piece Selection
  // ---------------------------------------------------------------------------

  handleCanvasClick(e) {
    if (!this.renderer || !this.graph) return;

    const rect = this.canvas.getBoundingClientRect();
    const clickSX = e.clientX - rect.left;
    const clickSY = e.clientY - rect.top;

    // Convert to world coordinates using viewport
    const vp = this.renderer.viewport;
    const clickWorld = vp.screenToWorld(clickSX, clickSY);

    // Find the nearest piece edge midpoint within selection radius
    let bestPieceId = null;
    let bestDist = Infinity;

    for (const [edgeId, edge] of this.graph.edges) {
      const vA = this.graph.canonicalVertices.get(edge.vertexAId);
      const vB = this.graph.canonicalVertices.get(edge.vertexBId);
      if (!vA || !vB) continue;

      // Check distance from click to edge midpoint (world space)
      const midX = (vA.x + vB.x) / 2;
      const midY = (vA.y + vB.y) / 2;
      const midScreen = vp.worldToScreen(midX, midY);

      const screenDist = dist2(clickSX, clickSY, midScreen.x, midScreen.y);
      if (screenDist < this.CLICK_SELECT_RADIUS_PX && screenDist < bestDist) {
        bestDist = screenDist;
        bestPieceId = edge.pieceId;
      }
    }

    if (bestPieceId !== null) {
      if (this.selectedPieceId === bestPieceId) {
        // Clicking already-selected piece deselects it
        this.setSelectedPiece(null);
      } else {
        this.setSelectedPiece(bestPieceId);
        const piece = this.graph.pieces.get(bestPieceId);
        const costStr = piece ? `₹${Math.round(piece.cost).toLocaleString('en-IN')}` : '';
        this.notify(`Piece selected${costStr ? ' (Cost: ' + costStr + ')' : ''}. Press Delete to remove.`, 'info');
      }
    } else {
      // Click on empty space clears selection
      if (this.selectedPieceId !== null) {
        this.setSelectedPiece(null);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Test Bridge (hand-off — Phase 8+ finalizes this)
  // ---------------------------------------------------------------------------

  handleTestBridge() {
    timer.stop();
    const validation = BridgeValidator.validate(this.graph, this.budgetManager, this.roundConfig);

    if (!validation.valid) {
      const primaryError = validation.errors[0];
      this.notify(primaryError, 'error');

      if (this.character) {
        this.character.setEmotion('😰');
        this.character.say(primaryError);
      }
      return { success: false, errors: validation.errors };
    }

    // Transition state from BUILDING -> FINALIZING -> TESTING
    if (gameState.canTransitionTo(GAME_STATES.FINALIZING)) {
      gameState.transitionTo(GAME_STATES.FINALIZING);
    }
    if (gameState.canTransitionTo(GAME_STATES.TESTING)) {
      gameState.transitionTo(GAME_STATES.TESTING);
    }

    this.notify('Bridge validated and finalized! Initiating load test...', 'success');

    if (this.character) {
      this.character.setEmotion('😄');
      this.character.say('Structure and road network verified! Initiating the load test. Hold tight!');
    }

    eventBus.emit(EVENTS.TEST_STARTED, {
      graph: this.graph,
      summary: validation.summary
    });

    return { success: true, summary: validation.summary };
  }
}
