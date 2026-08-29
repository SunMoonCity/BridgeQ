import { eventBus } from '../core/event-bus.js';
import { EVENTS } from '../config/constants.js';

export const EMOTIONS = Object.freeze({
  NEUTRAL: '😐',
  THINKING: '🤔',
  HAPPY: '🙂',
  EXCITED: '😄',
  TRIUMPHANT: '🤩',
  WORRIED: '😰',
  SAD: '😢'
});

export class CharacterSystem {
  constructor() {
    this.avatarEl = null;
    this.dialogueEl = null;
    this.currentEmotion = EMOTIONS.NEUTRAL;
    this.currentMessage = '';
    this.history = [];
  }

  init(avatarEl = null, dialogueEl = null) {
    this.avatarEl = avatarEl || document.getElementById('characterAvatar');
    this.dialogueEl = dialogueEl || document.getElementById('characterDialogue');

    this.setEmotion(EMOTIONS.NEUTRAL);
    this.say('Welcome to Technothlon! Click on the left cliff to begin bridge construction.');

    eventBus.on(EVENTS.BUILD_STARTED, () => {
      this.setEmotion(EMOTIONS.THINKING);
      this.say('Enter your mathematical equation to plot the first bridge beam!');
    });

    eventBus.on(EVENTS.PIECE_PLOTTED, () => {
      this.setEmotion(EMOTIONS.HAPPY);
      this.say('Nice curve! Make sure all pieces connect firmly to the cliffs.');
    });

    eventBus.on(EVENTS.PIECE_DELETED, () => {
      this.setEmotion(EMOTIONS.THINKING);
      this.say('Piece removed. Sometimes a fresh approach is the best approach!');
    });

    eventBus.on(EVENTS.TEST_STARTED, () => {
      this.setEmotion(EMOTIONS.EXCITED);
      this.say('Pre-flight check passed! Initiating load simulation...');
    });

    eventBus.on(EVENTS.STAGE_COMPLETED, ({ stage, totalStages }) => {
      const isFinal = stage >= (totalStages || 5);
      this.setEmotion(isFinal ? EMOTIONS.TRIUMPHANT : EMOTIONS.EXCITED);
      this.say(isFinal ? `Stage ${stage}/${totalStages || 5} passed! The bridge held against maximum load!` : `Stage ${stage} passed cleanly! Structural integrity holding!`);
    });

    eventBus.on(EVENTS.STAGE_FAILED, ({ stage, reason }) => {
      this.setEmotion(EMOTIONS.SAD);
      this.say(`Stage ${stage} collapsed! Failure reason: ${reason || 'Structural overload'}.`);
    });

    eventBus.on(EVENTS.ROUND_LOADED, ({ roundNumber, roundConfig }) => {
      this.setEmotion(EMOTIONS.NEUTRAL);
      this.say(`Round ${roundNumber} loaded! ${roundConfig ? roundConfig.label : ''}. Prepare your equations!`);
    });
  }

  setEmotion(emoji) {
    this.currentEmotion = emoji;
    if (this.avatarEl) {
      this.avatarEl.textContent = emoji;
    }
  }

  say(message) {
    this.currentMessage = message;
    this.history.push({ emotion: this.currentEmotion, message, timestamp: Date.now() });
    if (this.dialogueEl) {
      this.dialogueEl.textContent = message;
    }
  }

  getEmotion() {
    return this.currentEmotion;
  }

  getMessage() {
    return this.currentMessage;
  }
}

export const character = new CharacterSystem();

