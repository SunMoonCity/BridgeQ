// round-config.js - Central configuration for all competition rounds

export const ROUNDS = Object.freeze([
  {
    id: 1,
    label: 'Round 1 - The First Crossing',
    description: 'Construct a stable bridge across a 400m gap with equal cliff heights.',
    cliffs: [
      { x: 0, y: 600, name: 'West Cliff', fixed: true },
      { x: 400, y: 600, name: 'East Cliff', fixed: true }
    ],
    ground: { y: 0, xMin: 0, xMax: 400 },
    fixedVertices: [
      { x: 0, y: 600, isFixed: true },
      { x: 400, y: 600, isFixed: true }
    ],
    allowedRegion: { xMin: 0, xMax: 400, yMin: 0, yMax: 800 },
    sampleResolution: 0.5,
    materialMode: 'choice', // 'fixed' or 'choice'
    allowedMaterials: ['steel', 'wood', 'concrete', 'road'],
    budget: 5000000,
    buildTimeSeconds: 300,
    loadStages: [
      { stage: 1, carCount: 1, carWeight: 50, spawnGapSeconds: 2.0, speed: 25 },
      { stage: 2, carCount: 2, carWeight: 75, spawnGapSeconds: 1.8, speed: 25 },
      { stage: 3, carCount: 3, carWeight: 100, spawnGapSeconds: 1.5, speed: 25 },
      { stage: 4, carCount: 4, carWeight: 125, spawnGapSeconds: 1.2, speed: 25 },
      { stage: 5, carCount: 5, carWeight: 150, spawnGapSeconds: 1.0, speed: 25 }
    ]
  },
  {
    id: 2,
    label: 'Round 2 - Heavy Logistics',
    description: 'Heavier load stages across the equal cliff span with tighter budget constraints.',
    cliffs: [
      { x: 0, y: 600, name: 'West Cliff', fixed: true },
      { x: 400, y: 600, name: 'East Cliff', fixed: true }
    ],
    ground: { y: 0, xMin: 0, xMax: 400 },
    fixedVertices: [
      { x: 0, y: 600, isFixed: true },
      { x: 400, y: 600, isFixed: true }
    ],
    allowedRegion: { xMin: 0, xMax: 400, yMin: 0, yMax: 800 },
    sampleResolution: 0.5,
    materialMode: 'choice',
    allowedMaterials: ['steel', 'wood', 'concrete', 'road'],
    budget: 3500000,
    buildTimeSeconds: 240,
    loadStages: [
      { stage: 1, carCount: 2, carWeight: 80, spawnGapSeconds: 1.5, speed: 25 },
      { stage: 2, carCount: 3, carWeight: 110, spawnGapSeconds: 1.3, speed: 25 },
      { stage: 3, carCount: 4, carWeight: 140, spawnGapSeconds: 1.1, speed: 25 },
      { stage: 4, carCount: 5, carWeight: 170, spawnGapSeconds: 0.9, speed: 25 },
      { stage: 5, carCount: 6, carWeight: 200, spawnGapSeconds: 0.7, speed: 25 }
    ]
  },
  {
    id: 3,
    label: 'Round 3 - Elevation Asymmetry',
    description: 'Connect cliffs with a 100m height differential. High structural shear expected.',
    cliffs: [
      { x: 0, y: 600, name: 'West Low Cliff', fixed: true },
      { x: 400, y: 700, name: 'East High Cliff (+100m)', fixed: true }
    ],
    ground: { y: 0, xMin: 0, xMax: 400 },
    fixedVertices: [
      { x: 0, y: 600, isFixed: true },
      { x: 400, y: 700, isFixed: true }
    ],
    allowedRegion: { xMin: 0, xMax: 400, yMin: 0, yMax: 900 },
    sampleResolution: 0.5,
    materialMode: 'choice',
    allowedMaterials: ['steel', 'wood', 'concrete', 'road'],
    budget: 4000000,
    buildTimeSeconds: 300,
    loadStages: [
      { stage: 1, carCount: 2, carWeight: 90, spawnGapSeconds: 1.5, speed: 22 },
      { stage: 2, carCount: 3, carWeight: 120, spawnGapSeconds: 1.3, speed: 22 },
      { stage: 3, carCount: 4, carWeight: 160, spawnGapSeconds: 1.0, speed: 22 },
      { stage: 4, carCount: 5, carWeight: 190, spawnGapSeconds: 0.8, speed: 22 },
      { stage: 5, carCount: 6, carWeight: 230, spawnGapSeconds: 0.6, speed: 22 }
    ]
  }
]);

export function getRoundConfig(roundNumber) {
  return ROUNDS.find(r => r.id === roundNumber) || null;
}

export function getTotalRounds() {
  return ROUNDS.length;
}
