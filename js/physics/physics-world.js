// physics-world.js - Structural Physics World and Simulation Container

import { PHYSICS_CONFIG } from '../config/constants.js';

export class PhysicsWorld {
  constructor(config = {}) {
    this.timestep = config.timestep || PHYSICS_CONFIG.TIMESTEP || (1 / 60);
    this.substeps = config.substeps || PHYSICS_CONFIG.SUBSTEPS || 8;
    this.gravity = config.gravity !== undefined ? config.gravity : (PHYSICS_CONFIG.GRAVITY || -9.81);
    this.damping = config.damping !== undefined ? config.damping : (PHYSICS_CONFIG.DAMPING || 0.995);

    this.nodes = new Map(); // nodeId -> PhysicsNode
    this.constraints = new Map(); // constraintId -> StructuralConstraint
    this.roadSegments = []; // Array of StructuralConstraint objects that are isRoad
    this.isSimulating = false;
  }

  /**
   * Register a physics mass node
   */
  addNode(node) {
    this.nodes.set(node.id, node);
  }

  /**
   * Register a structural constraint / member
   */
  addConstraint(constraint) {
    this.constraints.set(constraint.id, constraint);
    if (constraint.isRoad) {
      this.roadSegments.push(constraint);
    }
  }

  /**
   * Get a node by ID
   */
  getNode(id) {
    return this.nodes.get(id);
  }

  /**
   * Get a constraint by ID
   */
  getConstraint(id) {
    return this.constraints.get(id);
  }

  /**
   * Clear all bodies, constraints, and simulation state
   */
  clear() {
    this.nodes.clear();
    this.constraints.clear();
    this.roadSegments = [];
    this.isSimulating = false;
  }

  /**
   * Reset all nodes and constraints to their rest state
   */
  reset() {
    for (const node of this.nodes.values()) {
      node.reset();
    }
    for (const constraint of this.constraints.values()) {
      constraint.reset();
    }
  }

  /**
   * Get current deformed node positions map (nodeId -> {x, y})
   */
  getNodePositions() {
    const posMap = new Map();
    for (const [id, node] of this.nodes) {
      posMap.set(id, { x: node.x, y: node.y });
    }
    return posMap;
  }

  /**
   * Get current edge stress map (constraintId -> stressRatio)
   */
  getEdgeStressMap() {
    const stressMap = new Map();
    for (const [id, constraint] of this.constraints) {
      stressMap.set(id, constraint.calculateStress());
    }
    return stressMap;
  }

  /**
   * Total number of physics nodes
   */
  get nodeCount() {
    return this.nodes.size;
  }

  /**
   * Total number of structural constraints
   */
  get constraintCount() {
    return this.constraints.size;
  }
}
