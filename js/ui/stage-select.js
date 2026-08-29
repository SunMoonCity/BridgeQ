// stage-select.js - Stage Selection Overlay Controller for Phase 18

import { eventBus } from '../core/event-bus.js';
import { EVENTS } from '../config/constants.js';
import { getRoundConfig, getTotalRounds } from '../config/round-config.js';

export class StageSelectManager {
  constructor() {
    this.containerEl = null;
    this.playerGreetingEl = null;
    this.gridEl = null;
    this.playerData = null;
    this.onStageSelect = null;
  }

  /**
   * Initialize Stage Select DOM and events
   */
  init(containerEl = null) {
    this.containerEl = containerEl || document.getElementById('stageSelectOverlay');
    if (!this.containerEl) {
      this.createStageDOM();
    }
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
   * Check if stage is unlocked (default: all rounds 1-3 unlocked for playtest unless specified in playerData)
   */
  isStageUnlocked(roundNumber) {
    if (!this.playerData) return true; // Default standalone fallback
    if (roundNumber === 1) return true;
    const completed = this.playerData.roundsCompleted || [];
    return completed.includes(roundNumber - 1);
  }

  /**
   * Check if stage was completed
   */
  isStageCompleted(roundNumber) {
    if (!this.playerData || !this.playerData.roundsCompleted) return false;
    return this.playerData.roundsCompleted.includes(roundNumber);
  }

  /**
   * Handle Stage selection
   */
  selectStage(roundNumber) {
    eventBus.emit(EVENTS.STAGE_SELECTED || 'STAGE_SELECTED', { roundNumber });
    if (typeof this.onStageSelect === 'function') {
      this.onStageSelect(roundNumber);
    }
  }

  show() {
    if (this.containerEl) this.containerEl.style.display = 'flex';
  }

  hide() {
    if (this.containerEl) this.containerEl.style.display = 'none';
  }
}

export const stageSelectManager = new StageSelectManager();
