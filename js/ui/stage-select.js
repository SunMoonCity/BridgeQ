// stage-select.js - Stage Selection Overlay Controller for Phase 18

import { eventBus } from '../core/event-bus.js';
import { EVENTS } from '../config/constants.js';
import { getRoundConfig, getTotalRounds } from '../config/round-config.js';
import { gameController } from '../core/game-controller.js';

export class StageSelectManager {
  constructor() {
    this.containerEl = null;
    this.playerGreetingEl = null;
    this.gridEl = null;
    this.playerData = null;
    this.completedRounds = new Set();
    this.onStageSelect = null;
    this.devMode = false;
  }

  /**
   * Initialize Stage Select DOM and events
   */
  init(containerEl = null) {
    if (typeof document !== 'undefined') {
      this.containerEl = containerEl || document.getElementById('stageSelectOverlay');
      if (!this.containerEl) {
        this.createStageDOM();
      }
    }

    // Listen for round completions to update progression state
    eventBus.on(EVENTS.ROUND_COMPLETED, () => {
      if (gameController && gameController.currentRoundNumber) {
        this.completedRounds.add(gameController.currentRoundNumber);
        this.renderStages();
      }
    });

    eventBus.on(EVENTS.STAGE_FAILED, () => {
      if (gameController && gameController.currentRoundNumber) {
        this.completedRounds.add(gameController.currentRoundNumber);
        this.renderStages();
      }
    });

    this.renderStages();
  }

  /**
   * Inject Stage Selection Overlay DOM if not present in index.html
   */
  createStageDOM() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('stageSelectOverlay')) {
      this.containerEl = document.getElementById('stageSelectOverlay');
      return;
    }

    const html = `
      <div id="stageSelectOverlay" class="stage-overlay">
        <div class="stage-container">
          <header class="stage-header">
            <h1 class="stage-title">Select Bridge Stage</h1>
            <p id="playerGreeting" class="stage-subtitle">Welcome back, Engineer</p>
          </header>

          <div id="stageGrid" class="stage-grid">
            <!-- Stage Cards 1, 2, 3 rendered dynamically -->
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
    this.containerEl = document.getElementById('stageSelectOverlay');
    this.playerGreetingEl = document.getElementById('playerGreeting');
    this.gridEl = document.getElementById('stageGrid');
  }

  /**
   * Accept dynamic player/student data from session/login/database
   * @param {object} playerData - Player info and progress records
   */
  setPlayerData(playerData) {
    this.playerData = playerData;
    if (this.playerGreetingEl && playerData && playerData.name) {
      this.playerGreetingEl.textContent = `Welcome back, ${playerData.name}`;
    }
    this.renderStages();
  }

  /**
   * Render Stage 1, Stage 2, and Stage 3 cards matching game theme
   */
  renderStages() {
    this.gridEl = this.gridEl || (typeof document !== 'undefined' ? document.getElementById('stageGrid') : null);
    if (!this.gridEl) return;

    this.gridEl.innerHTML = '';
    const total = getTotalRounds(); // 3 rounds

    for (let r = 1; r <= total; r++) {
      const config = getRoundConfig(r);
      if (!config) continue;

      const isUnlocked = this.isStageUnlocked(r);
      const isCompleted = this.isStageCompleted(r);

      const card = document.createElement('div');
      card.className = `stage-card ${isUnlocked ? 'unlocked' : 'locked'} ${isCompleted ? 'completed' : ''}`;
      card.dataset.round = r;

      card.innerHTML = `
        <div class="stage-card-header">
          <span class="stage-number-badge">Stage ${r}</span>
          ${isCompleted ? '<span class="stage-status-badge">Completed</span>' : ''}
        </div>
        <h3 class="stage-name">${config.label || `Round ${r}`}</h3>
        <p class="stage-description">${config.description || 'Construct a structural bridge to sustain vehicular loads.'}</p>
        <div class="stage-stats">
          <div class="stage-stat"><span>Budget:</span> <strong>₹${Math.round(config.budget / 100000)}L</strong></div>
          <div class="stage-stat"><span>Time:</span> <strong>${Math.round(config.buildTimeSeconds / 60)} mins</strong></div>
          <div class="stage-stat"><span>Vehicles:</span> <strong>${config.loadStages ? config.loadStages.length : 5} Stages</strong></div>
        </div>
        <button class="btn ${isUnlocked ? 'btn-primary' : 'btn-disabled'}" ${!isUnlocked ? 'disabled' : ''}>
          ${isUnlocked ? (isCompleted ? 'Replay Stage' : 'Start Stage') : 'Locked'}
        </button>
      `;

      if (isUnlocked) {
        card.querySelector('button').addEventListener('click', () => {
          this.selectStage(r);
        });
      }

      this.gridEl.appendChild(card);
    }
  }

  /**
   * Dynamically mark a stage as unlocked (called during DB progress restoration)
   * @param {number} roundNumber
   */
  unlockStage(roundNumber) {
    if (roundNumber > 1) {
      this.completedRounds.add(roundNumber - 1);
      this.renderStages();
    }
  }

  /**
   * Enable/disable development mode (unlocks all stages for debugging if true)
   */
  setDevMode(enabled) {
    this.devMode = !!enabled;
    this.renderStages();
  }

  /**
   * Check if stage is unlocked
   * Rule: Stage 1 is always unlocked. Stage N requires Stage N-1 to be completed.
   */
  isStageUnlocked(roundNumber) {
    if (this.devMode) return true; // Debug override
    if (roundNumber === 1) return true;

    // Check explicit playerData from session/DB if provided
    if (this.playerData && Array.isArray(this.playerData.roundsCompleted)) {
      return this.playerData.roundsCompleted.includes(roundNumber - 1);
    }

    // Check completedRounds set or gameController in-memory roundScores
    if (this.completedRounds.has(roundNumber - 1)) {
      return true;
    }
    if (gameController && gameController.roundScores && gameController.roundScores.has(roundNumber - 1)) {
      return true;
    }

    return false;
  }

  /**
   * Check if stage was completed
   */
  isStageCompleted(roundNumber) {
    if (this.playerData && Array.isArray(this.playerData.roundsCompleted)) {
      return this.playerData.roundsCompleted.includes(roundNumber);
    }
    if (this.completedRounds.has(roundNumber)) {
      return true;
    }
    if (gameController && gameController.roundScores && gameController.roundScores.has(roundNumber)) {
      return true;
    }
    return false;
  }

  /**
   * Handle Stage selection with strict lock guard
   */
  selectStage(roundNumber) {
    if (!this.isStageUnlocked(roundNumber)) {
      console.warn(`[StageSelect] Stage ${roundNumber} is locked. Complete Stage ${roundNumber - 1} first.`);
      eventBus.emit(EVENTS.NOTIFICATION, {
        message: `Stage ${roundNumber} is locked. Complete Stage ${roundNumber - 1} first!`,
        type: 'warning'
      });
      return false;
    }

    eventBus.emit(EVENTS.STAGE_SELECTED || 'STAGE_SELECTED', { roundNumber });
    if (typeof this.onStageSelect === 'function') {
      this.onStageSelect(roundNumber);
    }
    return true;
  }

  show() {
    if (this.containerEl) this.containerEl.style.display = 'flex';
  }

  hide() {
    if (this.containerEl) this.containerEl.style.display = 'none';
  }
}

export const stageSelectManager = new StageSelectManager();
