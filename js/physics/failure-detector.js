// failure-detector.js - Central structural failure and collapse detector

export const FAILURE_REASONS = Object.freeze({
  MEMBER_SNAP: 'MEMBER_SNAP',
  EXCESSIVE_SAG: 'EXCESSIVE_SAG',
  ANCHOR_DISCONNECT: 'ANCHOR_DISCONNECT',
  VEHICLE_FALL: 'VEHICLE_FALL'
});

export class FailureDetector {
  /**
   * @param {object} options
   * @param {number} options.maxAllowableStressRatio - Trigger failure if stress ratio exceeds this (default 1.0)
   * @param {number} options.maxSagDisplacement - Max allowable vertical deflection in world units (default 250)
   */
  constructor(options = {}) {
    this.maxAllowableStressRatio = options.maxAllowableStressRatio || 1.0;
    this.maxSagDisplacement = options.maxSagDisplacement || 250;
    this.failures = [];
    this.hasFailed = false;
  }

  /**
   * Check physics world and active vehicles for structural failures
   * @param {import('./physics-world.js').PhysicsWorld} world
   * @param {number} simulationTime - Current elapsed simulation time in seconds
   * @param {import('./vehicle.js').Vehicle[]} vehicles - Optional list of active vehicles
   * @returns {{ failed: boolean, failure?: object }}
   */
  check(world, simulationTime = 0, vehicles = []) {
    if (!world) return { failed: false };

    // 1. Check for broken or over-stressed structural constraints
    for (const [id, constraint] of world.constraints) {
      if (constraint.isBroken) {
        return this.recordFailure({
          reason: FAILURE_REASONS.MEMBER_SNAP,
          constraintId: id,
          pieceId: constraint.pieceId,
          stressRatio: constraint.stressRatio,
          time: simulationTime,
          message: `Structural member ${id} snapped under excessive stress (${(constraint.stressRatio * 100).toFixed(1)}%).`
        });
      }

      const stress = constraint.calculateStress();
      if (stress > this.maxAllowableStressRatio) {
        constraint.break();
        return this.recordFailure({
          reason: FAILURE_REASONS.MEMBER_SNAP,
          constraintId: id,
          pieceId: constraint.pieceId,
          stressRatio: stress,
          time: simulationTime,
          message: `Structural member ${id} exceeded tensile/compression limit (${(stress * 100).toFixed(1)}%).`
        });
      }
    }

    // 2. Check for excessive sagging / collapse of dynamic nodes
    for (const [id, node] of world.nodes) {
      if (node.isFixed) continue;

      const sag = node.initialY - node.y; // Positive if drooping downward
      if (sag > this.maxSagDisplacement) {
        return this.recordFailure({
          reason: FAILURE_REASONS.EXCESSIVE_SAG,
          nodeId: id,
          sag,
          time: simulationTime,
          message: `Bridge node ${id} suffered catastrophic sagging deflection (${sag.toFixed(1)}m).`
        });
      }
    }

    // 3. Check for falling vehicle failures
    if (Array.isArray(vehicles)) {
      for (const vehicle of vehicles) {
        if (vehicle.hasFallen) {
          return this.recordFailure({
            reason: FAILURE_REASONS.VEHICLE_FALL,
            vehicleId: vehicle.id,
            vehicleX: vehicle.x,
            vehicleY: vehicle.y,
            time: simulationTime,
            message: `Vehicle #${vehicle.id} fell through bridge into the abyss at x=${vehicle.x.toFixed(1)}m.`
          });
        }
      }
    }

    return { failed: false };
  }

  /**
   * Record a failure event and mark detector state
   */
  recordFailure(failureData) {
    this.hasFailed = true;
    this.failures.push(failureData);
    return { failed: true, failure: failureData };
  }

  /**
   * Reset detector state
   */
  reset() {
    this.failures = [];
    this.hasFailed = false;
  }

  /**
   * Get primary failure record
   */
  getPrimaryFailure() {
    return this.failures.length > 0 ? this.failures[0] : null;
  }
}
