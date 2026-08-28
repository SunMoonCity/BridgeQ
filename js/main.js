// main.js - Application entry point

import { gameState } from './core/game-state.js';
import { hud } from './ui/hud.js';
import { character } from './ui/character.js';
import { toast } from './ui/toast.js';
import { budgetManager } from './economy/budget.js';
import { getRoundConfig } from './config/round-config.js';
import { GAME_STATES, EVENTS } from './config/constants.js';
import { eventBus } from './core/event-bus.js';
import { LogicalGraph } from './builder/graph-model.js';
import { BridgeRenderer } from './ui/renderer.js';
import { BuildController } from './ui/build-controller.js';

let renderer = null;
let graph = null;
let buildController = null;

function initApp() {
  console.log('[Technothlon Bridge Game] Initializing Application...');

  const canvas = document.getElementById('gameCanvas');
  graph = new LogicalGraph();
  renderer = new BridgeRenderer(canvas);
  renderer.setGraph(graph);

  // Initialize UI systems
  hud.init();
  character.init();
  toast.init();

  // Load Round 1 config
  const round1 = getRoundConfig(1);
  if (round1) {
    graph.initEnvironment(round1.cliffs);
    renderer.setRound(round1);
    budgetManager.init(round1.budget);
    gameState.setRound(1, round1);
  }

  // Build Controller (Phase 7) — wires all construction card inputs
  buildController = new BuildController({
    graph,
    budgetManager,
    renderer,
    roundConfig: round1,
    character
  });
  buildController.init();

  // Handle window resizing
  function resizeCanvas() {
    if (canvas && renderer) {
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
      renderer.fitToScreen();
    }
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // Continuous animation/render loop
  function renderLoop() {
    renderer.render();
    requestAnimationFrame(renderLoop);
  }
  requestAnimationFrame(renderLoop);

  // Construction panel reveal on canvas click (wireframe requirement)
  const leftZone = document.getElementById('leftConstructionZone');
  const constructionCard = document.getElementById('constructionCard');

  if (canvas) {
    canvas.addEventListener('click', () => {
      if (!constructionCard.classList.contains('active')) {
        startBuildingPhase();
      }
    });
  }

  // Orientation toggle logic
  const btnOrientY = document.getElementById('btnOrientY');
  const btnOrientX = document.getElementById('btnOrientX');
  if (btnOrientY && btnOrientX) {
    btnOrientY.addEventListener('click', () => {
      btnOrientY.classList.add('active');
      btnOrientX.classList.remove('active');
    });
    btnOrientX.addEventListener('click', () => {
      btnOrientX.classList.add('active');
      btnOrientY.classList.remove('active');
    });
  }

  // Material picker selection logic
  const materialOptions = document.querySelectorAll('.material-option');
  materialOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      materialOptions.forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
    });
  });

  function startBuildingPhase() {
    if (leftZone && constructionCard) {
      leftZone.classList.add('interactive');
      constructionCard.classList.add('active');
      if (renderer) renderer.setBuildingActive(true);
      gameState.transitionTo(GAME_STATES.BUILDING);
      eventBus.emit(EVENTS.BUILD_STARTED);
    }
  }

  console.log('[Technothlon Bridge Game] Initialization complete. Build Phase 7 UI active.');
}

window.addEventListener('DOMContentLoaded', initApp);
