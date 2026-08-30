'use strict';

const mongoose = require('mongoose');

const RoundProgressSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true
    },
    roundNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 3
    },
    roundName: {
      type: String,
      required: true,
      trim: true
    },
    isUnlocked: {
      type: Boolean,
      default: false
    },
    isCompleted: {
      type: Boolean,
      default: false
    },
    stagesPassed: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    totalStages: {
      type: Number,
      default: 5
    },
    budgetRemaining: {
      type: Number,
      required: true
    },
    totalBudget: {
      type: Number,
      required: true
    },
    timeRemaining: {
      type: Number,
      required: true
    },
    totalTime: {
      type: Number,
      required: true
    },
    placedPieces: {
      type: Array,
      default: []
    }
  },
  {
    timestamps: true
  }
);

// Ensure a single round progress document per student per roundNumber
RoundProgressSchema.index({ student: 1, roundNumber: 1 }, { unique: true });

module.exports = mongoose.model('RoundProgress', RoundProgressSchema);
