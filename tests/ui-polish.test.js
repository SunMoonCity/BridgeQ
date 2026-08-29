// ui-polish.test.js - Automated tests for Phase 17: Complete UI Polish

import assert from 'node:assert';
import { ResultModal } from '../js/ui/result-modal.js';
import { BridgeRenderer } from '../js/ui/renderer.js';
import { eventBus } from '../js/core/event-bus.js';
import { EVENTS } from '../js/config/constants.js';

console.log('Testing Complete UI Polish (Phase 17)...');

// Mock Canvas & DOM
function createMockCanvas() {
  return {
    width: 800,
    height: 600,
    getContext: () => ({
      clearRect: () => {},
      fillRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      fill: () => {},
      arc: () => {},
      fillText: () => {},
      save: () => {},
      restore: () => {},
      translate: () => {},
      rotate: () => {}
    })
  };
}

// 1. Result Modal Initialization & Triggers
{
  const modal = new ResultModal();
  modal.titleEl = { textContent: '' };
  modal.scoreEl = { textContent: '', style: {} };
  modal.detailsEl = { textContent: '' };
  modal.nextBtn = { textContent: '' };

  let nextClicked = false;
  modal.onNext = () => { nextClicked = true; };

  modal.showSuccess({ stagesPassed: 5, totalStages: 5, score: '5/5' });
  assert.strictEqual(modal.titleEl.textContent, 'Round Victorious!');
  assert.strictEqual(modal.scoreEl.textContent, '5/5');

  modal.showFailure({ stage: 3, stagesPassed: 2, totalStages: 5, reason: 'MEMBER_SNAP' });
  assert.strictEqual(modal.titleEl.textContent, 'Bridge Failure');
  assert.strictEqual(modal.scoreEl.textContent, '2/5');
}

// 2. Renderer Heatmap Stress Colors
{
  const canvas = createMockCanvas();
  const renderer = new BridgeRenderer(canvas);

  assert.strictEqual(renderer.getStressColor(0.2), '#22c55e', 'Low stress must return Green');
  assert.strictEqual(renderer.getStressColor(0.6), '#eab308', 'Medium stress must return Yellow');
  assert.strictEqual(renderer.getStressColor(0.85), '#f97316', 'High stress must return Orange');
  assert.strictEqual(renderer.getStressColor(0.99), '#ef4444', 'Critical stress must return Red');
}

console.log('  PASS: Complete UI Polish (Phase 17) tests');
