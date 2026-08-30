'use strict';

const mongoose = require('mongoose');

const MaterialConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    label: {
      type: String,
      required: true,
      trim: true
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    youngsModulus: {
      type: Number,
      default: 200000
    },
    tensileStrength: {
      type: Number,
      default: 100
    },
    compressionStrength: {
      type: Number,
      default: 90
    },
    density: {
      type: Number,
      default: 7.8
    },
    color: {
      type: String,
      default: '#475569'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('MaterialConfig', MaterialConfigSchema);
