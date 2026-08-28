// main.js - Application entry point

import { gameState } from './core/game-state.js';
import { hud } from './ui/hud.js';
import { character } from './ui/character.js';
import { budgetManager } from './economy/budget.js';
import { getRoundConfig } from './config/round-config.js';
import { GAME_STATES, EVENTS } from './config/constants.js';
import { eventBus } from './core/event-bus.js';

function initApp() {
  console.log('[Technothlon Bridge Game] Initializing Phase 1 Skeleton...');

  // Initialize UI systems
  hud.init();
  character.init();

  // Load Round 1 config
  const round1 = getRoundConfig(1);
  if (round1) {
    budgetManager.init(round1.budget);
    gameState.setRound(1, round1);
  }

  // Setup construction panel reveal on click/interaction (wireframe requirement)
  const leftZone = document.getElementById('leftConstructionZone');
  const constructionCard = document.getElementById('constructionCard');
  const canvas = document.getElementById('gameCanvas');

  // Fit canvas to window
  function resizeCanvas() {
    if (canvas) {
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
      drawInitialPlaceholder(canvas);
    }
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // Reveal construction on left cliff click
  if (canvas) {
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      if (x < 350 && !constructionCard.classList.contains('active')) {
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
      gameState.transitionTo(GAME_STATES.BUILDING);
      eventBus.emit(EVENTS.BUILD_STARTED);
    }
  }

  console.log('[Technothlon Bridge Game] Initialization complete.');
}

function drawInitialPlaceholder(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;

  // Background
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, w, h);

  // Coordinate Grid lines
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  const gridSize = 40;
  for (let x = 0; x < w; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Left & Right Cliffs
  const groundY = h * 0.65;
  const cliffW = 200;

  // Left cliff
  ctx.fillStyle = '#78350f';
  ctx.fillRect(0, groundY, cliffW, h - groundY);
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(0, groundY, cliffW, 20);

  // Right cliff
  ctx.fillStyle = '#78350f';
  ctx.fillRect(w - cliffW, groundY, cliffW, h - groundY);
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(w - cliffW, groundY, cliffW, 20);

  // Fixed Anchor Circles
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(cliffW, groundY, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(w - cliffW, groundY, 6, 0, Math.PI * 2);
  ctx.fill();
}

window.addEventListener('DOMContentLoaded', initApp);
