// round-config.test.js - Unit tests for Round Configurations

import assert from 'node:assert';
import { getRoundConfig, getTotalRounds } from '../js/config/round-config.js';
import { getMaterial, isValidMaterial } from '../js/config/materials.js';

console.log('Testing Round Config & Materials...');

// 1. Total rounds
assert.strictEqual(getTotalRounds(), 3, 'There must be exactly 3 rounds');

// 2. Round 1 checks
const r1 = getRoundConfig(1);
assert.ok(r1, 'Round 1 config must exist');
assert.strictEqual(r1.cliffs.length, 2, 'Round 1 must have 2 cliffs');
assert.strictEqual(r1.cliffs[0].y, r1.cliffs[1].y, 'Round 1 cliffs must be equal height');
assert.strictEqual(r1.loadStages.length, 5, 'Round 1 must have exactly 5 load stages');

// 3. Round 3 checks (differential elevation)
const r3 = getRoundConfig(3);
assert.ok(r3, 'Round 3 config must exist');
assert.strictEqual(r3.cliffs[1].y - r3.cliffs[0].y, 100, 'Round 3 East cliff must be 100 units higher than West cliff');

// 4. Material lookups
assert.strictEqual(isValidMaterial('steel'), true, 'Steel must be valid material');
assert.strictEqual(isValidMaterial('unobtainium'), false, 'Unknown material must be invalid');
assert.strictEqual(getMaterial('wood').costPerUnit, 6, 'Wood cost per unit should be 6');

console.log('  PASS: Round config and material tests');
