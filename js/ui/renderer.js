// renderer.js - High-performance 2D Canvas renderer for coordinate grid, cliffs, and bridge graph

import { Viewport } from './viewport.js';
import { MATERIALS } from '../config/materials.js';

export class BridgeRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.viewport = new Viewport(canvas.width, canvas.height);
    this.roundConfig = null;
    this.graph = null;
    this.selectedPieceId = null;
    this.isBuildingActive = false; // true when left cliff dims for construction
    this.customNodePositions = null; // Map<vertexId, {x, y}> for real-time physics deformation
    this.edgeStressMap = null; // Map<edgeId, number [0..1]> for stress heatmap
    this.vehicles = []; // Array of vehicle objects to render
  }

  setRound(roundConfig) {
    this.roundConfig = roundConfig;
    this.fitToScreen();
  }

  setGraph(graph) {
    this.graph = graph;
  }

  setSelectedPiece(pieceId) {
    this.selectedPieceId = pieceId;
  }

  setBuildingActive(active) {
    this.isBuildingActive = active;
  }

  setSimulationState(customNodePositions, edgeStressMap, vehicles = []) {
    this.customNodePositions = customNodePositions;
    this.edgeStressMap = edgeStressMap;
    this.vehicles = vehicles;
  }

  fitToScreen() {
    if (!this.roundConfig) return;
    this.viewport.resize(this.canvas.width, this.canvas.height);

    const bounds = {
      xMin: this.roundConfig.ground.xMin,
      xMax: this.roundConfig.ground.xMax,
      yMin: this.roundConfig.ground.y,
      yMax: Math.max(...this.roundConfig.cliffs.map(c => c.y)) + 150
    };
    this.viewport.fitBounds(bounds, 0.12);
  }

  /**
   * Main Render Frame
   */
  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Clear Canvas
    ctx.clearRect(0, 0, w, h);

    // 1. Background Fill
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, w, h);

    // 2. Full-Screen Coordinate Grid
    this.renderCoordinateGrid(ctx, w, h);

    // 3. Terrain: Cliffs and Ground
    if (this.roundConfig) {
      this.renderTerrain(ctx);
    }

    // 4. Logical Bridge Graph (Edges & Canonical Vertices)
    if (this.graph) {
      this.renderBridgeGraph(ctx);
    }

    // 5. Vehicles (if testing)
    if (this.vehicles && this.vehicles.length > 0) {
      this.renderVehicles(ctx);
    }
  }

  /**
   * Render infinite/full-screen coordinate grid with axes & numeric world markers
   */
  renderCoordinateGrid(ctx, w, h) {
    const vp = this.viewport;
    const topLeftWorld = vp.screenToWorld(0, 0);
    const bottomRightWorld = vp.screenToWorld(w, h);

    const minX = Math.floor(topLeftWorld.x / 50) * 50;
    const maxX = Math.ceil(bottomRightWorld.x / 50) * 50;
    const minY = Math.floor(bottomRightWorld.y / 50) * 50;
    const maxY = Math.ceil(topLeftWorld.y / 50) * 50;

    // Minor grid lines (every 25 units)
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.7)';
    ctx.lineWidth = 1;

    for (let wx = minX; wx <= maxX; wx += 25) {
      const s = vp.worldToScreen(wx, 0);
      ctx.beginPath();
      ctx.moveTo(s.x, 0);
      ctx.lineTo(s.x, h);
      ctx.stroke();
    }
    for (let wy = minY; wy <= maxY; wy += 25) {
      const s = vp.worldToScreen(0, wy);
      ctx.beginPath();
      ctx.moveTo(0, s.y);
      ctx.lineTo(w, s.y);
      ctx.stroke();
    }

    // Major grid lines & labels (every 50 units)
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';

    for (let wx = minX; wx <= maxX; wx += 50) {
      const s = vp.worldToScreen(wx, 0);
      ctx.beginPath();
      ctx.moveTo(s.x, 0);
      ctx.lineTo(s.x, h);
      ctx.stroke();

      if (s.x > 30 && s.x < w - 30) {
        ctx.fillText(`${wx}`, s.x + 3, h - 6);
      }
    }

    for (let wy = minY; wy <= maxY; wy += 50) {
      const s = vp.worldToScreen(0, wy);
      ctx.beginPath();
      ctx.moveTo(0, s.y);
      ctx.lineTo(w, s.y);
      ctx.stroke();

      if (s.y > 20 && s.y < h - 20) {
        ctx.fillText(`${wy}`, 8, s.y - 4);
      }
    }
  }

  /**
   * Render Ground and Left/Right Cliffs with wireframe styling
   */
  renderTerrain(ctx) {
    const vp = this.viewport;
    const cliffs = this.roundConfig.cliffs;
    const ground = this.roundConfig.ground;

    const groundScreen = vp.worldToScreen(ground.xMin, ground.y);
    const groundRightScreen = vp.worldToScreen(ground.xMax, ground.y);

    // Ground Strip
    ctx.fillStyle = '#78350f';
    ctx.fillRect(
      groundScreen.x,
      groundScreen.y,
      groundRightScreen.x - groundScreen.x,
      this.canvas.height - groundScreen.y
    );
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(
      groundScreen.x,
      groundScreen.y,
      groundRightScreen.x - groundScreen.x,
      6
    );

    // Cliffs
    const leftCliff = cliffs[0];
    const rightCliff = cliffs[1];

    const cliffWidth = 250; // Visual cliff thickness

    // Left Cliff (with opacity transition if building active per wireframe)
    ctx.save();
    if (this.isBuildingActive) {
      ctx.globalAlpha = 0.55; // Wireframe specification: left cliff opacity decrease during construction
    }

    const lcTop = vp.worldToScreen(leftCliff.x, leftCliff.y);
    const lcBottom = vp.worldToScreen(leftCliff.x - cliffWidth, ground.y);

    // Left Cliff body
    ctx.fillStyle = '#78350f';
    ctx.fillRect(0, lcTop.y, lcTop.x, this.canvas.height - lcTop.y);
    // Grass top
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(0, lcTop.y, lcTop.x, 8);

    ctx.restore();

    // Right Cliff body
    const rcTop = vp.worldToScreen(rightCliff.x, rightCliff.y);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(rcTop.x, rcTop.y, this.canvas.width - rcTop.x, this.canvas.height - rcTop.y);
    // Grass top
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(rcTop.x, rcTop.y, this.canvas.width - rcTop.x, 8);

    // Fixed Anchor Points (Red circular anchors)
    for (const cliff of cliffs) {
      const anchorPos = vp.worldToScreen(cliff.x, cliff.y);
      ctx.beginPath();
      ctx.arc(anchorPos.x, anchorPos.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#dc2626';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Center silver pin
      ctx.beginPath();
      ctx.arc(anchorPos.x, anchorPos.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
  }

  /**
   * Render all structural edges, road decks, and canonical vertices
   */
  renderBridgeGraph(ctx) {
    const vp = this.viewport;
    const getNodePos = (vertexId) => {
      if (this.customNodePositions && this.customNodePositions.has(vertexId)) {
        const p = this.customNodePositions.get(vertexId);
        return vp.worldToScreen(p.x, p.y);
      }
      const v = this.graph.canonicalVertices.get(vertexId);
      return v ? vp.worldToScreen(v.x, v.y) : { x: 0, y: 0 };
    };

    // 1. Render Edges (Structural Members & Road)
    for (const edge of this.graph.edges.values()) {
      const p1 = getNodePos(edge.vertexAId);
      const p2 = getNodePos(edge.vertexBId);

      const isSelected = this.selectedPieceId !== null && edge.pieceId === this.selectedPieceId;
      const mat = MATERIALS[edge.material] || MATERIALS.steel;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);

      if (isSelected) {
        // Glowing halo for selected piece
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = edge.isRoad ? 10 : 8;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // Determine member color (material color or stress heatmap)
      if (this.edgeStressMap && this.edgeStressMap.has(edge.id)) {
        const stress = this.edgeStressMap.get(edge.id); // 0.0 to 1.0+
        ctx.strokeStyle = this.getStressColor(stress);
        ctx.lineWidth = edge.isRoad ? 6 : 4;
      } else {
        ctx.strokeStyle = edge.isRoad ? '#0f172a' : (isSelected ? '#0284c7' : mat.color);
        ctx.lineWidth = edge.isRoad ? 5 : 3.5;
      }

      ctx.lineCap = 'round';
      ctx.stroke();

      // If road deck, draw center dashed lane line
      if (edge.isRoad) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.restore();
    }

    // 2. Render Canonical Vertices (Junction Pins)
    for (const vertex of this.graph.canonicalVertices.values()) {
      if (vertex.isFixed) continue; // Fixed anchors rendered in terrain pass

      const pos = getNodePos(vertex.id);

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#334155';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }
  }

  /**
   * Render vehicles crossing the bridge
   */
  renderVehicles(ctx) {
    const vp = this.viewport;
    for (const vehicle of this.vehicles) {
      const pos = vp.worldToScreen(vehicle.x, vehicle.y);

      ctx.save();
      ctx.translate(pos.x, pos.y);
      if (vehicle.angle) ctx.rotate(-vehicle.angle);

      // Chassis
      ctx.fillStyle = vehicle.color || '#2563eb';
      ctx.fillRect(-12, -8, 24, 10);

      // Roof / Cabin
      ctx.fillStyle = '#93c5fd';
      ctx.fillRect(-6, -14, 14, 6);

      // Wheels
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(-8, 2, 4, 0, Math.PI * 2);
      ctx.arc(8, 2, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  /**
   * Stress heatmap gradient: 0% Green -> 50% Yellow -> 90% Orange -> 100%+ Red
   */
  getStressColor(ratio) {
    if (ratio < 0.5) {
      return '#22c55e'; // Green
    } else if (ratio < 0.75) {
      return '#eab308'; // Yellow
    } else if (ratio < 0.95) {
      return '#f97316'; // Orange
    } else {
      return '#ef4444'; // Flashing Red
    }
  }
}
