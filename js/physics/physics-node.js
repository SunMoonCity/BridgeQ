// physics-node.js - Structural Mass Node representation for physics simulation

export class PhysicsNode {
  /**
   * @param {string} id - Canonical Vertex ID
   * @param {number} x - Initial X position in world units
   * @param {number} y - Initial Y position in world units
   * @param {boolean} isFixed - Whether this node is an immovable support anchor
   * @param {number} mass - Effective lumped mass in kg
   */
  constructor(id, x, y, isFixed = false, mass = 1.0) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    this.initialX = x;
    this.initialY = y;
    this.isFixed = isFixed;
    this.mass = isFixed ? Infinity : Math.max(0.001, mass);
    this.invMass = isFixed ? 0 : 1 / this.mass;

    // Accumulated external force vector (resets every solver step)
    this.forceX = 0;
    this.forceY = 0;
  }

  /**
   * Apply an external force to this node (e.g. vehicle wheel load, wind)
   */
  applyForce(fx, fy) {
    if (!this.isFixed) {
      this.forceX += fx;
      this.forceY += fy;
    }
  }

  /**
   * Reset position to initial rest coordinates and zero out velocity
   */
  reset() {
    this.x = this.initialX;
    this.y = this.initialY;
    this.prevX = this.initialX;
    this.prevY = this.initialY;
    this.forceX = 0;
    this.forceY = 0;
  }

  /**
   * Get current horizontal velocity estimate
   */
  get vx() {
    return this.x - this.prevX;
  }

  /**
   * Get current vertical velocity estimate
   */
  get vy() {
    return this.y - this.prevY;
  }
}
