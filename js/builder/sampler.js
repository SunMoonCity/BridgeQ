// sampler.js - Deterministic mathematical equation domain sampler

export const SAMPLER_CONFIG = Object.freeze({
  DEFAULT_RESOLUTION: 0.5,
  MIN_RESOLUTION: 0.05,
  MAX_RESOLUTION: 500.0,
  MAX_SAMPLES: 2000,
  EPSILON: 1e-9
});

/**
 * Sample a mathematical function across a defined domain
 * @param {Function} evaluate - Pure function (val: number) => number
 * @param {number} rangeMin - Domain start
 * @param {number} rangeMax - Domain end
 * @param {string} orientation - 'y-of-x' | 'x-of-y'
 * @param {number} resolution - Step size along independent axis
 * @param {object} [bounds] - Optional coordinate boundaries { xMin, xMax, yMin, yMax }
 * @returns {{ success: boolean, points?: Array<{x: number, y: number}>, error?: string, sampleCount?: number }}
 */
export function sampleEquation(
  evaluate,
  rangeMin,
  rangeMax,
  orientation = 'y-of-x',
  resolution = SAMPLER_CONFIG.DEFAULT_RESOLUTION,
  bounds = null
) {
  // 1. Validate domain arguments
  if (typeof rangeMin !== 'number' || typeof rangeMax !== 'number' || !Number.isFinite(rangeMin) || !Number.isFinite(rangeMax)) {
    return { success: false, error: 'Invalid range: min and max must be finite numbers.' };
  }

  if (rangeMin >= rangeMax) {
    return { success: false, error: `Invalid range: min bound (${rangeMin}) must be strictly less than max bound (${rangeMax}).` };
  }

  // 2. Validate resolution
  const step = Math.max(
    SAMPLER_CONFIG.MIN_RESOLUTION,
    Math.min(SAMPLER_CONFIG.MAX_RESOLUTION, typeof resolution === 'number' && Number.isFinite(resolution) && resolution > 0 ? resolution : SAMPLER_CONFIG.DEFAULT_RESOLUTION)
  );

  // 3. Check sample count safety limit
  const span = rangeMax - rangeMin;
  const estimatedCount = Math.floor(span / step) + 1;
  if (estimatedCount > SAMPLER_CONFIG.MAX_SAMPLES) {
    return {
      success: false,
      error: `Sample count (${estimatedCount}) exceeds maximum limit (${SAMPLER_CONFIG.MAX_SAMPLES}). Increase resolution step.`
    };
  }

  const isXofY = orientation === 'x-of-y';
  const points = [];

  // 4. Deterministic sampling loop using index multiplication to prevent floating-point accumulation drift
  const numSteps = Math.round(span / step);
  const actualStep = span / (numSteps > 0 ? numSteps : 1);

  for (let i = 0; i <= numSteps; i++) {
    // Exact endpoint on final step
    const t = i === numSteps ? rangeMax : rangeMin + i * actualStep;

    const output = evaluate(t);

    // Check for undefined / discontinuous values
    if (typeof output !== 'number' || Number.isNaN(output) || !Number.isFinite(output)) {
      return {
        success: false,
        error: `Equation is undefined or discontinuous at ${isXofY ? 'y' : 'x'} = ${t.toFixed(2)}.`
      };
    }

    const x = isXofY ? output : t;
    const y = isXofY ? t : output;

    // Check optional region boundaries
    if (bounds) {
      if (bounds.xMin !== undefined && x < bounds.xMin - SAMPLER_CONFIG.EPSILON) {
        return { success: false, error: `Sample point x = ${x.toFixed(2)} is out of allowed region (xMin: ${bounds.xMin}).` };
      }
      if (bounds.xMax !== undefined && x > bounds.xMax + SAMPLER_CONFIG.EPSILON) {
        return { success: false, error: `Sample point x = ${x.toFixed(2)} is out of allowed region (xMax: ${bounds.xMax}).` };
      }
      if (bounds.yMin !== undefined && y < bounds.yMin - SAMPLER_CONFIG.EPSILON) {
        return { success: false, error: `Sample point y = ${y.toFixed(2)} is out of allowed region (yMin: ${bounds.yMin}).` };
      }
      if (bounds.yMax !== undefined && y > bounds.yMax + SAMPLER_CONFIG.EPSILON) {
        return { success: false, error: `Sample point y = ${y.toFixed(2)} is out of allowed region (yMax: ${bounds.yMax}).` };
      }
    }

    // Clean floating-point precision artifacts (e.g. 10.000000000000002 -> 10)
    points.push({
      x: Math.round(x * 1e6) / 1e6,
      y: Math.round(y * 1e6) / 1e6
    });
  }

  if (points.length < 2) {
    return { success: false, error: 'Sampling produced fewer than 2 vertices.' };
  }

  return {
    success: true,
    points,
    sampleCount: points.length
  };
}
