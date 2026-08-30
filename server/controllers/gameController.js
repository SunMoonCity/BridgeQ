'use strict';

const RoundProgress  = require('../models/RoundProgress');
const MaterialConfig = require('../models/MaterialConfig');
const RoundConfig    = require('../models/RoundConfig');

// Default initial round definitions
const DEFAULT_ROUNDS = [
  {
    roundNumber: 1,
    roundName: 'Round 1 - The First Crossing',
    budget: 5000000,
    buildTimeSeconds: 300,
    description: 'Construct a foundational bridge structure across the initial ravine.',
    isUnlockedByDefault: true
  },
  {
    roundNumber: 2,
    roundName: 'Round 2 - Heavy Logistics',
    budget: 3500000,
    buildTimeSeconds: 240,
    description: 'Sustain heavy vehicular transport with strict budget constraints.',
    isUnlockedByDefault: false
  },
  {
    roundNumber: 3,
    roundName: 'Round 3 - Elevation Asymmetry',
    budget: 4000000,
    buildTimeSeconds: 300,
    description: 'Engineer asymmetrical support structures across steep cliff heights.',
    isUnlockedByDefault: false
  }
];

// Default materials list
const DEFAULT_MATERIALS = [
  {
    key: 'steel',
    label: 'Steel',
    price: 15,
    youngsModulus: 200000,
    tensileStrength: 100,
    compressionStrength: 90,
    density: 7.8,
    color: '#475569'
  },
  {
    key: 'wood',
    label: 'Wood',
    price: 6,
    youngsModulus: 50000,
    tensileStrength: 45,
    compressionStrength: 35,
    density: 0.6,
    color: '#b45309'
  },
  {
    key: 'concrete',
    label: 'Concrete',
    price: 10,
    youngsModulus: 150000,
    tensileStrength: 25,
    compressionStrength: 140,
    density: 2.4,
    color: '#94a3b8'
  },
  {
    key: 'road',
    label: 'Road Deck',
    price: 20,
    youngsModulus: 180000,
    tensileStrength: 220,
    compressionStrength: 140,
    density: 3.5,
    color: '#1e293b'
  },
  {
    key: 'carpet',
    label: 'Carpet Surface',
    price: 12,
    youngsModulus: 80000,
    tensileStrength: 30,
    compressionStrength: 20,
    density: 1.2,
    color: '#7c3aed'
  }
];

/**
 * GET /api/game/progress
 * Retrieves student's round progress records from DB. Initializes defaults if missing.
 */
async function getRoundProgress(req, res) {
  try {
    const studentId = req.user._id;

    // Fetch configured competition rounds from DB (or seed defaults)
    let configuredRounds = await RoundConfig.find().sort({ roundNumber: 1 });
    if (!configuredRounds || configuredRounds.length === 0) {
      configuredRounds = await RoundConfig.insertMany(DEFAULT_ROUNDS);
    }

    let records = await RoundProgress.find({ student: studentId }).sort({ roundNumber: 1 });

    // Initialize round progress if first time student accesses game or new rounds added
    if (!records || records.length === 0) {
      const initialDocs = configuredRounds.map(r => ({
        student: studentId,
        roundNumber: r.roundNumber,
        roundName: r.roundName,
        isUnlocked: r.roundNumber === 1 || r.isUnlockedByDefault,
        isCompleted: false,
        stagesPassed: 0,
        totalStages: 5,
        budgetRemaining: r.budget,
        totalBudget: r.budget,
        timeRemaining: r.buildTimeSeconds,
        totalTime: r.buildTimeSeconds,
        placedPieces: []
      }));

      records = await RoundProgress.insertMany(initialDocs);
    }

    return res.status(200).json({
      success: true,
      data: records
    });
  } catch (err) {
    console.error('[gameController] getRoundProgress error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch round progress' });
  }
}

/**
 * PUT /api/game/progress/:roundNumber
 * Updates progress for a specific round (time, budget, stages passed, pieces, completion).
 * Unlocks next round automatically if completed or stagesPassed === 5.
 */
async function updateRoundProgress(req, res) {
  try {
    const studentId = req.user._id;
    const roundNum = parseInt(req.params.roundNumber, 10);

    if (isNaN(roundNum) || roundNum < 1 || roundNum > 3) {
      return res.status(400).json({ success: false, message: 'Invalid round number' });
    }

    const {
      timeRemaining,
      budgetRemaining,
      stagesPassed,
      placedPieces,
      isCompleted
    } = req.body;

    let record = await RoundProgress.findOne({ student: studentId, roundNumber: roundNum });

    // Block modification if round was already completed
    if (record && record.isCompleted) {
      return res.status(403).json({
        success: false,
        message: `Round ${roundNum} is already completed. Completed round data cannot be overwritten or modified.`
      });
    }

    if (!record) {
      const def = DEFAULT_ROUNDS.find(r => r.roundNumber === roundNum) || DEFAULT_ROUNDS[0];
      record = new RoundProgress({
        student: studentId,
        roundNumber: roundNum,
        roundName: def.roundName,
        isUnlocked: roundNum === 1,
        totalBudget: def.budgetRemaining || def.budget || 5000000,
        budgetRemaining: def.budgetRemaining || def.budget || 5000000,
        totalTime: def.timeRemaining || def.buildTimeSeconds || 300,
        timeRemaining: def.timeRemaining || def.buildTimeSeconds || 300
      });
    }

    if (timeRemaining !== undefined) record.timeRemaining = Math.max(0, timeRemaining);
    if (budgetRemaining !== undefined) record.budgetRemaining = Math.max(0, budgetRemaining);
    if (stagesPassed !== undefined) record.stagesPassed = Math.min(5, Math.max(record.stagesPassed, stagesPassed));
    if (placedPieces !== undefined) record.placedPieces = placedPieces;

    if (isCompleted || record.stagesPassed >= 5) {
      record.isCompleted = true;
    }

    await record.save();

    // If completed, unlock next round (e.g. Round 1 -> unlock Round 2)
    let nextRecord = null;
    if ((record.isCompleted || record.stagesPassed > 0) && roundNum < 3) {
      const nextRoundNum = roundNum + 1;
      nextRecord = await RoundProgress.findOne({ student: studentId, roundNumber: nextRoundNum });

      if (!nextRecord) {
        const nextDef = DEFAULT_ROUNDS.find(r => r.roundNumber === nextRoundNum);
        nextRecord = new RoundProgress({
          student: studentId,
          roundNumber: nextRoundNum,
          roundName: nextDef.roundName,
          isUnlocked: true,
          totalBudget: nextDef.totalBudget,
          budgetRemaining: nextDef.budgetRemaining,
          totalTime: nextDef.totalTime,
          timeRemaining: nextDef.timeRemaining
        });
      } else {
        nextRecord.isUnlocked = true;
      }
      await nextRecord.save();
    }

    const allRecords = await RoundProgress.find({ student: studentId }).sort({ roundNumber: 1 });

    return res.status(200).json({
      success: true,
      message: 'Round progress saved',
      data: allRecords
    });
  } catch (err) {
    console.error('[gameController] updateRoundProgress error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update round progress' });
  }
}

/**
 * GET /api/game/materials
 * Retrieves material configs & pricing. Seeds default items if DB is empty.
 */
async function getMaterialConfigs(req, res) {
  try {
    let materials = await MaterialConfig.find().sort({ price: 1 });

    if (!materials || materials.length === 0) {
      materials = await MaterialConfig.insertMany(DEFAULT_MATERIALS);
    }

    return res.status(200).json({
      success: true,
      data: materials
    });
  } catch (err) {
    console.error('[gameController] getMaterialConfigs error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch material configs' });
  }
}

module.exports = {
  getRoundProgress,
  updateRoundProgress,
  getMaterialConfigs
};
