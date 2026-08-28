// validator.js - Pre-flight bridge validation and finalization checks
//
// Responsibilities:
//   1. Check piece count and graph non-emptiness.
//   2. Check structural support connectivity: all pieces must connect directly or transitively to fixed cliff anchors.
//   3. Check continuous road deck traversal: there must exist a continuous road path between left and right cliff anchors.
//   4. Check graph consistency (valid vertex/edge/piece references).
//   5. Check budget adherence.
//   6. Return structured validation result and immutable finalized descriptor.

export class BridgeValidator {
  /**
   * Perform comprehensive pre-flight validation of the bridge graph
   * @param {import('./graph-model.js').LogicalGraph} graph
   * @param {import('../economy/budget.js').BudgetManager} budgetManager
   * @param {object} roundConfig
   * @returns {{ valid: boolean, errors: string[], warnings: string[], summary?: object }}
   */
  static validate(graph, budgetManager, roundConfig) {
    const errors = [];
    const warnings = [];

    // 1. Non-empty check
    if (!graph || graph.pieceCount === 0) {
      errors.push('No bridge pieces constructed. Please build a bridge before testing.');
      return { valid: false, errors, warnings };
    }

    // 2. Budget verification
    if (budgetManager) {
      if (budgetManager.getSpent() > budgetManager.getTotalBudget()) {
        errors.push(`Budget exceeded! Total spent (₹${Math.round(budgetManager.getSpent())}) exceeds budget limit (₹${Math.round(budgetManager.getTotalBudget())}).`);
      }
    }

    // 3. Graph integrity check
    const integrityResult = this.validateIntegrity(graph);
    if (!integrityResult.valid) {
      errors.push(...integrityResult.errors);
    }

    // 4. Fixed support connectivity check (BFS)
    const supportResult = this.validateSupportConnectivity(graph, roundConfig);
    if (!supportResult.valid) {
      errors.push(...supportResult.errors);
    }

    // 5. Road continuity check (Left anchor to Right anchor)
    const roadResult = this.validateRoadContinuity(graph, roundConfig);
    if (!roadResult.valid) {
      errors.push(...roadResult.errors);
    }

    const valid = errors.length === 0;

    const summary = valid ? {
      pieceCount: graph.pieceCount,
      vertexCount: graph.vertexCount,
      edgeCount: graph.edgeCount,
      roadEdgeCount: roadResult.roadEdgeCount || 0,
      totalCost: budgetManager ? budgetManager.getSpent() : 0,
      fixedVertexIds: Array.from(graph.fixedVertexIds)
    } : undefined;

    return {
      valid,
      errors,
      warnings,
      summary
    };
  }

  /**
   * Validate that all vertices, edges, and pieces in the graph have consistent references
   */
  static validateIntegrity(graph) {
    const errors = [];

    // Validate all edges connect valid vertices
    for (const [edgeId, edge] of graph.edges) {
      const vA = graph.canonicalVertices.get(edge.vertexAId);
      const vB = graph.canonicalVertices.get(edge.vertexBId);

      if (!vA || !vB) {
        errors.push(`Edge ${edgeId} references non-existent vertex (${edge.vertexAId} or ${edge.vertexBId}).`);
      }
      if (edge.vertexAId === edge.vertexBId) {
        errors.push(`Edge ${edgeId} forms an invalid self-loop on vertex ${edge.vertexAId}.`);
      }
      if (!graph.pieces.has(edge.pieceId)) {
        errors.push(`Edge ${edgeId} references orphaned piece ID ${edge.pieceId}.`);
      }
    }

    // Validate all pieces reference valid vertices and edges
    for (const [pieceId, piece] of graph.pieces) {
      for (const vId of piece.vertexIds) {
        if (!graph.canonicalVertices.has(vId)) {
          errors.push(`Piece ${pieceId} references non-existent vertex ${vId}.`);
        }
      }
      for (const eId of piece.edgeIds) {
        if (!graph.edges.has(eId)) {
          errors.push(`Piece ${pieceId} references non-existent edge ${eId}.`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Verify that all bridge pieces are structurally connected to fixed cliff supports
   */
  static validateSupportConnectivity(graph, roundConfig) {
    const errors = [];

    if (graph.fixedVertexIds.size < 2) {
      errors.push('The environment must contain at least 2 fixed support anchor vertices.');
      return { valid: false, errors };
    }

    // Check each piece connects to at least one fixed support
    const disconnectedPieces = [];
    for (const [pieceId, piece] of graph.pieces) {
      if (!graph.isConnectedToSupports(pieceId)) {
        disconnectedPieces.push(pieceId);
      }
    }

    if (disconnectedPieces.length > 0) {
      errors.push(`Disconnected floating structure: Piece(s) #${disconnectedPieces.join(', #')} do not connect to any fixed cliff support.`);
    }

    // Check that all fixed supports are connected together in the same component
    const fixedIds = Array.from(graph.fixedVertexIds);
    const startAnchor = fixedIds[0];
    const visited = new Set();
    const queue = [startAnchor];

    while (queue.length > 0) {
      const currId = queue.shift();
      if (visited.has(currId)) continue;
      visited.add(currId);

      const vertex = graph.canonicalVertices.get(currId);
      if (!vertex) continue;

      for (const edgeId of vertex.connectedEdgeIds) {
        const edge = graph.edges.get(edgeId);
        if (!edge) continue;
        const neighborId = edge.vertexAId === currId ? edge.vertexBId : edge.vertexAId;
        if (!visited.has(neighborId)) {
          queue.push(neighborId);
        }
      }
    }

    const unreachedFixed = fixedIds.filter(id => !visited.has(id));
    if (unreachedFixed.length > 0) {
      errors.push('Bridge structure does not span across to all required cliff anchors.');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Verify that there is a continuous road deck path between left and right cliff anchors
   */
  static validateRoadContinuity(graph, roundConfig) {
    const errors = [];

    // Filter only road edges
    const roadEdges = Array.from(graph.edges.values()).filter(e => e.isRoad);
    if (roadEdges.length === 0) {
      errors.push('No road deck pieces constructed. Vehicles require a road deck to cross!');
      return { valid: false, errors };
    }

    // Build road adjacency map (vertexId -> Set of neighbor vertexIds via road)
    const roadAdjacency = new Map();
    for (const edge of roadEdges) {
      if (!roadAdjacency.has(edge.vertexAId)) roadAdjacency.set(edge.vertexAId, new Set());
      if (!roadAdjacency.has(edge.vertexBId)) roadAdjacency.set(edge.vertexBId, new Set());
      roadAdjacency.get(edge.vertexAId).add(edge.vertexBId);
      roadAdjacency.get(edge.vertexBId).add(edge.vertexAId);
    }

    // Find the left and right cliff anchors from round config
    const cliffs = roundConfig ? roundConfig.cliffs : [];
    if (cliffs.length < 2) {
      errors.push('Round configuration requires at least left and right cliffs.');
      return { valid: false, errors };
    }

    const leftCliff = cliffs[0];
    const rightCliff = cliffs[cliffs.length - 1];

    const leftAnchor = graph.findCanonicalVertexAt(leftCliff.x, leftCliff.y);
    const rightAnchor = graph.findCanonicalVertexAt(rightCliff.x, rightCliff.y);

    if (!leftAnchor || !rightAnchor) {
      errors.push('Could not locate cliff anchor vertices on the bridge graph.');
      return { valid: false, errors };
    }

    // BFS specifically over road edges from leftAnchor to rightAnchor
    const visited = new Set();
    const queue = [leftAnchor.id];
    let pathFound = false;

    while (queue.length > 0) {
      const currId = queue.shift();
      if (currId === rightAnchor.id) {
        pathFound = true;
        break;
      }
      if (visited.has(currId)) continue;
      visited.add(currId);

      const neighbors = roadAdjacency.get(currId);
      if (neighbors) {
        for (const neighborId of neighbors) {
          if (!visited.has(neighborId)) {
            queue.push(neighborId);
          }
        }
      }
    }

    if (!pathFound) {
      errors.push('Road deck is not continuous from the West cliff entrance to the East cliff exit.');
    }

    return {
      valid: errors.length === 0,
      errors,
      roadEdgeCount: roadEdges.length
    };
  }
}
