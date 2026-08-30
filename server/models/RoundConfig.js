'use strict';

const mongoose = require('mongoose');

const RoundConfigSchema = new mongoose.Schema(
  {
    roundNumber: {
      type: Number,
      required: true,
      unique: true,
      min: 1
    },
    roundName: {
      type: String,
      required: true,
      trim: true
    },
    budget: {
      type: Number,
      required: true,
      default: 5000000
    },
    buildTimeSeconds: {
      type: Number,
      required: true,
      default: 300
    },
    description: {
      type: String,
      default: 'Construct a structural bridge to sustain vehicular loads.'
    },
    isUnlockedByDefault: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('RoundConfig', RoundConfigSchema);
