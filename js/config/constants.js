// constants.js - Central configuration constants

export const SNAP_TOLERANCE = 0.05; // Maximum distance to snap to an existing canonical vertex

export const GAME_STATES = Object.freeze({
  LOGIN: 'LOGIN',
  STAGE_SELECT: 'STAGE_SELECT',
  ROUND_INTRO: 'ROUND_INTRO',
  BUILDING: 'BUILDING',
  FINALIZING: 'FINALIZING',
  TESTING: 'TESTING',
  STAGE_RESULT: 'STAGE_RESULT',
  ROUND_SUMMARY: 'ROUND_SUMMARY',
  GAME_OVER: 'GAME_OVER'
});

export const EVENTS = Object.freeze({
  STATE_CHANGED: 'STATE_CHANGED',
  ROUND_LOADED: 'ROUND_LOADED',
  BUILD_STARTED: 'BUILD_STARTED',
  PIECE_PLOTTED: 'PIECE_PLOTTED',
  PIECE_DELETED: 'PIECE_DELETED',
  BUDGET_CHANGED: 'BUDGET_CHANGED',
  TIMER_TICK: 'TIMER_TICK',
  TIMER_EXPIRED: 'TIMER_EXPIRED',
  TEST_STARTED: 'TEST_STARTED',
  STAGE_COMPLETED: 'STAGE_COMPLETED',
  STAGE_FAILED: 'STAGE_FAILED',
  ROUND_COMPLETED: 'ROUND_COMPLETED',
  NOTIFICATION: 'NOTIFICATION'
});

export const PHYSICS_CONFIG = Object.freeze({
  TIMESTEP: 1 / 60, // 60 Hz fixed timestep
  SUBSTEPS: 8,       // Solver sub-iterations per timestep
  GRAVITY: -9.81,    // m/s^2 (downwards in coordinate system where +y is up)
  DAMPING: 0.995     // Velocity damping
});
