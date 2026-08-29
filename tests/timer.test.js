// timer.test.js - Automated tests for Phase 14: Build Timer System

import assert from 'node:assert';
import { timer } from '../js/core/timer.js';
import { eventBus } from '../js/core/event-bus.js';
import { EVENTS } from '../js/config/constants.js';

console.log('Testing Build Timer System (Phase 14)...');

// 1. Initial State & Initialization
{
  timer.init(300);
  assert.strictEqual(timer.getRemaining(), 300, 'Initial remaining seconds must equal round duration');
  assert.strictEqual(timer.isRunning, false, 'Timer should not be running until start()');
  assert.strictEqual(timer.isExpired, false, 'Timer should not be expired initially');
}

// 2. Timer Tick Event & Countdown
{
  timer.init(10);

  let tickCount = 0;
  let lastSeconds = null;

  const tickHandler = (seconds) => {
    tickCount++;
    lastSeconds = seconds;
  };

  eventBus.on(EVENTS.TIMER_TICK, tickHandler);

  timer.tick(); // Manual single tick
  assert.strictEqual(timer.getRemaining(), 9, 'Remaining time should decrement by 1');
  assert.strictEqual(lastSeconds, 9, 'TIMER_TICK event should report updated remaining seconds');

  eventBus.off(EVENTS.TIMER_TICK, tickHandler);
}

// 3. Expiration & Lock Event
{
  timer.init(2);

  let expiredFired = false;
  const expiredHandler = () => {
    expiredFired = true;
  };

  eventBus.on(EVENTS.TIMER_EXPIRED, expiredHandler);

  timer.tick(); // 1s left
  assert.strictEqual(timer.remainingSeconds, 1);
  assert.strictEqual(expiredFired, false);

  timer.tick(); // 0s left -> EXPIRED
  assert.strictEqual(timer.remainingSeconds, 0);
  assert.strictEqual(timer.isExpired, true, 'isExpired flag must be true');
  assert.strictEqual(expiredFired, true, 'TIMER_EXPIRED event must be emitted');

  eventBus.off(EVENTS.TIMER_EXPIRED, expiredHandler);
}

// 4. Single Instance Protection (Restarting clears previous interval)
{
  timer.init(60);
  timer.start();
  const firstIntervalId = timer.intervalId;
  assert.ok(firstIntervalId !== null, 'Interval ID must be assigned on start()');

  // Call start() again on running timer
  timer.start();
  assert.strictEqual(timer.isRunning, true);

  timer.stop();
  assert.strictEqual(timer.intervalId, null, 'Interval ID must be cleared on stop()');
  assert.strictEqual(timer.isRunning, false, 'isRunning must be false after stop()');
}

// 5. Timer Reset
{
  timer.init(120);
  timer.tick();
  timer.tick();
  assert.strictEqual(timer.getRemaining(), 118);

  timer.reset();
  assert.strictEqual(timer.getRemaining(), 120, 'Reset must restore initial duration');
  assert.strictEqual(timer.isRunning, false, 'Reset must leave timer stopped');
}

console.log('  PASS: Build Timer System (Phase 14) tests');
