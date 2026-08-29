// character.test.js - Automated tests for Phase 16: Brij Bhushan Character Expression & Dialogue Feedback

import assert from 'node:assert';
import { CharacterSystem, EMOTIONS } from '../js/ui/character.js';
import { eventBus } from '../js/core/event-bus.js';
import { EVENTS } from '../js/config/constants.js';

console.log('Testing Character Expression & Dialogue Feedback (Phase 16)...');

// Mock DOM elements
function makeStubElement(initialText = '') {
  return {
    textContent: initialText
  };
}

// 1. Initial State & Initialization
{
  const char = new CharacterSystem();
  const avatarStub = makeStubElement();
  const dialogueStub = makeStubElement();

  char.init(avatarStub, dialogueStub);

  assert.strictEqual(char.getEmotion(), EMOTIONS.NEUTRAL, 'Initial emotion must be NEUTRAL');
  assert.strictEqual(avatarStub.textContent, EMOTIONS.NEUTRAL);
  assert.ok(char.getMessage().includes('Welcome to Technothlon'), 'Initial dialogue must display welcome message');
}

// 2. Emotion & Dialogue Updates on Game Events
{
  const char = new CharacterSystem();
  const avatarStub = makeStubElement();
  const dialogueStub = makeStubElement();
  char.init(avatarStub, dialogueStub);

  // BUILD_STARTED -> THINKING
  eventBus.emit(EVENTS.BUILD_STARTED);
  assert.strictEqual(char.getEmotion(), EMOTIONS.THINKING);
  assert.strictEqual(avatarStub.textContent, EMOTIONS.THINKING);
  assert.ok(char.getMessage().includes('equation'), 'Message should prompt for equation');

  // PIECE_PLOTTED -> HAPPY
  eventBus.emit(EVENTS.PIECE_PLOTTED);
  assert.strictEqual(char.getEmotion(), EMOTIONS.HAPPY);
  assert.strictEqual(avatarStub.textContent, EMOTIONS.HAPPY);

  // STAGE_COMPLETED -> EXCITED / TRIUMPHANT
  eventBus.emit(EVENTS.STAGE_COMPLETED, { stage: 2, totalStages: 5 });
  assert.strictEqual(char.getEmotion(), EMOTIONS.EXCITED);

  eventBus.emit(EVENTS.STAGE_COMPLETED, { stage: 5, totalStages: 5 });
  assert.strictEqual(char.getEmotion(), EMOTIONS.TRIUMPHANT);
  assert.ok(char.getMessage().includes('maximum load'), 'Final stage message should praise bridge stability');

  // STAGE_FAILED -> SAD
  eventBus.emit(EVENTS.STAGE_FAILED, { stage: 3, reason: 'MEMBER_SNAP' });
  assert.strictEqual(char.getEmotion(), EMOTIONS.SAD);
  assert.ok(char.getMessage().includes('collapsed'), 'Failure message should report collapse');
}

// 3. Dialogue History Traversal
{
  const char = new CharacterSystem();
  char.init(makeStubElement(), makeStubElement());

  const initialCount = char.history.length;
  char.say('Custom feedback message 1');
  char.setEmotion(EMOTIONS.HAPPY);
  char.say('Custom feedback message 2');

  assert.strictEqual(char.history.length, initialCount + 2, 'History array must record dialogue entries');
  assert.strictEqual(char.history[char.history.length - 1].message, 'Custom feedback message 2');
  assert.strictEqual(char.history[char.history.length - 1].emotion, EMOTIONS.HAPPY);
}

console.log('  PASS: Character Expression & Dialogue Feedback (Phase 16) tests');
