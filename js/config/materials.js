// materials.js - Material physical properties and costs

export const MATERIALS = Object.freeze({
  steel: {
    key: 'steel',
    label: 'Steel',
    youngsModulus: 200e3,  // Elastic stiffness
    tensileStrength: 120,   // Max tension stress limit
    compressionStrength: 100,// Max compression stress limit
    density: 7.8,          // Density for mass calculation
    costPerUnit: 15,       // Currency per unit length
    color: '#475569'
  },
  wood: {
    key: 'wood',
    label: 'Wood',
    youngsModulus: 50e3,
    tensileStrength: 45,
    compressionStrength: 35,
    density: 0.6,
    costPerUnit: 6,
    color: '#b45309'
  },
  concrete: {
    key: 'concrete',
    label: 'Concrete',
    youngsModulus: 150e3,
    tensileStrength: 25,    // Weak in tension
    compressionStrength: 140,// Very strong in compression
    density: 2.4,
    costPerUnit: 10,
    color: '#94a3b8'
  },
  road: {
    key: 'road',
    label: 'Road Deck',
    youngsModulus: 180e3,
    tensileStrength: 100,
    compressionStrength: 110,
    density: 3.5,
    costPerUnit: 20,
    color: '#1e293b'
  }
});

export function getMaterial(key) {
  return MATERIALS[key] || null;
}

export function isValidMaterial(key) {
  return Object.prototype.hasOwnProperty.call(MATERIALS, key);
}

export function getMaterialsList() {
  return Object.values(MATERIALS);
}
