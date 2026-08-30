'use strict';

const express = require('express');
const router  = express.Router();

const {
  getMaterialConfigsAdmin,
  createMaterialConfig,
  updateMaterialConfig,
  deleteMaterialConfig
} = require('../controllers/materialController');

const { authenticateToken } = require('../middleware/authMiddleware');
const { requireAdmin }      = require('../middleware/adminMiddleware');

// All admin material routes require valid JWT AND admin role
router.use(authenticateToken, requireAdmin);

router.get('/',         getMaterialConfigsAdmin);
router.post('/',        createMaterialConfig);
router.put('/:id',      updateMaterialConfig);
router.delete('/:id',   deleteMaterialConfig);

module.exports = router;
