// character.js - Brij Bhushan avatar, emotions, and dialogue bubble controller

import { eventBus } from '../core/event-bus.js';
import { EVENTS } from '../config/constants.js';

const EMOTIONS = {
  NEUTRAL: '😐',
  THINKING: '🤔',
  HAPPY: '🙂',
  EXCITED: '😄',
  TRIUMPHANT: '🤩',
  WORRIED: '😰',
  SAD: '😢'
};

class CharacterSystem {
  constructor() {
    this.avatarEl = null;
    this.dialogueEl = null;
  }

  init() {
    this.avatarEl = document.getElementById('characterAvatar');
    this.dialogueEl = document.getElementById('characterDialogue');

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

    eventBus.on(EVENTS.STAGE_COMPLETED, ({ stage }) => {
      this.setEmotion(stage >= 4 ? EMOTIONS.TRIUMPHANT : EMOTIONS.EXCITED);
      this.say(`Stage ${stage} passed cleanly! Structural integrity holding!`);
    });

    eventBus.on(EVENTS.STAGE_FAILED, ({ stage, reason }) => {
      this.setEmotion(EMOTIONS.SAD);
      this.say(`Stage ${stage} collapsed! Reason: ${reason || 'Structural stress overload'}.`);
    });
  }

  setEmotion(emoji) {
    if (this.avatarEl) {
      this.avatarEl.textContent = emoji;
    }
  }

  say(message) {
    if (this.dialogueEl) {
      this.dialogueEl.textContent = message;
    }
  }
}

export const character = new CharacterSystem();
