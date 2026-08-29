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

import { resultModal } from './ui/result-modal.js';
import { gameController } from './core/game-controller.js';
import { stageSelectManager } from './ui/stage-select.js';
import { timer } from './core/timer.js';
import { PhysicsBridgeBuilder } from './physics/physics-bridge-builder.js';
import { PhysicsSimulation } from './physics/physics-simulation.js';
import { LoadTestRunner } from './physics/load-test-runner.js';

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
  resultModal.init();
  stageSelectManager.init();

  // Load Round 1 config
  const round1 = getRoundConfig(1);
  if (round1) {
    graph.initEnvironment(round1.cliffs);
    renderer.setRound(round1);
    budgetManager.init(round1.budget);
    timer.init(round1.buildTimeSeconds);
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

  // GameController binding (Phase 15)
  gameController.bindDependencies({
    graph,
    renderer,
    buildController
  });

  // Wire Stage Selection (Phase 18) -> hides Stage Overlay and loads selected round
  eventBus.on(EVENTS.STAGE_SELECTED || 'STAGE_SELECTED', ({ roundNumber }) => {
    stageSelectManager.hide();
    gameController.loadRound(roundNumber);
    toast.show(`Stage ${roundNumber} Loaded! Click left cliff to build.`, 'info');
  });

  let activeLoadRunner = null;
  let activeSimulation = null;

  // Listen for TEST_STARTED -> convert graph to physics, initialize simulation & load runner
  eventBus.on(EVENTS.TEST_STARTED, ({ graph, summary }) => {
    console.log('[Main] Finalizing graph and initializing physics simulation...');
    
    // 1. Convert LogicalGraph 1:1 into PhysicsWorld
    const physicsWorld = PhysicsBridgeBuilder.buildPhysicsWorld(graph);
    
    // 2. Instantiate PhysicsSimulation engine
    activeSimulation = new PhysicsSimulation(physicsWorld);
    
    // 3. Instantiate LoadTestRunner
    const roundConfig = gameController.activeRoundConfig || getRoundConfig(gameController.currentRoundNumber || 1);
    activeLoadRunner = new LoadTestRunner(activeSimulation, roundConfig);

    // Update renderer continuously during simulation
    activeLoadRunner.onProgress = ({ vehicles }) => {
      if (renderer) {
        renderer.setSimulationState(
          activeSimulation.getNodePositions(),
          activeSimulation.getEdgeStressMap(),
          vehicles
        );
      }
    };

    // Start 5-stage load test
    activeLoadRunner.start();
  });

  // Wire ResultModal actions for Next Round and Retry Stage
  resultModal.onNext = () => {
    activeLoadRunner = null;
    activeSimulation = null;
    if (renderer) renderer.setSimulationState(null, null, []);
    gameController.nextRound();
  };

  resultModal.onRetry = () => {
    activeLoadRunner = null;
    activeSimulation = null;
    if (renderer) renderer.setSimulationState(null, null, []);
    gameController.loadRound(gameController.currentRoundNumber);
  };

  // Listen for timer expiration -> stop timer, notify player, and auto-trigger bridge test/validation
  eventBus.on(EVENTS.TIMER_EXPIRED, () => {
    toast.show('Time is up! Construction phase locked. Finalizing bridge...', 'warning');
    character.setEmotion('😰');
    character.say('Build time expired! Let us test your bridge structure!');
    if (buildController) {
      buildController.handleTestBridge();
    }
  });

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

  let lastTime = performance.now();

  // Continuous animation/render loop
  function renderLoop(currentTime) {
    const dt = Math.min((currentTime - lastTime) / 1000, 0.05) || (1 / 60);
    lastTime = currentTime;

    if (activeLoadRunner && activeLoadRunner.isRunning) {
      activeLoadRunner.step(dt);
    }

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
      timer.start();
      eventBus.emit(EVENTS.BUILD_STARTED);
    }
  }

  console.log('[Technothlon Bridge Game] Initialization complete. Phase 14 Build Timer active.');
}

window.addEventListener('DOMContentLoaded', initApp);
