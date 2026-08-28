// build-controller.test.js - Headless tests for BuildController business logic
// DOM APIs are stubbed via minimal mock objects so the tests run in Node.js.

import assert from 'node:assert';
import { LogicalGraph } from '../js/builder/graph-model.js';
import { budgetManager } from '../js/economy/budget.js';
import { getRoundConfig } from '../js/config/round-config.js';
import { BuildController } from '../js/ui/build-controller.js';

console.log('Testing Build Controller (Phase 7 UI Integration)...');

const round1 = getRoundConfig(1);

// ---------------------------------------------------------------------------
// Minimal DOM element stubs
// ---------------------------------------------------------------------------

function makeInput(value = '') {
  return { value, addEventListener: () => {} };
}

function makeButton(display = 'none') {
  return {
    style: { display },
    classList: {
      _classes: new Set(),
      contains(c) { return this._classes.has(c); },
      add(c) { this._classes.add(c); },
      remove(c) { this._classes.delete(c); }
    },
    addEventListener: () => {}
  };
}

function makePicker(selectedMaterial = 'steel') {
  const el = {
    querySelector(sel) {
      if (sel === '.material-option.selected') {
        return { dataset: { material: selectedMaterial } };
      }
      return null;
    }
  };
  return el;
}

function makeCanvas() {
  return { addEventListener: () => {}, getBoundingClientRect: () => ({ left: 0, top: 0 }) };
}

/** Minimal character stub that records last message */
function makeCharacter() {
  return {
    lastEmotion: null,
    lastMessage: null,
    setEmotion(e) { this.lastEmotion = e; },
    say(m) { this.lastMessage = m; }
  };
}

/** Collected notifications */
function makeNotifications() {
  const log = [];
  return {
    log,
    push(msg, type) { log.push({ msg, type }); }
  };
}

function makeBuildController(overrides = {}) {
  const graph = new LogicalGraph();
  graph.initEnvironment(round1.cliffs);
  budgetManager.init(round1.budget);

  // Minimal renderer stub (viewport required for canvas click tests)
  const renderer = {
    setSelectedPiece: () => {},
    viewport: {
      screenToWorld: (sx, sy) => ({ x: sx, y: sy }),
      worldToScreen: (wx, wy) => ({ x: wx, y: wy })
    }
  };
  const character = makeCharacter();

  const ctrl = new BuildController({
    graph,
    budgetManager,
    renderer,
    roundConfig: round1,
    character,
    ...overrides
  });

  // Inject DOM stub elements directly (bypasses document.getElementById)
  ctrl.btnPlot   = makeButton('block');
  ctrl.btnDelete = makeButton('none');
  ctrl.btnTest   = makeButton('block');
  ctrl.eqInput   = makeInput('');
  ctrl.rangeMin  = makeInput('0');
  ctrl.rangeMax  = makeInput('400');
  ctrl.materialPicker = makePicker('steel');
  ctrl.btnOrientY = makeButton();
  ctrl.btnOrientX = makeButton();
  ctrl.canvas    = makeCanvas();

  // Capture notifications
  const notifications = makeNotifications();
  const origNotify = ctrl.notify.bind(ctrl);
  ctrl.notify = (msg, type) => {
    notifications.push(msg, type);
    origNotify(msg, type);
  };
  ctrl._notifications = notifications;

  return { ctrl, graph, character };
}

// ---------------------------------------------------------------------------
// Test 1: Successful Plot Piece
// ---------------------------------------------------------------------------
{
  const { ctrl, graph, character } = makeBuildController();
  ctrl.eqInput.value  = '600';
  ctrl.rangeMin.value = '0';
  ctrl.rangeMax.value = '100';

  ctrl.handlePlot();

  assert.strictEqual(graph.pieceCount, 1, 'Piece should be added to graph');
  assert.ok(
    ctrl._notifications.log.some(n => n.type === 'success'),
    'Success toast should fire on valid plot'
  );
  assert.ok(character.lastMessage.includes('budget') || character.lastMessage.includes('left') || character.lastMessage.includes('building'),
    'Character should react after plot'
  );
}

// ---------------------------------------------------------------------------
// Test 2: Empty Equation Rejected
// ---------------------------------------------------------------------------
{
  const { ctrl, graph } = makeBuildController();
  ctrl.eqInput.value = '';

  ctrl.handlePlot();

  assert.strictEqual(graph.pieceCount, 0, 'No piece should be added for empty equation');
  assert.ok(
    ctrl._notifications.log.some(n => n.type === 'warning'),
    'Warning toast for empty equation'
  );
}

// ---------------------------------------------------------------------------
// Test 3: Invalid Min/Max Bounds Rejected
// ---------------------------------------------------------------------------
{
  const { ctrl, graph } = makeBuildController();
  ctrl.eqInput.value  = '600';
  ctrl.rangeMin.value = '300';
  ctrl.rangeMax.value = '100'; // min > max is invalid

  ctrl.handlePlot();

  assert.strictEqual(graph.pieceCount, 0, 'No piece added when min >= max');
  assert.ok(
    ctrl._notifications.log.some(n => n.type === 'error'),
    'Error toast for invalid bounds'
  );
}

// ---------------------------------------------------------------------------
// Test 4: Insufficient Budget Rejected
// ---------------------------------------------------------------------------
{
  const graph = new LogicalGraph();
  graph.initEnvironment(round1.cliffs);
  budgetManager.init(50); // Tiny budget

  const renderer = {
    setSelectedPiece: () => {},
    viewport: { screenToWorld: () => ({x:0,y:0}), worldToScreen: () => ({x:0,y:0}) }
  };
  const ctrl = new BuildController({ graph, budgetManager, renderer, roundConfig: round1, character: makeCharacter() });
  ctrl.btnPlot   = makeButton('block');
  ctrl.btnDelete = makeButton('none');
  ctrl.btnTest   = makeButton('block');
  ctrl.eqInput   = makeInput('600');
  ctrl.rangeMin  = makeInput('0');
  ctrl.rangeMax  = makeInput('400');
  ctrl.materialPicker = makePicker('steel');
  ctrl.btnOrientY = makeButton();
  ctrl.btnOrientX = makeButton();
  ctrl.canvas    = makeCanvas();

  const errors = [];
  ctrl.notify = (msg, type) => { if (type === 'error') errors.push(msg); };

  ctrl.handlePlot();

  assert.strictEqual(graph.pieceCount, 0, 'No piece added when budget insufficient');
  assert.ok(errors.length > 0, 'Error notification fired for insufficient budget');
}

// ---------------------------------------------------------------------------
// Test 5: Delete Without Selection — Warning
// ---------------------------------------------------------------------------
{
  const { ctrl } = makeBuildController();
  ctrl.selectedPieceId = null;

  ctrl.handleDelete();

  assert.ok(
    ctrl._notifications.log.some(n => n.type === 'warning'),
    'Warning when no piece selected for deletion'
  );
}

// ---------------------------------------------------------------------------
// Test 6: Delete Selected Piece — Refund and Graph Updated
// ---------------------------------------------------------------------------
{
  const { ctrl, graph } = makeBuildController();
  ctrl.eqInput.value  = '600';
  ctrl.rangeMin.value = '0';
  ctrl.rangeMax.value = '100';
  ctrl.handlePlot();

  assert.strictEqual(graph.pieceCount, 1, 'Piece plotted');
  const spentAfterPlot = budgetManager.getSpent();
  assert.ok(spentAfterPlot > 0, 'Budget charged');

  // Select the plotted piece
  const pieceId = [...graph.pieces.keys()][0];
  ctrl.setSelectedPiece(pieceId);
  assert.strictEqual(ctrl.selectedPieceId, pieceId);

  ctrl.handleDelete();

  assert.strictEqual(graph.pieceCount, 0, 'Piece removed after delete');
  assert.strictEqual(budgetManager.getSpent(), 0, 'Budget fully refunded');
  assert.strictEqual(ctrl.selectedPieceId, null, 'Selection cleared after delete');
  assert.ok(
    ctrl._notifications.log.some(n => n.type === 'info' && n.msg.includes('Refunded')),
    'Info toast with refund amount'
  );
}

// ---------------------------------------------------------------------------
// Test 7: Test Bridge Without Any Pieces — Warning
// ---------------------------------------------------------------------------
{
  const { ctrl, graph } = makeBuildController();
  assert.strictEqual(graph.pieceCount, 0);

  ctrl.handleTestBridge();

  assert.ok(
    ctrl._notifications.log.some(n => n.type === 'warning'),
    'Warning when testing empty bridge'
  );
}

// ---------------------------------------------------------------------------
// Test 8: Orientation helper returns correct string
// ---------------------------------------------------------------------------
{
  const { ctrl } = makeBuildController();

  // Default: y-of-x orientation
  assert.strictEqual(ctrl.getOrientation(), 'y-of-x', 'Default orientation is y-of-x');

  // Activate x-of-y button
  ctrl.btnOrientX.classList.add('active');
  assert.strictEqual(ctrl.getOrientation(), 'x-of-y', 'Orientation switches to x-of-y');
}

// ---------------------------------------------------------------------------
// Test 9: Material helper reads selected material from picker
// ---------------------------------------------------------------------------
{
  const { ctrl } = makeBuildController();
  ctrl.materialPicker = makePicker('concrete');

  assert.strictEqual(ctrl.getSelectedMaterial(), 'concrete', 'Material picker reads concrete');
}

console.log('  PASS: Build Controller (Phase 7 UI Integration) tests');
