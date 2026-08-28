// core.test.js - Unit tests for EventBus, GameState, and Math utilities

import assert from 'node:assert';
import { eventBus } from '../js/core/event-bus.js';
import { gameState } from '../js/core/game-state.js';
import { GAME_STATES, EVENTS, SNAP_TOLERANCE } from '../js/config/constants.js';
import { distance, pointsNearlyEqual, clamp, lerp } from '../js/utils/math.js';

console.log('Testing Core Architecture & EventBus...');

// 1. Test EventBus publish/subscribe
let eventReceived = false;
let receivedPayload = null;

const unsubscribe = eventBus.on(EVENTS.STATE_CHANGED, (data) => {
  eventReceived = true;
  receivedPayload = data;
});

eventBus.emit(EVENTS.STATE_CHANGED, { from: 'IDLE', to: GAME_STATES.BUILDING });

assert.strictEqual(eventReceived, true, 'EventBus should receive emitted event');
assert.strictEqual(receivedPayload.to, GAME_STATES.BUILDING, 'Payload should contain target state');

// 2. Test Unsubscribe
eventReceived = false;
unsubscribe();
eventBus.emit(EVENTS.STATE_CHANGED, { from: 'BUILDING', to: GAME_STATES.TESTING });
assert.strictEqual(eventReceived, false, 'Unsubscribed listener should not receive events');

// 3. Test GameState transitions
gameState.transitionTo(GAME_STATES.BUILDING);
assert.strictEqual(gameState.is(GAME_STATES.BUILDING), true, 'GameState should be BUILDING');

// 4. Test Math & Geometry utils
assert.strictEqual(distance(0, 0, 3, 4), 5, 'Distance between (0,0) and (3,4) must be 5');
assert.strictEqual(pointsNearlyEqual({ x: 10, y: 5 }, { x: 10.02, y: 5.01 }, SNAP_TOLERANCE), true, 'Points within SNAP_TOLERANCE must be nearly equal');
assert.strictEqual(pointsNearlyEqual({ x: 10, y: 5 }, { x: 10.1, y: 5 }, SNAP_TOLERANCE), false, 'Points outside SNAP_TOLERANCE must not be nearly equal');
assert.strictEqual(clamp(150, 0, 100), 100, 'Clamp should constrain upper bound');
assert.strictEqual(clamp(-10, 0, 100), 0, 'Clamp should constrain lower bound');
assert.strictEqual(lerp(10, 20, 0.5), 15, 'Lerp should interpolate midpoint');

console.log('  PASS: Core & EventBus tests');
