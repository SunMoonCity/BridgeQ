// road-surface.js - Continuous driveable road contact surface and wheel interaction model

export class RoadSurface {
  /**
   * @param {import('./physics-world.js').PhysicsWorld} world
   */
  constructor(world) {
    this.world = world;
  }

  /**
   * Get active, unbroken road segments sorted from West (low X) to East (high X)
   * @returns {import('./structural-constraint.js').StructuralConstraint[]}
   */
  getSegments() {
    if (!this.world) return [];
    return this.world.roadSegments.filter(seg => !seg.isBroken);
  }

  /**
   * Query road surface properties at a given world X coordinate
   * @param {number} x - World X position
   * @returns {{ onRoad: boolean, y?: number, normalX?: number, normalY?: number, tangentX?: number, tangentY?: number, slopeAngle?: number, segment?: object, t?: number }}
   */
  queryAtX(x) {
    const segments = this.getSegments();
    if (segments.length === 0) {
      return { onRoad: false };
    }

    // Search for segment containing x
    for (const seg of segments) {
      const nA = seg.nodeA;
      const nB = seg.nodeB;

      const minX = Math.min(nA.x, nB.x);
      const maxX = Math.max(nA.x, nB.x);

      // Epsilon tolerance for edge boundaries
      if (x >= minX - 0.001 && x <= maxX + 0.001) {
        const dx = nB.x - nA.x;
        const dy = nB.y - nA.y;
        const len = Math.sqrt(dx * dx + dy * dy);

        if (len === 0) continue;

        // Normalized interpolation factor t in [0, 1] along segment from A to B
        const t = Math.max(0, Math.min(1, (x - nA.x) / (dx !== 0 ? dx : 1)));
        const y = nA.y + t * dy;

        // Tangent unit vector (along road direction from left to right)
        const dir = dx >= 0 ? 1 : -1;
        const tangentX = ((dx / len) * dir) + 0;
        const tangentY = ((dy / len) * dir) + 0;

        // Normal unit vector (perpendicular upward: [-tangentY, tangentX])
        const normalX = (-tangentY) + 0;
        const normalY = tangentX + 0;

        // Slope angle in radians relative to horizontal
        const slopeAngle = Math.atan2(dy * dir, dx * dir);

        return {
          onRoad: true,
          y,
          normalX,
          normalY,
          tangentX,
          tangentY,
          slopeAngle,
          segment: seg,
          t
        };
      }
    }

    return { onRoad: false };
  }

  /**
   * Distribute a contact force vector (e.g. vehicle wheel load) to the road's underlying physics nodes
   * @param {number} x - Contact point X
   * @param {number} fx - Horizontal force component
   * @param {number} fy - Vertical force component (typically negative for downward weight)
   * @returns {boolean} Whether load was successfully applied to road nodes
   */
  applyContactLoad(x, fx, fy) {
    const query = this.queryAtX(x);
    if (!query.onRoad || !query.segment) return false;

    const seg = query.segment;
    const t = query.t;

    // Linear load distribution: Node A takes (1-t), Node B takes t
    const forceA_x = fx * (1 - t);
    const forceA_y = fy * (1 - t);
    const forceB_x = fx * t;
    const forceB_y = fy * t;

    seg.nodeA.applyForce(forceA_x, forceA_y);
    seg.nodeB.applyForce(forceB_x, forceB_y);

    return true;
  }

  /**
   * Check if the road has any discontinuous gaps or missing spans between xStart and xEnd
   * @param {number} xStart
   * @param {number} xEnd
   * @param {number} step - Step size for discontinuity sampling (default 1.0m)
   * @returns {{ continuous: boolean, gapAtX?: number }}
   */
  checkContinuity(xStart, xEnd, step = 1.0) {
    for (let x = xStart; x <= xEnd; x += step) {
      const q = this.queryAtX(x);
      if (!q.onRoad) {
        return { continuous: false, gapAtX: x };
      }
    }
    return { continuous: true };
  }

  /**
   * Total length of active road deck
   */
  getTotalLength() {
    let total = 0;
    for (const seg of this.getSegments()) {
      const dx = seg.nodeB.x - seg.nodeA.x;
      const dy = seg.nodeB.y - seg.nodeA.y;
      total += Math.sqrt(dx * dx + dy * dy);
    }
    return total;
  }
}
