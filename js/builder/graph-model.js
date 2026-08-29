// graph-model.js - Logical Bridge Graph and Canonical Vertex System

import { SNAP_TOLERANCE } from '../config/constants.js';
import { distance } from '../utils/math.js';

export class CanonicalVertex {
  constructor(id, x, y, isFixed = false) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.isFixed = isFixed;
    this.connectedEdgeIds = new Set();
    this.connectedPieceIds = new Set();
  }

  toJSON() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      isFixed: this.isFixed,
      connectedEdgeIds: Array.from(this.connectedEdgeIds),
      connectedPieceIds: Array.from(this.connectedPieceIds)
    };
  }
}

export class LogicalEdge {
  constructor(id, vertexAId, vertexBId, pieceId, material = 'steel', isRoad = false, restLength = null) {
    this.id = id;
    this.vertexAId = vertexAId;
    this.vertexBId = vertexBId;
    this.pieceId = pieceId;
    this.material = material;
    this.isRoad = isRoad;
    this.restLength = restLength;
  }

  toJSON() {
    return {
      id: this.id,
      vertexAId: this.vertexAId,
      vertexBId: this.vertexBId,
      pieceId: this.pieceId,
      material: this.material,
      isRoad: this.isRoad,
      restLength: this.restLength
    };
  }
}

export class LogicalPiece {
  constructor(id, equation, orientation, domain, material, isRoad = false, vertexIds = [], edgeIds = [], cost = 0, points = []) {
    this.id = id;
    this.equation = equation;
    this.orientation = orientation;
    this.domain = domain; // [min, max]
    this.material = material;
    this.isRoad = isRoad;
    this.vertexIds = vertexIds; // Array of CanonicalVertex IDs in topological order
    this.edgeIds = edgeIds;     // Array of LogicalEdge IDs in topological order
    this.cost = cost;
    this.points = points;       // Original sampled {x, y} points
  }

  toJSON() {
    return {
      id: this.id,
      equation: this.equation,
      orientation: this.orientation,
      domain: this.domain,
      material: this.material,
      isRoad: this.isRoad,
      vertexIds: [...this.vertexIds],
      edgeIds: [...this.edgeIds],
      cost: this.cost,
      points: [...this.points]
    };
  }
}

export class LogicalGraph {
  constructor(snapTolerance = SNAP_TOLERANCE) {
    this.snapTolerance = snapTolerance;
    this.canonicalVertices = new Map(); // vertexId -> CanonicalVertex
    this.edges = new Map();              // edgeId -> LogicalEdge
    this.pieces = new Map();             // pieceId -> LogicalPiece
    this.fixedVertexIds = new Set();     // Set of vertexIds that are fixed anchors

    this.vertexIdCounter = 0;
    this.edgeIdCounter = 0;
    this.pieceIdCounter = 0;
  }

  /**
   * Reset graph state and initialize fixed terrain anchor vertices
   */
  initEnvironment(fixedAnchorPoints = []) {
    this.canonicalVertices.clear();
    this.edges.clear();
    this.pieces.clear();
    this.fixedVertexIds.clear();

    this.vertexIdCounter = 0;
    this.edgeIdCounter = 0;
    this.pieceIdCounter = 0;

    for (const pt of fixedAnchorPoints) {
      const v = this.createCanonicalVertex(pt.x, pt.y, true);
      this.fixedVertexIds.add(v.id);
    }
  }

  /**
   * Search for an existing canonical vertex within snap tolerance
   */
  findCanonicalVertexAt(x, y, tolerance = this.snapTolerance) {
    let closest = null;
    let minDist = Infinity;

    for (const vertex of this.canonicalVertices.values()) {
      const d = distance(x, y, vertex.x, vertex.y);
      if (d <= tolerance && d < minDist) {
        minDist = d;
        closest = vertex;
      }
    }
    return closest;
  }

  /**
   * Create a new canonical vertex
   */
  createCanonicalVertex(x, y, isFixed = false) {
    const id = `v_${++this.vertexIdCounter}`;
    const vertex = new CanonicalVertex(id, x, y, isFixed);
    this.canonicalVertices.set(id, vertex);
    if (isFixed) {
      this.fixedVertexIds.add(id);
    }
    return vertex;
  }

  /**
   * Get existing canonical vertex if within tolerance, or create a new one
   */
  getOrCreateCanonicalVertex(x, y, isFixed = false, tolerance = this.snapTolerance) {
    const existing = this.findCanonicalVertexAt(x, y, tolerance);
    if (existing) {
      if (isFixed && !existing.isFixed) {
        existing.isFixed = true;
        this.fixedVertexIds.add(existing.id);
      }
      return existing;
    }
    return this.createCanonicalVertex(x, y, isFixed);
  }

  /**
   * Create an edge between two vertices
   */
   createEdge(vertexAId, vertexBId, pieceId, material, isRoad = false) {
    if (vertexAId === vertexBId) {
      return null; // Self-loop edge is disallowed
    }

    const vA = this.canonicalVertices.get(vertexAId);
    const vB = this.canonicalVertices.get(vertexBId);
    if (!vA || !vB) {
      throw new Error(`Cannot create edge between non-existent vertices (${vertexAId}, ${vertexBId})`);
    }

    // Check if an edge already exists between these two vertices
    for (const edgeId of vA.connectedEdgeIds) {
      const edge = this.edges.get(edgeId);
      if (edge && ((edge.vertexAId === vertexBId) || (edge.vertexBId === vertexBId))) {
        // Edge already connects these vertices
        vA.connectedPieceIds.add(pieceId);
        vB.connectedPieceIds.add(pieceId);
        return edge;
      }
    }

    const id = `e_${++this.edgeIdCounter}`;
    const restLength = distance(vA.x, vA.y, vB.x, vB.y);
    const edge = new LogicalEdge(id, vertexAId, vertexBId, pieceId, material, isRoad, restLength);

    this.edges.set(id, edge);
    vA.connectedEdgeIds.add(id);
    vB.connectedEdgeIds.add(id);
    vA.connectedPieceIds.add(pieceId);
    vB.connectedPieceIds.add(pieceId);

    return edge;
  }

  /**
   * Add a new piece from sampled geometric points
   */
  addPiece({
    id = null,
    equation = '',
    orientation = 'y-of-x',
    domain = [0, 1],
    material = 'steel',
    isRoad = false,
    points = [],
    cost = 0
  }) {
    if (!Array.isArray(points) || points.length < 2) {
      return { success: false, error: 'Piece must contain at least 2 points.' };
    }

    const pieceId = id !== null ? id : ++this.pieceIdCounter;
    if (id !== null && id >= this.pieceIdCounter) {
      this.pieceIdCounter = id;
    }
    if (this.pieces.has(pieceId)) {
      return { success: false, error: `Piece ID ${pieceId} already exists in graph.` };
    }

    const vertexIds = [];
    const edgeIds = [];

    // 1. Resolve canonical vertices for all sampled points
    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      const vertex = this.getOrCreateCanonicalVertex(pt.x, pt.y, false);
      vertexIds.push(vertex.id);

      // 2. Connect consecutive vertices with edges
      if (i > 0) {
        const prevVertexId = vertexIds[i - 1];
        if (prevVertexId !== vertex.id) {
          const edge = this.createEdge(prevVertexId, vertex.id, pieceId, material, isRoad);
          if (edge && !edgeIds.includes(edge.id)) {
            edgeIds.push(edge.id);
          }
        }
      }
    }
    const piece = new LogicalPiece(
      pieceId,
      equation,
      orientation,
      domain,
      material,
      isRoad,
      vertexIds,
      edgeIds,
      cost,
      points
    );

    this.pieces.set(pieceId, piece);

    return {
      success: true,
      piece,
      canonicalVertexCount: this.canonicalVertices.size,
      edgeCount: this.edges.size
    };
  }

  /**
   * Remove a piece and clean up unreferenced edges and non-fixed vertices
   */
  removePiece(pieceId) {
    const piece = this.pieces.get(pieceId);
    if (!piece) {
      return { success: false, error: `Piece ID ${pieceId} not found in graph.` };
    }

    this.pieces.delete(pieceId);

    // Remove edges associated with this piece
    for (const edgeId of piece.edgeIds) {
      const edge = this.edges.get(edgeId);
      if (!edge) continue;

      // If edge belonged specifically to this piece, remove it
      if (edge.pieceId === pieceId) {
        this.edges.delete(edgeId);

        const vA = this.canonicalVertices.get(edge.vertexAId);
        const vB = this.canonicalVertices.get(edge.vertexBId);
        if (vA) vA.connectedEdgeIds.delete(edgeId);
        if (vB) vB.connectedEdgeIds.delete(edgeId);
      }
    }

    // Clean up vertices
    for (const vertexId of piece.vertexIds) {
      const v = this.canonicalVertices.get(vertexId);
      if (!v) continue;

      v.connectedPieceIds.delete(pieceId);

      // If non-fixed vertex has no remaining edges/pieces, delete it
      if (!v.isFixed && v.connectedEdgeIds.size === 0) {
        this.canonicalVertices.delete(vertexId);
      }
    }

    return {
      success: true,
      removedPiece: piece,
      remainingPieces: this.pieces.size,
      remainingVertices: this.canonicalVertices.size,
      remainingEdges: this.edges.size
    };
  }

  /**
   * Check if a piece connects directly or transitively to any fixed anchor support
   */
  isConnectedToSupports(pieceId) {
    const piece = this.pieces.get(pieceId);
    if (!piece) return false;

    // Breadth-first search from piece vertices to check if any fixed vertex is reachable
    const visited = new Set();
    const queue = [...piece.vertexIds];

    while (queue.length > 0) {
      const currId = queue.shift();
      if (visited.has(currId)) continue;
      visited.add(currId);

      const vertex = this.canonicalVertices.get(currId);
      if (!vertex) continue;

      if (vertex.isFixed) {
        return true; // Found connection to a fixed support anchor
      }

      for (const edgeId of vertex.connectedEdgeIds) {
        const edge = this.edges.get(edgeId);
        if (!edge) continue;
        const neighborId = edge.vertexAId === currId ? edge.vertexBId : edge.vertexAId;
        if (!visited.has(neighborId)) {
          queue.push(neighborId);
        }
      }
    }

    return false;
  }

  /**
   * Get all connected components in the graph
   */
  getConnectedComponents() {
    const visited = new Set();
    const components = [];

    for (const vertexId of this.canonicalVertices.keys()) {
      if (visited.has(vertexId)) continue;

      const componentVertices = [];
      const queue = [vertexId];
      let hasFixedSupport = false;

      while (queue.length > 0) {
        const currId = queue.shift();
        if (visited.has(currId)) continue;
        visited.add(currId);
        componentVertices.push(currId);

        const vertex = this.canonicalVertices.get(currId);
        if (vertex.isFixed) hasFixedSupport = true;

        for (const edgeId of vertex.connectedEdgeIds) {
          const edge = this.edges.get(edgeId);
          if (!edge) continue;
          const neighborId = edge.vertexAId === currId ? edge.vertexBId : edge.vertexAId;
          if (!visited.has(neighborId)) {
            queue.push(neighborId);
          }
        }
      }

      components.push({
        vertexIds: componentVertices,
        hasFixedSupport
      });
    }

    return components;
  }

  /**
   * Get count of canonical vertices
   */
  get vertexCount() {
    return this.canonicalVertices.size;
  }

  /**
   * Get count of edges
   */
  get edgeCount() {
    return this.edges.size;
  }

  /**
   * Get count of pieces
   */
  get pieceCount() {
    return this.pieces.size;
  }
}
