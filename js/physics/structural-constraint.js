// structural-constraint.js - Elastic/plastic axial structural member with stress calculation

import { getMaterial } from '../config/materials.js';

export class StructuralConstraint {
  /**
   * @param {string} id - Logical Edge ID
   * @param {import('./physics-node.js').PhysicsNode} nodeA
   * @param {import('./physics-node.js').PhysicsNode} nodeB
   * @param {string} materialKey
   * @param {boolean} isRoad
   * @param {number} pieceId
   */
  constructor(id, nodeA, nodeB, materialKey = 'steel', isRoad = false, pieceId = null) {
    this.id = id;
    this.nodeA = nodeA;
    this.nodeB = nodeB;
    this.materialKey = materialKey;
    this.isRoad = isRoad;
    this.pieceId = pieceId;

    const mat = getMaterial(materialKey) || getMaterial('steel');
    this.material = mat;

    // Calculate rest length L_0 from initial resting node coordinates
    const dx = nodeB.initialX - nodeA.initialX;
    const dy = nodeB.initialY - nodeA.initialY;
    this.restLength = Math.max(0.0001, Math.sqrt(dx * dx + dy * dy));

    // Elastic stiffness factor
    this.stiffness = 1.0;

    // Failure limits based on material properties
    // Max allowable tensile/compression strain before snapping (calibrated for game scaling)
    this.maxTensileStrain = (mat.tensileStrength || 100) / 250;
    this.maxCompressionStrain = (mat.compressionStrength || 100) / 250;

    // Current real-time simulation state
    this.currentLength = this.restLength;
    this.strain = 0.0; // Positive = tension, negative = compression
    this.stressRatio = 0.0; // 0.0 (idle) to 1.0 (at yield limit) to >1.0 (breaking)
    this.isBroken = false;
  }

  /**
   * Compute current Euclidean length, engineering strain, and normalized stress ratio
   * @returns {number} Normalized stress ratio (0.0 to 1.0+)
   */
  calculateStress() {
    if (this.isBroken) {
      this.strain = 0;
      this.stressRatio = 0;
      return 0;
    }

    const dx = this.nodeB.x - this.nodeA.x;
    const dy = this.nodeB.y - this.nodeA.y;
    this.currentLength = Math.sqrt(dx * dx + dy * dy);

    // Engineering Strain: epsilon = (L - L_0) / L_0
    this.strain = (this.currentLength - this.restLength) / this.restLength;

    if (this.strain >= 0) {
      // Tension stress
      this.stressRatio = this.strain / Math.max(0.0001, this.maxTensileStrain);
    } else {
      // Compression stress
      this.stressRatio = Math.abs(this.strain) / Math.max(0.0001, this.maxCompressionStrain);
    }

    return this.stressRatio;
  }

  /**
   * Enforce axial distance constraint between nodeA and nodeB using Position-Based Dynamics
   * @param {number} compliance - Compliance factor (0 for rigid/infinite stiffness)
   */
  solve(compliance = 0) {
    if (this.isBroken) return;

    const nA = this.nodeA;
    const nB = this.nodeB;

    const wA = nA.invMass;
    const wB = nB.invMass;
    const wSum = wA + wB;

    if (wSum === 0) return; // Both nodes are fixed anchors

    const dx = nB.x - nA.x;
    const dy = nB.y - nA.y;
    const currentDist = Math.sqrt(dx * dx + dy * dy);

    if (currentDist === 0) return;

    // Delta length deviation from rest length
    const delta = currentDist - this.restLength;

    // Normal direction vector from A to B
    const nx = dx / currentDist;
    const ny = dy / currentDist;

    // PBD correction impulse magnitude
    const correction = delta / (wSum + compliance);

    if (!nA.isFixed) {
      nA.x += nx * (wA * correction);
      nA.y += ny * (wA * correction);
    }
    if (!nB.isFixed) {
      nB.x -= nx * (wB * correction);
      nB.y -= ny * (wB * correction);
    }
  }

  /**
   * Mark this structural constraint as broken
   */
  break() {
    this.isBroken = true;
  }

  /**
   * Reset constraint to unbroken rest state
   */
  reset() {
    this.isBroken = false;
    this.currentLength = this.restLength;
    this.strain = 0;
    this.stressRatio = 0;
  }
}
