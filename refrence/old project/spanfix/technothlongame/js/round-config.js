// round-config.js
// Owns: DATA ONLY -- cliff positions/heights, ground, budget, and build
// time, per round. Nothing else belongs here.
//
// Explicitly OUT of scope for this file (per project MECE split):
//   - material properties/costs            -> materials.js
//   - which materials are UNLOCKED this round -> encoded here as a rule
//     (materialMode / fixedMaterial below), but the actual material
//     data (elasticity, cost, etc.) still lives in materials.js.
//   - car counts/weights/spacing/stages    -> loadtest.js
//
// COORDINATION FLAG for whoever builds materials.js:
//   Round 1 below references a material by the string key 'steel'.
//   materials.js MUST define a material under that exact key, or
//   Round 1's buildBridge() call (physics.js) will fail to find it in
//   materialsLookup.
//
// SCALE NOTE (locked): 1 meter = 2 units, i.e. 1 unit = 0.5 meters.
// Gap between cliffs is 400 units (200m). Round 1/2 cliff height is 600
// units (300m) above the ground line. This scale was chosen so that
// physics.js's ORIGINAL body sizes (car radius 5, joint radius 3, cliff
// radius 4) sit at sensible small proportions of the span (1.25%, 0.75%,
// 1% respectively) without needing to shrink any of those constants --
// see the project's physics.js size-fix discussion for why this matters.

// -----------------------------------------------------------------------
// A. Shared building blocks
// -----------------------------------------------------------------------

// Round 1 and Round 2 both use equal-height cliffs, so this is defined
// once and reused -- avoids two copies quietly drifting apart.
const SAME_HEIGHT_CLIFFS = [
  { x: 0, y: 600, name: 'Cliff A' },
  { x: 400, y: 600, name: 'Cliff B' }
];

// Ground is the same physical strip under all three rounds for now --
// only the cliff HEIGHTS change in Round 3, not the ground itself.
const STANDARD_GROUND = { y: 0, xMin: 0, xMax: 400 };

// The one material Round 1 locks students into. Must match a key in
// materials.js's export -- see coordination flag above.
const FIXED_MATERIAL_ROUND_1 = 'steel';

// -----------------------------------------------------------------------
// B. Per-round configs
// -----------------------------------------------------------------------
const ROUNDS = [
  // ---- Round 1: fixed material, unlimited budget, equal cliff heights
  {
    id: 1,
    label: 'Round 1',

    cliffs: SAME_HEIGHT_CLIFFS,
    ground: STANDARD_GROUND,

    // materialMode tells ui.js/graph.js whether to even show a material
    // picker at all. 'fixed' = no choice, use fixedMaterial for every
    // piece. 'choice' = student picks per piece from materials.js's list.
    materialMode: 'fixed',
    fixedMaterial: FIXED_MATERIAL_ROUND_1,

    // null = unlimited. Kept as null (not Infinity or a huge number) so
    // budget.js can do a simple `if (round.budget !== null && spent > round.budget)`
    // check without needing to know about Infinity edge cases.
    budget: null,

    buildTimeSeconds: 300 // placeholder -- 5 min, retune after playtesting
  },

  // ---- Round 2: Round 1 + material selection + a real budget
  {
    id: 2,
    label: 'Round 2',

    cliffs: SAME_HEIGHT_CLIFFS, // unchanged from Round 1
    ground: STANDARD_GROUND,

    materialMode: 'choice',
    fixedMaterial: null, // not used when materialMode is 'choice'

    budget: 500, // placeholder currency units -- no cost data exists yet
                 // to sanity-check this against, so it's a guess to be
                 // retuned once materials.js has real per-material costs

    buildTimeSeconds: 300
  },

  // ---- Round 3: same as Round 2, but cliffs are different heights.
  // Cliff B is 100 units (50m) taller than Cliff A -- a moderate gap:
  // noticeable enough to force a real slope in the bridge equation, not
  // so extreme that it becomes a near-vertical climb at this scale.
  {
    id: 3,
    label: 'Round 3',

    cliffs: [
      { x: 0, y: 600, name: 'Cliff A' },
      { x: 400, y: 700, name: 'Cliff B' } // +100 units (50m) taller than Cliff A
    ],
    ground: STANDARD_GROUND, // ground itself is unchanged, only cliffs shift

    materialMode: 'choice',
    fixedMaterial: null,

    budget: 500, // same placeholder as Round 2 for now -- no reason yet
                 // to make Round 3 stricter/looser, revisit after playtesting

    buildTimeSeconds: 300
  }
];

// -----------------------------------------------------------------------
// C. Accessors -- main.js should go through these, not index into ROUNDS
// directly, so the array's internal order/shape can change later without
// breaking callers.
// -----------------------------------------------------------------------

// Returns the round config for a given 1-based round number, or null if
// it doesn't exist (e.g. asking for round 4 before it's been added).
function getRoundConfig(roundNumber) {
  return ROUNDS.find(r => r.id === roundNumber) || null;
}

function getTotalRounds() {
  return ROUNDS.length;
}

// -----------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------
export {
  ROUNDS,
  getRoundConfig,
  getTotalRounds
};