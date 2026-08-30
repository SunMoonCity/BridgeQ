'use strict';

const express = require('express');
const router  = express.Router();

const {
  getRoundConfigsAdmin,
  createRoundConfig,
  updateRoundConfig,
  deleteRoundConfig
} = require('../controllers/adminRoundController');

const { authenticateToken } = require('../middleware/authMiddleware');
const { requireAdmin }      = require('../middleware/adminMiddleware');

// All admin round routes require valid JWT AND admin role
router.use(authenticateToken, requireAdmin);

router.get('/',       getRoundConfigsAdmin);
router.post('/',      createRoundConfig);
router.put('/:id',    updateRoundConfig);
router.delete('/:id', deleteRoundConfig);

module.exports = router;
