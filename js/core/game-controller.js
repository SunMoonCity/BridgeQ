// game-controller.js - High-Level Multi-Round Competition Flow Controller

import { gameState } from './game-state.js';
import { eventBus } from './event-bus.js';
import { GAME_STATES, EVENTS } from '../config/constants.js';
import { getRoundConfig, getTotalRounds } from '../config/round-config.js';
import { budgetManager } from '../economy/budget.js';
import { timer } from './timer.js';

class GameController {
  constructor() {
    this.currentRoundNumber = 1;
    this.totalRounds = getTotalRounds(); // 3 rounds
    this.roundScores = new Map(); // roundNumber -> { stagesPassed, totalStages, score }
    this.graph = null;
    this.renderer = null;
    this.buildController = null;
    this.roundIntroCallback = null;
    this.roundSummaryCallback = null;
    this.gameCompleteCallback = null;
  }

  /**
   * Bind runtime dependencies (graph, renderer, buildController, UI callbacks)
   */
  bindDependencies({ graph, renderer, buildController, onRoundIntro, onRoundSummary, onGameComplete }) {
    this.graph = graph;
    this.renderer = renderer;
    this.buildController = buildController;
    this.roundIntroCallback = onRoundIntro;
    this.roundSummaryCallback = onRoundSummary;
    this.gameCompleteCallback = onGameComplete;

    // Listen for test completion event to record scores
    eventBus.on(EVENTS.ROUND_COMPLETED, (data) => this.onRoundTestComplete(data));
    eventBus.on(EVENTS.STAGE_FAILED, (data) => this.onRoundTestFailed(data));
  }

  /**
   * Start Round 1 intro sequence
   */
  startCompetition() {
    this.currentRoundNumber = 1;
    this.roundScores.clear();
    this.loadRound(1);
  }

  /**
   * Load a specific round (1, 2, or 3)
   * Resets graph environment, cliff anchors, budget, timer, and transitions state
   * @param {number} roundNumber
   */
  loadRound(roundNumber) {
    const roundConfig = getRoundConfig(roundNumber);
    if (!roundConfig) {
      console.error(`[GameController] Invalid round number: ${roundNumber}`);
      return false;
    }

    this.currentRoundNumber = roundNumber;

    // Reset logical graph environment for new round cliffs/fixed vertices
    if (this.graph) {
      this.graph.initEnvironment(roundConfig.cliffs);
    }

    // Reset renderer viewport bounds and cliff models
    if (this.renderer) {
      this.renderer.setRound(roundConfig);
      this.renderer.setGraph(this.graph);
    }

    // Reset budget ledger for round
    budgetManager.init(roundConfig.budget);

    // Reset build timer for round
    timer.init(roundConfig.buildTimeSeconds);

    // Update buildController round config reference
    if (this.buildController) {
      this.buildController.roundConfig = roundConfig;
      this.buildController.setSelectedPiece(null);
    }

    // Sync GameState
    gameState.setRound(roundNumber, roundConfig);
    gameState.transitionTo(GAME_STATES.ROUND_INTRO || 'ROUND_INTRO');

    if (typeof this.roundIntroCallback === 'function') {
      this.roundIntroCallback({ roundNumber, roundConfig });
    }

    return true;
  }

  /**
   * Start building phase for current loaded round
   */
  startBuilding() {
    gameState.transitionTo(GAME_STATES.BUILDING);
    timer.start();
    eventBus.emit(EVENTS.BUILD_STARTED);
  }

  /**
   * Called when a load test finishes with 5/5 or all stages completed
   */
  onRoundTestComplete({ stagesPassed, totalStages, score }) {
    this.roundScores.set(this.currentRoundNumber, {
      roundNumber: this.currentRoundNumber,
      stagesPassed,
      totalStages: totalStages || 5,
      score: score || `${stagesPassed}/${totalStages || 5}`,
      passed: true
    });

    // Sync progress to backend database
    if (typeof window !== 'undefined' && window.TechnoBridgeAPI) {
      window.TechnoBridgeAPI.updateRoundProgress(this.currentRoundNumber, {
        stagesPassed: stagesPassed || 5,
        isCompleted: true
      }).catch(err => console.warn('[GameController] Failed to sync progress to DB:', err.message));
    }

    gameState.transitionTo(GAME_STATES.ROUND_SUMMARY || 'ROUND_SUMMARY');

    if (typeof this.roundSummaryCallback === 'function') {
      this.roundSummaryCallback({
        roundNumber: this.currentRoundNumber,
        result: this.roundScores.get(this.currentRoundNumber),
        hasNextRound: this.currentRoundNumber < this.totalRounds
      });
    }
  }

  /**
   * Called when a load test fails early
   */
  onRoundTestFailed({ stage, stagesPassed, totalStages, reason, message }) {
    this.roundScores.set(this.currentRoundNumber, {
      roundNumber: this.currentRoundNumber,
      stagesPassed,
      totalStages: totalStages || 5,
      score: `${stagesPassed}/${totalStages || 5}`,
      passed: false,
      reason,
      message
    });

    // Sync partial progress to backend database
    if (typeof window !== 'undefined' && window.TechnoBridgeAPI) {
      window.TechnoBridgeAPI.updateRoundProgress(this.currentRoundNumber, {
        stagesPassed: stagesPassed || 0,
        isCompleted: false
      }).catch(err => console.warn('[GameController] Failed to sync progress to DB:', err.message));
    }

    gameState.transitionTo(GAME_STATES.ROUND_SUMMARY || 'ROUND_SUMMARY');

    if (typeof this.roundSummaryCallback === 'function') {
      this.roundSummaryCallback({
        roundNumber: this.currentRoundNumber,
        result: this.roundScores.get(this.currentRoundNumber),
        hasNextRound: this.currentRoundNumber < this.totalRounds
      });
    }
  }

  /**
   * Advance to the next round or complete the competition
   */
  nextRound() {
    if (this.currentRoundNumber < this.totalRounds) {
      this.loadRound(this.currentRoundNumber + 1);
    } else {
      this.finishCompetition();
    }
  }

  /**
   * Complete all 3 competition rounds and report overall scores
   */
  finishCompetition() {
    gameState.transitionTo(GAME_STATES.GAME_OVER || 'GAME_OVER');

    let totalStagesPassed = 0;
    const summaryList = [];

    for (let r = 1; r <= this.totalRounds; r++) {
      const rec = this.roundScores.get(r) || { roundNumber: r, stagesPassed: 0, totalStages: 5, score: '0/5', passed: false };
      totalStagesPassed += rec.stagesPassed;
      summaryList.push(rec);
    }

    const overallResult = {
      totalStagesPassed,
      maxPossibleStages: this.totalRounds * 5,
      roundSummaries: summaryList,
      overallScore: `${totalStagesPassed}/${this.totalRounds * 5}`
    };

    eventBus.emit(EVENTS.GAME_COMPLETED || 'GAME_COMPLETED', overallResult);

    if (typeof this.gameCompleteCallback === 'function') {
      this.gameCompleteCallback(overallResult);
    }

    return overallResult;
  }
}

export const gameController = new GameController();
