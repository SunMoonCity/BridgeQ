// result-modal.js - Results and Diagnostics Modal Component for Phase 17 UI Polish

import { eventBus } from '../core/event-bus.js';
import { EVENTS } from '../config/constants.js';

export class ResultModal {
  constructor() {
    this.modalEl = null;
    this.contentEl = null;
    this.titleEl = null;
    this.scoreEl = null;
    this.detailsEl = null;
    this.nextBtn = null;
    this.retryBtn = null;
    this.onNext = null;
    this.onRetry = null;
  }

  init() {
    this.createModalDOM();
    
    eventBus.on(EVENTS.ROUND_COMPLETED, (data) => this.showSuccess(data));
    eventBus.on(EVENTS.STAGE_FAILED, (data) => this.showFailure(data));
  }

  createModalDOM() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('resultModal')) {
      this.modalEl = document.getElementById('resultModal');
      return;
    }

    const modalHTML = `
      <div id="resultModal" class="modal-overlay" style="display: none;">
        <div class="modal-card">
          <div id="modalHeader" class="modal-header">
            <h2 id="modalTitle">Round Completed!</h2>
          </div>
          <div class="modal-body">
            <div id="modalScore" class="modal-score">5/5</div>
            <div id="modalDetails" class="modal-details">All 5 load stages passed successfully.</div>
          </div>
          <div class="modal-footer">
            <button id="modalBtnRetry" class="btn btn-secondary">Retry Round</button>
            <button id="modalBtnNext" class="btn btn-primary">Next Round</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    this.modalEl = document.getElementById('resultModal');
    this.titleEl = document.getElementById('modalTitle');
    this.scoreEl = document.getElementById('modalScore');
    this.detailsEl = document.getElementById('modalDetails');
    this.nextBtn = document.getElementById('modalBtnNext');
    this.retryBtn = document.getElementById('modalBtnRetry');

    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', () => {
        this.hide();
        if (typeof this.onNext === 'function') this.onNext();
      });
    }
    if (this.retryBtn) {
      this.retryBtn.addEventListener('click', () => {
        this.hide();
        if (typeof this.onRetry === 'function') this.onRetry();
      });
    }
  }

  showSuccess({ stagesPassed, totalStages, score }) {
    if (!this.modalEl) this.createModalDOM();
    if (this.titleEl) this.titleEl.textContent = 'Round Victorious!';
    if (this.scoreEl) {
      this.scoreEl.textContent = score || `${stagesPassed}/${totalStages || 5}`;
      this.scoreEl.style.color = '#16a34a';
    }
    if (this.detailsEl) {
      this.detailsEl.textContent = `Outstanding engineering! The bridge held against all ${totalStages || 5} vehicular load stages.`;
    }
    if (this.nextBtn) this.nextBtn.textContent = 'Next Round';
    this.show();
  }

  showFailure({ stage, stagesPassed, totalStages, reason, message }) {
    if (!this.modalEl) this.createModalDOM();
    if (this.titleEl) this.titleEl.textContent = 'Bridge Failure';
    if (this.scoreEl) {
      this.scoreEl.textContent = `${stagesPassed}/${totalStages || 5}`;
      this.scoreEl.style.color = '#dc2626';
    }
    if (this.detailsEl) {
      this.detailsEl.textContent = message || `Bridge collapsed during Stage ${stage} due to ${reason || 'structural overload'}.`;
    }
    if (this.nextBtn) this.nextBtn.textContent = 'View Summary';
    this.show();
  }

  show() {
    if (this.modalEl) this.modalEl.style.display = 'flex';
  }

  hide() {
    if (this.modalEl) this.modalEl.style.display = 'none';
  }
}

export const resultModal = new ResultModal();
