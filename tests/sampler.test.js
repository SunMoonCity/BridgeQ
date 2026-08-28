// sampler.test.js - Comprehensive test suite for Equation Sampler

import assert from 'node:assert';
import { sampleEquation, SAMPLER_CONFIG } from '../js/builder/sampler.js';
import { parseEquation } from '../js/builder/equation-parser.js';

console.log('Testing Equation Sampler...');

// 1. Identity function y = x
{
  const parsed = parseEquation('x', 'x');
  const res = sampleEquation(parsed.evaluate, 0, 10, 'y-of-x', 1.0);
  assert.strictEqual(res.success, true, 'y=x should sample successfully');
  assert.strictEqual(res.points.length, 11, 'Sampling 0 to 10 with step 1 should yield 11 points');
  assert.strictEqual(res.points[0].x, 0);
  assert.strictEqual(res.points[0].y, 0);
  assert.strictEqual(res.points[10].x, 10);
  assert.strictEqual(res.points[10].y, 10);
}

// 2. Constant function y = 500
{
  const parsed = parseEquation('500', 'x');
  const res = sampleEquation(parsed.evaluate, 0, 400, 'y-of-x', 100);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.points.length, 5); // 0, 100, 200, 300, 400
  assert.strictEqual(res.points[2].x, 200);
  assert.strictEqual(res.points[2].y, 500);
}

// 3. Negative Coordinates
{
  const parsed = parseEquation('2*x', 'x');
  const res = sampleEquation(parsed.evaluate, -10, -5, 'y-of-x', 1.0);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.points[0].x, -10);
  assert.strictEqual(res.points[0].y, -20);
  assert.strictEqual(res.points[5].x, -5);
  assert.strictEqual(res.points[5].y, -10);
}

// 4. Orientation x = f(y)
{
  const parsed = parseEquation('0.5*y + 10', 'y');
  const res = sampleEquation(parsed.evaluate, 0, 20, 'x-of-y', 5.0);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.points.length, 5);
  // At y = 0 => x = 10
  assert.strictEqual(res.points[0].x, 10);
  assert.strictEqual(res.points[0].y, 0);
  // At y = 20 => x = 20
  assert.strictEqual(res.points[4].x, 20);
  assert.strictEqual(res.points[4].y, 20);
}

// 5. Invalid Range (min >= max or NaN)
{
  const parsed = parseEquation('x', 'x');
  const inverted = sampleEquation(parsed.evaluate, 10, 5);
  assert.strictEqual(inverted.success, false, 'Min >= Max must fail');

  const nanRange = sampleEquation(parsed.evaluate, NaN, 10);
  assert.strictEqual(nanRange.success, false, 'NaN range must fail');
}

// 6. Discontinuity & Singularity Detection (e.g. 1/x through x=0)
{
  const parsed = parseEquation('10 / x', 'x');
  const res = sampleEquation(parsed.evaluate, -2, 2, 'y-of-x', 1.0);
  assert.strictEqual(res.success, false, 'Discontinuous function must be caught and rejected');
  assert.ok(res.error.includes('undefined or discontinuous'));
}

// 7. Maximum Sample Count Limit (Prevents freezing the browser)
{
  const parsed = parseEquation('x', 'x');
  const res = sampleEquation(parsed.evaluate, 0, 10000, 'y-of-x', 0.05); // 200,000 samples requested!
  assert.strictEqual(res.success, false, 'Exceeding MAX_SAMPLES must be rejected');
  assert.ok(res.error.includes('exceeds maximum limit'));
}

// 8. Region Bounds Enforcement
{
  const parsed = parseEquation('x^2', 'x');
  const bounds = { xMin: 0, xMax: 100, yMin: 0, yMax: 50 };
  const res = sampleEquation(parsed.evaluate, 0, 10, 'y-of-x', 1.0, bounds); // at x=10, y=100 > yMax 50
  assert.strictEqual(res.success, false, 'Out-of-bounds sampling must fail');
  assert.ok(res.error.includes('out of allowed region'));
}

console.log('  PASS: Equation Sampler tests');
