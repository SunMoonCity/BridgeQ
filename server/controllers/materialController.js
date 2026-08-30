'use strict';

const MaterialConfig = require('../models/MaterialConfig');

// Default initial materials list for auto-seeding
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
 * GET /api/admin/materials
 * Returns all material configs. Seeds default materials if collection is empty.
 */
async function getMaterialConfigsAdmin(req, res) {
  try {
    let materials = await MaterialConfig.find().sort({ createdAt: -1 });

    if (!materials || materials.length === 0) {
      materials = await MaterialConfig.insertMany(DEFAULT_MATERIALS);
    }

    return res.status(200).json({
      success: true,
      data: materials
    });
  } catch (err) {
    console.error('[materialController] getMaterialConfigsAdmin error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch material configurations' });
  }
}

/**
 * POST /api/admin/materials
 * Creates a new MaterialConfig entry
 */
async function createMaterialConfig(req, res) {
  try {
    const {
      key,
      label,
      price,
      youngsModulus,
      tensileStrength,
      compressionStrength,
      density,
      color
    } = req.body;

    if (!key || !label || price === undefined) {
      return res.status(400).json({ success: false, message: 'Key, label, and price are required' });
    }

    const cleanKey = key.toLowerCase().trim();

    const existing = await MaterialConfig.findOne({ key: cleanKey });
    if (existing) {
      return res.status(400).json({ success: false, message: `Material key "${cleanKey}" already exists` });
    }

    const material = await MaterialConfig.create({
      key: cleanKey,
      label: label.trim(),
      price: Number(price),
      youngsModulus: youngsModulus !== undefined ? Number(youngsModulus) : 200000,
      tensileStrength: tensileStrength !== undefined ? Number(tensileStrength) : 100,
      compressionStrength: compressionStrength !== undefined ? Number(compressionStrength) : 90,
      density: density !== undefined ? Number(density) : 7.8,
      color: color ? color.trim() : '#475569'
    });

    return res.status(201).json({
      success: true,
      message: 'Material configuration created successfully',
      data: material
    });
  } catch (err) {
    console.error('[materialController] createMaterialConfig error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Server error creating material' });
  }
}

/**
 * PUT /api/admin/materials/:id
 * Updates an existing MaterialConfig by ID
 */
async function updateMaterialConfig(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;

    const material = await MaterialConfig.findById(id);
    if (!material) {
      return res.status(404).json({ success: false, message: 'Material configuration not found' });
    }

    if (updates.label !== undefined) material.label = updates.label.trim();
    if (updates.price !== undefined) material.price = Number(updates.price);
    if (updates.youngsModulus !== undefined) material.youngsModulus = Number(updates.youngsModulus);
    if (updates.tensileStrength !== undefined) material.tensileStrength = Number(updates.tensileStrength);
    if (updates.compressionStrength !== undefined) material.compressionStrength = Number(updates.compressionStrength);
    if (updates.density !== undefined) material.density = Number(updates.density);
    if (updates.color !== undefined) material.color = updates.color.trim();

    await material.save();

    return res.status(200).json({
      success: true,
      message: 'Material configuration updated successfully',
      data: material
    });
  } catch (err) {
    console.error('[materialController] updateMaterialConfig error:', err);
    return res.status(500).json({ success: false, message: 'Server error updating material' });
  }
}

/**
 * DELETE /api/admin/materials/:id
 * Deletes a MaterialConfig entry
 */
async function deleteMaterialConfig(req, res) {
  try {
    const { id } = req.params;

    const material = await MaterialConfig.findByIdAndDelete(id);
    if (!material) {
      return res.status(404).json({ success: false, message: 'Material configuration not found' });
    }

    return res.status(200).json({
      success: true,
      message: `Material "${material.label}" deleted successfully`
    });
  } catch (err) {
    console.error('[materialController] deleteMaterialConfig error:', err);
    return res.status(500).json({ success: false, message: 'Server error deleting material' });
  }
}

module.exports = {
  getMaterialConfigsAdmin,
  createMaterialConfig,
  updateMaterialConfig,
  deleteMaterialConfig
};
