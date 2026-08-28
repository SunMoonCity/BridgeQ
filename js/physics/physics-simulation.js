// physics-simulation.js - Fixed-timestep Verlet / Position-Based Dynamics structural simulation engine

import { FailureDetector } from './failure-detector.js';

export class PhysicsSimulation {
  /**
   * @param {import('./physics-world.js').PhysicsWorld} world
   * @param {object} options
   * @param {number} options.timestep - Timestep per tick (default 1/60)
   * @param {number} options.substeps - Solver sub-iterations per timestep (default 8)
   * @param {number} options.gravity - Gravity acceleration (default -9.81 m/s^2)
   * @param {number} options.damping - Velocity damping factor (default 0.995)
   */
  constructor(world, options = {}) {
    this.world = world;
    this.timestep = options.timestep || (world ? world.timestep : 1 / 60);
    this.substeps = options.substeps || (world ? world.substeps : 8);
    this.gravity = options.gravity !== undefined ? options.gravity : (world ? world.gravity : -9.81);
    this.damping = options.damping !== undefined ? options.damping : (world ? world.damping : 0.995);

    this.failureDetector = new FailureDetector(options.failureOptions || {});
    this.elapsedTime = 0;
    this.tickCount = 0;
    this.isRunning = false;
    this.isFailed = false;

    // Simulation hooks / callbacks
    this.onTick = null; // callback(simulationState)
    this.onFailure = null; // callback(failureDetails)
  }

  /**
   * Perform one full fixed-timestep simulation step
   * Uses Verlet integration + Position-Based Dynamics constraint projection
   * @returns {{ success: boolean, failed: boolean, failure?: object }}
   */
  step() {
    if (!this.world || this.isFailed) {
      return { success: false, failed: this.isFailed, failure: this.failureDetector.getPrimaryFailure() };
    }

    const dt = this.timestep;
    const subDt = dt / this.substeps;
    const subDtSq = subDt * subDt;

    // Sub-stepping for numerical stability and high structural stiffness
    for (let s = 0; s < this.substeps; s++) {
      // 1. Predict positions via Verlet integration with external forces & gravity
      for (const node of this.world.nodes.values()) {
        if (node.isFixed) continue;

        // Current velocity with damping
        const vx = (node.x - node.prevX) * this.damping;
        const vy = (node.y - node.prevY) * this.damping;

        // Total acceleration = gravity + applied forces / mass
        const ax = (node.forceX * node.invMass);
        const ay = this.gravity + (node.forceY * node.invMass);

        // Store current position
        node.prevX = node.x;
        node.prevY = node.y;

        // Integrate new position: x_new = x + v + a * dt^2
        node.x += vx + ax * subDtSq;
        node.y += vy + ay * subDtSq;

        // Reset forces for next sub-step
        node.forceX = 0;
        node.forceY = 0;
      }

      // 2. Solve structural constraints iteratively (Position-Based Dynamics)
      for (const constraint of this.world.constraints.values()) {
        constraint.solve(0.0);
      }
    }

    // 3. Update simulation time and tick count
    this.elapsedTime += dt;
    this.tickCount++;

    // 4. Update member stresses and check for structural failure
    const failureResult = this.failureDetector.check(this.world, this.elapsedTime);
    if (failureResult.failed) {
      this.isFailed = true;
      this.isRunning = false;
      if (typeof this.onFailure === 'function') {
        this.onFailure(failureResult.failure);
      }
      return { success: false, failed: true, failure: failureResult.failure };
    }

    // 5. Trigger onTick callback if registered
    if (typeof this.onTick === 'function') {
      this.onTick({
        time: this.elapsedTime,
        tick: this.tickCount,
        nodePositions: this.world.getNodePositions(),
        edgeStressMap: this.world.getEdgeStressMap()
      });
    }

    return { success: true, failed: false };
  }

  /**
   * Run simulation for N consecutive fixed ticks
   * @param {number} count
   * @returns {{ completedTicks: number, failed: boolean, failure?: object }}
   */
  runTicks(count) {
    let completed = 0;
    for (let i = 0; i < count; i++) {
      const res = this.step();
      completed++;
      if (res.failed) {
        return { completedTicks: completed, failed: true, failure: res.failure };
      }
    }
    return { completedTicks: completed, failed: false };
  }

  /**
   * Reset simulation and world to initial resting state
   */
  reset() {
    this.elapsedTime = 0;
    this.tickCount = 0;
    this.isRunning = false;
    this.isFailed = false;
    this.failureDetector.reset();
    if (this.world) {
      this.world.reset();
    }
  }

  /**
   * Apply a concentrated point load at coordinates (e.g. from vehicle wheels)
   * Distributes force to nearest road nodes
   * @param {number} x
   * @param {number} y
   * @param {number} fx
   * @param {number} fy
   */
  applyLoadAt(x, y, fx, fy) {
    if (!this.world || this.world.nodes.size === 0) return;

    let nearest = null;
    let minDist = Infinity;

    for (const node of this.world.nodes.values()) {
      const d = (node.x - x) ** 2 + (node.y - y) ** 2;
      if (d < minDist) {
        minDist = d;
        nearest = node;
      }
    }

    if (nearest) {
      nearest.applyForce(fx, fy);
    }
  }
}
