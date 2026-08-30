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

import { PieceManager } from './builder/piece-manager.js';

let renderer = null;
let graph = null;
let buildController = null;
const savedRoundProgressMap = new Map();

async function initApp() {
  console.log('[Technothlon Bridge Game] Initializing Application...');

  // 1. Authentication Guard: verify token with backend
  if (window.TechnoBridgeAPI) {
    try {
      const authData = await window.TechnoBridgeAPI.me();
      if (!authData || !authData.user) {
        window.location.href = 'frontend/login.html';
        return;
      }
      console.log('[Main] Authenticated student:', authData.user.rollNo);
    } catch (_) {
      console.warn('[Main] Unauthenticated access. Redirecting to login page...');
      window.location.href = 'frontend/login.html';
      return;
    }
  }

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

  // 2. Restore stage unlocks & round state from backend database
  let defaultActiveRound = 1;
  if (window.TechnoBridgeAPI) {
    try {
      const res = await window.TechnoBridgeAPI.getRoundProgress();
      if (res && res.success && Array.isArray(res.data)) {
        res.data.forEach(rec => {
          savedRoundProgressMap.set(rec.roundNumber, rec);
          if (rec.isUnlocked) {
            stageSelectManager.unlockStage(rec.roundNumber);
            if (!rec.isCompleted) {
              defaultActiveRound = rec.roundNumber;
            }
          }
        });
      }
    } catch (err) {
      console.warn('[Main] DB progress fetch error:', err.message);
    }
  }

  // Parse URL query parameter (e.g. ?round=round1 or ?round=round2 or ?round=2)
  const urlParams = new URLSearchParams(window.location.search);
  const rawRoundParam = urlParams.get('round');
  let requestedRoundNum = null;
  if (rawRoundParam) {
    requestedRoundNum = parseInt(rawRoundParam.replace(/\D/g, ''), 10);
  }

  let targetRound = requestedRoundNum || parseInt(sessionStorage.getItem('activeRound'), 10) || defaultActiveRound || 1;

  // URL Parameter Verification & Security Guard
  const targetRec = savedRoundProgressMap.get(targetRound);
  if (targetRec) {
    if (!targetRec.isUnlocked) {
      toast.show(`Round ${targetRound} is locked! Redirecting to active round...`, 'warning');
      targetRound = defaultActiveRound;
    } else if (targetRec.isCompleted) {
      const nextUnlocked = Array.from(savedRoundProgressMap.values()).find(r => r.isUnlocked && !r.isCompleted);
      if (nextUnlocked) {
        toast.show(`Round ${targetRound} is already completed! Loading Round ${nextUnlocked.roundNumber}...`, 'info');
        targetRound = nextUnlocked.roundNumber;
      }
    }
  }

  sessionStorage.setItem('activeRound', targetRound);

  let activeLoadRunner = null;
  let activeSimulation = null;

  // Build Controller — wires all construction card inputs
  buildController = new BuildController({
    graph,
    budgetManager,
    renderer,
    roundConfig: getRoundConfig(targetRound),
    character
  });
  buildController.init();

  // GameController binding — ensures renderer and graph are attached before loading round
  gameController.bindDependencies({
    graph,
    renderer,
    buildController
  });

  // Helper function to load round environment and restore bridge pieces & stats from DB
  function loadAndRestoreRound(roundNum) {
    activeLoadRunner = null;
    activeSimulation = null;
    if (renderer) renderer.setSimulationState(null, null, []);
    stageSelectManager.hide();
    gameController.loadRound(roundNum);

    const rec = savedRoundProgressMap.get(roundNum);
    if (rec) {
      if (rec.timeRemaining !== undefined && rec.timeRemaining > 0) {
        timer.remainingSeconds = rec.timeRemaining;
        eventBus.emit(EVENTS.TIMER_TICK, timer.remainingSeconds);
      }

      if (Array.isArray(rec.placedPieces) && rec.placedPieces.length > 0) {
        const rConfig = gameState.activeRoundConfig || getRoundConfig(roundNum);
        if (rConfig && budgetManager) budgetManager.init(rConfig.budget);

        rec.placedPieces.forEach(p => {
          PieceManager.addPieceTransaction(graph, budgetManager, gameState.activeRoundConfig, {
            equation: p.equation,
            orientation: p.orientation || 'y-of-x',
            rangeMin: p.rangeMin !== undefined ? p.rangeMin : 0,
            rangeMax: p.rangeMax !== undefined ? p.rangeMax : 600,
            material: p.material || 'steel',
            isRoad: p.isRoad || p.material === 'road',
            skipBudgetCheck: true
          });
        });
      }

      if (rec.budgetRemaining !== undefined && budgetManager) {
        budgetManager.remainingBudget = rec.budgetRemaining;
      }
    }

    if (renderer) renderer.render();
    toast.show(`Stage ${roundNum} Loaded! Click left cliff to build.`, 'info');
  }

  // Load target round directly on app init (ensures cliffs and environment are drawn on renderer)
  loadAndRestoreRound(targetRound);

  // Wire Stage Selection (Phase 18) -> hides Stage Overlay and loads selected round
  eventBus.on(EVENTS.STAGE_SELECTED || 'STAGE_SELECTED', ({ roundNumber }) => {
    sessionStorage.setItem('activeRound', roundNumber);
    loadAndRestoreRound(roundNumber);
  });

  // Listen for TEST_STARTED -> convert graph to physics, initialize simulation & load runner
  eventBus.on(EVENTS.TEST_STARTED, ({ graph, summary }) => {
    console.log('[Main] Finalizing graph and initializing physics simulation...');
    
    // 1. Convert LogicalGraph 1:1 into PhysicsWorld
    const physicsWorld = PhysicsBridgeBuilder.buildPhysicsWorld(graph);
    
    // 2. Instantiate PhysicsSimulation engine
    activeSimulation = new PhysicsSimulation(physicsWorld);
    
    // 3. Instantiate LoadTestRunner
    const roundConfig = gameState.activeRoundConfig || getRoundConfig(gameController.currentRoundNumber || 1);
    activeLoadRunner = new LoadTestRunner(activeSimulation, roundConfig);

    // Update renderer continuously during simulation
    activeLoadRunner.onProgress = ({ vehicles }) => {
      if (renderer && activeSimulation) {
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
