// hud.js - Heads-up display manager

import { eventBus } from '../core/event-bus.js';
import { EVENTS } from '../config/constants.js';
import { formatCurrency, formatTimeMMSS } from '../utils/math.js';

class HUD {
  constructor() {
    this.roundEl = null;
    this.timeEl = null;
    this.totalBudgetEl = null;
    this.spentEl = null;
    this.remainingEl = null;
  }

  init() {
    this.roundEl = document.getElementById('statRound');
    this.timeEl = document.getElementById('statTime');
    this.totalBudgetEl = document.getElementById('statTotalBudget');
    this.spentEl = document.getElementById('statSpent');
    this.remainingEl = document.getElementById('statRemaining');

    eventBus.on(EVENTS.ROUND_LOADED, (data) => this.onRoundLoaded(data));
    eventBus.on(EVENTS.BUDGET_CHANGED, (data) => this.onBudgetChanged(data));
    eventBus.on(EVENTS.TIMER_TICK, (seconds) => this.onTimerTick(seconds));
  }

  onRoundLoaded({ roundNumber, roundConfig }) {
    if (this.roundEl) {
      this.roundEl.textContent = `Round ${roundNumber}`;
    }
    if (this.timeEl) {
      this.timeEl.textContent = formatTimeMMSS(roundConfig.buildTimeSeconds);
    }
  }

  onBudgetChanged({ total, spent, remaining }) {
    if (this.totalBudgetEl) this.totalBudgetEl.textContent = formatCurrency(total);
    if (this.spentEl) this.spentEl.textContent = formatCurrency(spent);
    if (this.remainingEl) this.remainingEl.textContent = formatCurrency(remaining);
  }

  onTimerTick(seconds) {
    if (this.timeEl) {
      this.timeEl.textContent = formatTimeMMSS(seconds);
    }
  }
}

export const hud = new HUD();
