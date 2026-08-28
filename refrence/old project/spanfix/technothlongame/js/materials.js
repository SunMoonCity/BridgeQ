// materials.js
// Owns: material property data (elasticity, tensile/compression strength,
// brittleness) and cost-per-unit for each material option, plus small
// read-only accessors. Does NOT calculate total piece cost or track
// budget — that's budget.js's job (it will import MATERIALS from here).
// -----------------------------------------------------------------------
// A. The material data itself. Keys here MUST exactly match the values
// used in the materialInput <select> in index.html, because that value
// flows straight through createPiece() -> piece.material -> and is used
// as materialsLookup[piece.material] in physics.js's buildPiece(). Any
// mismatch (e.g. "Steel" vs "steel") means physics.js silently gets
// `undefined` and buildConstraint() will throw.
// -----------------------------------------------------------------------
const MATERIALS = {
  plastic: {
    label: 'Plastic',
    elasticity: 0.3,
    tensileStrength: 20,
    compressionStrength: 15,
    brittleness: 40,
    costPerUnit: 5
  },
  steel: {
    label: 'Steel',
    elasticity: 0.8,
    tensileStrength: 80,
    compressionStrength: 90,
    brittleness: 15,
    costPerUnit: 15
  },
  iron: {
    label: 'Iron',
    elasticity: 0.6,
    tensileStrength: 60,
    compressionStrength: 100,
    brittleness: 35,
    costPerUnit: 25
  }
};
// -----------------------------------------------------------------------
// B. List form — for populating the <select> dropdown without the UI
// code needing to know the internal shape of MATERIALS.
// -----------------------------------------------------------------------
function getMaterialsList() {
  return Object.keys(MATERIALS).map(key => ({
    key,
    label: MATERIALS[key].label,
    costPerUnit: MATERIALS[key].costPerUnit
  }));
}
// -----------------------------------------------------------------------
// C. Single lookup with a safety check — physics.js currently trusts
// materialsLookup[piece.material] blindly; this gives graph.js/ui.js a
// way to validate BEFORE a piece ever reaches physics.js.
// -----------------------------------------------------------------------
function getMaterial(key) {
  return MATERIALS[key] || null;
}
function isValidMaterial(key) {
  return Object.prototype.hasOwnProperty.call(MATERIALS, key);
}
// -----------------------------------------------------------------------
// D. Exports
// -----------------------------------------------------------------------
export {
  MATERIALS,
  getMaterialsList,
  getMaterial,
  isValidMaterial
};