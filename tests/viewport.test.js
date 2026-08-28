// viewport.test.js - Unit tests for Viewport Coordinate Transformations

import assert from 'node:assert';
import { Viewport } from '../js/ui/viewport.js';

console.log('Testing Viewport Transformations...');

// 1. Basic 1:1 Scale Transformation
{
  const vp = new Viewport(800, 600);
  vp.scale = 1.0;
  vp.offsetX = 100;
  vp.offsetY = 500;

  const screenPt = vp.worldToScreen(50, 50);
  assert.strictEqual(screenPt.x, 150, 'World X 50 + offset 100 should be 150');
  assert.strictEqual(screenPt.y, 450, 'World Y 50 with offset 500 (+y up) should be 450');

  const worldPt = vp.screenToWorld(150, 450);
  assert.strictEqual(worldPt.x, 50, 'Roundtrip X should equal 50');
  assert.strictEqual(worldPt.y, 50, 'Roundtrip Y should equal 50');
}

// 2. fitBounds Auto-scaling
{
  const vp = new Viewport(1000, 500);
  const bounds = {
    xMin: 0,
    xMax: 400,
    yMin: 0,
    yMax: 600
  };

  vp.fitBounds(bounds, 0.1);
  assert.ok(vp.scale > 0, 'Scale must be positive');

  // Verify that both extremes (0,0) and (400, 600) fall inside screen bounds [0..1000] and [0..500]
  const ptMin = vp.worldToScreen(0, 0);
  const ptMax = vp.worldToScreen(400, 600);

  assert.ok(ptMin.x >= 0 && ptMin.x <= 1000, 'Min world point X must fall on screen');
  assert.ok(ptMin.y >= 0 && ptMin.y <= 500, 'Min world point Y must fall on screen');
  assert.ok(ptMax.x >= 0 && ptMax.x <= 1000, 'Max world point X must fall on screen');
  assert.ok(ptMax.y >= 0 && ptMax.y <= 500, 'Max world point Y must fall on screen');
}

console.log('  PASS: Viewport tests');
