// physics-bridge-builder.js - Converts finalized LogicalGraph into a clean PhysicsWorld

import { PhysicsNode } from './physics-node.js';
import { StructuralConstraint } from './structural-constraint.js';
import { PhysicsWorld } from './physics-world.js';
import { getMaterial } from '../config/materials.js';

export class PhysicsBridgeBuilder {
  /**
   * Convert a finalized LogicalGraph into a PhysicsWorld
   *
   * Invariant Enforcement:
   *   - Exactly 1 PhysicsNode created per CanonicalVertex (1:1 mapping).
   *   - Exactly 1 StructuralConstraint created per LogicalEdge.
   *   - Fixed vertices become static anchors (invMass = 0).
   *   - Member mass is lumped equally to the 2 endpoint nodes.
   *
   * @param {import('../builder/graph-model.js').LogicalGraph} logicalGraph
   * @param {object} physicsConfig - Optional overrides for gravity, timestep, etc.
   * @returns {PhysicsWorld} Fully constructed, unsimulated physics world
   */
  static buildPhysicsWorld(logicalGraph, physicsConfig = {}) {
    if (!logicalGraph) {
      throw new Error('Cannot build physics world: LogicalGraph is null or undefined.');
    }

    const world = new PhysicsWorld(physicsConfig);

    // 1. Calculate lumped node masses from connected structural member lengths & densities
    const nodeMassMap = new Map(); // vertexId -> mass in kg

    for (const edge of logicalGraph.edges.values()) {
      const vA = logicalGraph.canonicalVertices.get(edge.vertexAId);
      const vB = logicalGraph.canonicalVertices.get(edge.vertexBId);
      if (!vA || !vB) continue;

      const mat = getMaterial(edge.material) || getMaterial('steel');
      const density = mat.density || 7.8;
      const restLength = edge.restLength || Math.sqrt((vB.x - vA.x) ** 2 + (vB.y - vA.y) ** 2);

      // Mass of member = length * density * crossSectionFactor (unit scaling)
      const memberMass = Math.max(0.1, restLength * density * 0.1);
      const halfMass = memberMass / 2;

      nodeMassMap.set(edge.vertexAId, (nodeMassMap.get(edge.vertexAId) || 0) + halfMass);
      nodeMassMap.set(edge.vertexBId, (nodeMassMap.get(edge.vertexBId) || 0) + halfMass);
    }

    // 2. Instantiate exactly ONE PhysicsNode per CanonicalVertex
    for (const [vId, vertex] of logicalGraph.canonicalVertices) {
      const isFixed = vertex.isFixed || logicalGraph.fixedVertexIds.has(vId);
      const mass = isFixed ? Infinity : (nodeMassMap.get(vId) || 1.0);

      const node = new PhysicsNode(
        vId,
        vertex.x,
        vertex.y,
        isFixed,
        mass
      );

      world.addNode(node);
    }

    // 3. Instantiate exactly ONE StructuralConstraint per LogicalEdge
    for (const [eId, edge] of logicalGraph.edges) {
      const nodeA = world.getNode(edge.vertexAId);
      const nodeB = world.getNode(edge.vertexBId);

      if (!nodeA || !nodeB) {
        throw new Error(`Physics conversion failed: Edge ${eId} references missing nodes (${edge.vertexAId}, ${edge.vertexBId}).`);
      }

      const constraint = new StructuralConstraint(
        eId,
        nodeA,
        nodeB,
        edge.material,
        edge.isRoad,
        edge.pieceId
      );

      world.addConstraint(constraint);
    }

    // 4. Sort road segments spatially from West (low X) to East (high X) for smooth traversal
    world.roadSegments.sort((a, b) => {
      const minXA = Math.min(a.nodeA.initialX, a.nodeB.initialX);
      const minXB = Math.min(b.nodeA.initialX, b.nodeB.initialX);
      return minXA - minXB;
    });

    return world;
  }
}
