// timer.js - Single-instance countdown build timer for competition rounds

import { eventBus } from '../core/event-bus.js';
import { EVENTS } from '../config/constants.js';

class BuildTimer {
  constructor() {
    this.totalSeconds = 0;
    this.remainingSeconds = 0;
    this.intervalId = null;
    this.isRunning = false;
    this.isExpired = false;
  }

  /**
   * Initialize timer for a specific build duration in seconds
   * @param {number} durationSeconds - Countdown duration (e.g. 300)
   */
  init(durationSeconds) {
    this.stop(); // Ensure any existing interval is cleared (single instance invariant)
    this.totalSeconds = Math.max(0, typeof durationSeconds === 'number' ? durationSeconds : 0);
    this.remainingSeconds = this.totalSeconds;
    this.isRunning = false;
    this.isExpired = false;

    // Emit initial tick
    eventBus.emit(EVENTS.TIMER_TICK, this.remainingSeconds);
  }

  /**
   * Start the countdown timer interval (1 tick per second)
   */
  start() {
    if (this.isRunning || this.remainingSeconds <= 0) return;

    this.stop(); // Single instance protection: clear any previous interval
    this.isRunning = true;
    this.isExpired = false;

    this.intervalId = setInterval(() => {
      this.tick();
    }, 1000);
  }

  /**
   * Execute one timer tick (decrements by 1 second)
   */
  tick() {
    if (this.remainingSeconds <= 0) return;

    this.remainingSeconds--;
    eventBus.emit(EVENTS.TIMER_TICK, this.remainingSeconds);

    if (this.remainingSeconds <= 0) {
      this.stop();
      this.isExpired = true;
      eventBus.emit(EVENTS.TIMER_EXPIRED);
    }
  }

  /**
   * Stop/pause the timer and clear internal interval handle
   */
  stop() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }

  /**
   * Reset timer to initial state and stop interval
   */
  reset() {
    this.stop();
    this.remainingSeconds = this.totalSeconds;
    this.isExpired = false;
    eventBus.emit(EVENTS.TIMER_TICK, this.remainingSeconds);
  }

  /**
   * Get remaining seconds
   */
  getRemaining() {
    return this.remainingSeconds;
  }
}

export const timer = new BuildTimer();
