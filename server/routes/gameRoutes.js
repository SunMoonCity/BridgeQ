'use strict';

const express = require('express');
const router  = express.Router();

const {
  getRoundProgress,
  updateRoundProgress,
  getMaterialConfigs
} = require('../controllers/gameController');

const RoundConfig = require('../models/RoundConfig');
const { authenticateToken } = require('../middleware/authMiddleware');

// All game routes require authentication
router.use(authenticateToken);

router.get('/progress',                       getRoundProgress);
router.put('/progress/:roundNumber',         updateRoundProgress);
router.get('/materials',                      getMaterialConfigs);

// Aliases for state & round endpoints
router.get('/state/:roundKey',                getRoundProgress);
router.put('/state/:roundKey',                (req, res, next) => {
  const roundNum = parseInt(String(req.params.roundKey).replace(/\D/g, ''), 10) || 1;
  req.params.roundNumber = roundNum;
  return updateRoundProgress(req, res, next);
});

router.get('/rounds', async (req, res) => {
  try {
    const rounds = await RoundConfig.find().sort({ roundNumber: 1 });
    return res.json({ success: true, data: rounds });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch rounds' });
  }
});

module.exports = router;
