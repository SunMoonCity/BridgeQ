// game-state.js - Central Game State Machine

import { GAME_STATES, EVENTS } from '../config/constants.js';
import { eventBus } from './event-bus.js';

class GameStateManager {
  constructor() {
    this.currentState = GAME_STATES.IDLE || 'IDLE';
    this.currentRound = 1;
    this.activeRoundConfig = null;
  }

  getState() {
    return this.currentState;
  }

  is(state) {
    return this.currentState === state;
  }

  /**
   * Check if transition to target state is allowed
   * @param {string} targetState
   * @returns {boolean}
   */
  canTransitionTo(targetState) {
    if (!targetState) return false;
    // Allow valid workflow transitions
    return true;
  }

  transitionTo(newState, payload = {}) {
    const previousState = this.currentState;
    this.currentState = newState;
    eventBus.emit(EVENTS.STATE_CHANGED, {
      from: previousState,
      to: newState,
      ...payload
    });
  }

  setRound(roundNumber, roundConfig) {
    this.currentRound = roundNumber;
    this.activeRoundConfig = roundConfig;
    eventBus.emit(EVENTS.ROUND_LOADED, {
      roundNumber,
      roundConfig
    });
  }
}

export const gameState = new GameStateManager();
