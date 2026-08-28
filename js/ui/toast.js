// toast.js - Non-blocking toast notification banner (success / error / info)

import { eventBus } from '../core/event-bus.js';
import { EVENTS } from '../config/constants.js';

const TOAST_DURATION_MS = 3000;
const TOAST_TYPES = Object.freeze({
  SUCCESS: 'success',
  ERROR: 'error',
  INFO: 'info',
  WARNING: 'warning'
});

class ToastManager {
  constructor() {
    this.el = null;
    this._hideTimeout = null;
  }

  init() {
    this.el = document.getElementById('toastNotification');

    // Listen to the NOTIFICATION event so any module can show toasts
    eventBus.on(EVENTS.NOTIFICATION, ({ message, type = TOAST_TYPES.INFO }) => {
      this.show(message, type);
    });
  }

  /**
   * Show a toast notification
   * @param {string} message
   * @param {'success'|'error'|'info'|'warning'} type
   */
  show(message, type = TOAST_TYPES.INFO) {
    if (!this.el) return;

    // Clear any pending auto-hide
    if (this._hideTimeout) {
      clearTimeout(this._hideTimeout);
      this._hideTimeout = null;
    }

    // Set content and type class
    this.el.textContent = message;
    this.el.className = `notification-toast notification-toast--${type} notification-toast--visible`;

    // Auto-hide after duration
    this._hideTimeout = setTimeout(() => {
      this.hide();
    }, TOAST_DURATION_MS);
  }

  hide() {
    if (!this.el) return;
    this.el.classList.remove('notification-toast--visible');
    this._hideTimeout = null;
  }

  /** Convenience shorthands */
  success(msg) { this.show(msg, TOAST_TYPES.SUCCESS); }
  error(msg)   { this.show(msg, TOAST_TYPES.ERROR); }
  info(msg)    { this.show(msg, TOAST_TYPES.INFO); }
  warn(msg)    { this.show(msg, TOAST_TYPES.WARNING); }
}

export const toast = new ToastManager();
export { TOAST_TYPES };
