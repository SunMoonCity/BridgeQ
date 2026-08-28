// load-test-runner.js - Sequential 5-Stage Load Test Orchestrator

import { Vehicle } from './vehicle.js';
import { RoadSurface } from './road-surface.js';
import { eventBus } from '../core/event-bus.js';
import { EVENTS } from '../config/constants.js';

export class LoadTestRunner {
  /**
   * @param {import('./physics-simulation.js').PhysicsSimulation} simulation
   * @param {object} roundConfig - Round specification containing loadStages (1 to 5)
   * @param {object} options
   */
  constructor(simulation, roundConfig, options = {}) {
    this.simulation = simulation;
    this.roundConfig = roundConfig;
    this.loadStages = (roundConfig && roundConfig.loadStages) || [];
    this.options = options;

    this.roadSurface = new RoadSurface(simulation ? simulation.world : null);

    // Lifecycle state
    this.currentStageIndex = 0; // 0 to 4 (corresponding to Stages 1 to 5)
    this.stagesPassed = 0;
    this.activeVehicles = [];
    this.spawnedCount = 0;
    this.timeSinceLastSpawn = 0;
    this.stageElapsedTime = 0;
    this.totalElapsedTime = 0;

    this.isRunning = false;
    this.isComplete = false;
    this.isFailed = false;
    this.failureDetails = null;

    // Callbacks
    this.onProgress = null; // callback({ stage, stagesPassed, vehicles, stressMap })
    this.onStageComplete = null; // callback({ stage, stagesPassed })
    this.onTestComplete = null; // callback({ stagesPassed, totalStages, score, isFailed, failureDetails })
  }

  /**
   * Start the 5-stage load test from Stage 1
   */
  start() {
    this.currentStageIndex = 0;
    this.stagesPassed = 0;
    this.activeVehicles = [];
    this.spawnedCount = 0;
    this.timeSinceLastSpawn = 9999; // Trigger immediate spawn of first vehicle
    this.stageElapsedTime = 0;
    this.totalElapsedTime = 0;
    this.isRunning = true;
    this.isComplete = false;
    this.isFailed = false;
    this.failureDetails = null;

    this.initCurrentStage();
  }

  /**
   * Initialize current stage parameters
   */
  initCurrentStage() {
    this.activeVehicles = [];
    this.spawnedCount = 0;
    this.timeSinceLastSpawn = 9999;
    this.stageElapsedTime = 0;

    if (this.simulation) {
      this.simulation.vehicles = this.activeVehicles;
    }
  }

  /**
   * Get current stage configuration object
   */
  getCurrentStageConfig() {
    if (this.currentStageIndex >= 0 && this.currentStageIndex < this.loadStages.length) {
      return this.loadStages[this.currentStageIndex];
    }
    return null;
  }

  /**
   * Step load test by fixed timestep dt
   * @param {number} dt - Timestep in seconds (e.g. 1/60)
   * @returns {{ running: boolean, complete: boolean, failed: boolean, stagesPassed: number, failureDetails?: object }}
   */
  step(dt = 1 / 60) {
    if (!this.isRunning || this.isComplete || this.isFailed) {
      return {
        running: this.isRunning,
        complete: this.isComplete,
        failed: this.isFailed,
        stagesPassed: this.stagesPassed,
        failureDetails: this.failureDetails
      };
    }

    const stageConfig = this.getCurrentStageConfig();
    if (!stageConfig) {
      this.completeTest();
      return { running: false, complete: true, failed: false, stagesPassed: this.stagesPassed };
    }

    this.stageElapsedTime += dt;
    this.totalElapsedTime += dt;
    this.timeSinceLastSpawn += dt;

    // 1. Vehicle Spawning: Check if next vehicle should spawn
    const spawnGap = stageConfig.spawnGapSeconds || 1.5;
    if (this.spawnedCount < stageConfig.carCount && this.timeSinceLastSpawn >= spawnGap) {
      this.spawnVehicle(stageConfig);
      this.spawnedCount++;
      this.timeSinceLastSpawn = 0;
    }

    // 2. Step Physics Simulation
    const simStep = this.simulation.step();
    if (simStep.failed) {
      return this.failTest(simStep.failure);
    }

    // 3. Update Vehicle Kinematics & Road Load
    const endX = (this.roundConfig && this.roundConfig.cliffs && this.roundConfig.cliffs[1]) ? this.roundConfig.cliffs[1].x : 400;

    for (const vehicle of this.activeVehicles) {
      vehicle.endX = endX;
      vehicle.update(dt, this.roadSurface, this.simulation.gravity);

      if (vehicle.hasFallen) {
        return this.failTest({
          reason: 'VEHICLE_FALL',
          vehicleId: vehicle.id,
          stage: stageConfig.stage,
          message: `Vehicle #${vehicle.id} fell off bridge in Stage ${stageConfig.stage}.`
        });
      }
    }

    // 4. Progress Hook
    if (typeof this.onProgress === 'function') {
      this.onProgress({
        stage: stageConfig.stage,
        stagesPassed: this.stagesPassed,
        vehicles: this.activeVehicles,
        time: this.totalElapsedTime
      });
    }

    // 5. Stage Completion Check: All cars spawned and crossed
    const allSpawned = this.spawnedCount >= stageConfig.carCount;
    const allCrossed = this.activeVehicles.length > 0 && this.activeVehicles.every(v => v.hasCrossed);

    if (allSpawned && allCrossed) {
      this.stagesPassed++;

      eventBus.emit(EVENTS.STAGE_COMPLETED, {
        stage: stageConfig.stage,
        stagesPassed: this.stagesPassed,
        totalStages: this.loadStages.length
      });

      if (typeof this.onStageComplete === 'function') {
        this.onStageComplete({
          stage: stageConfig.stage,
          stagesPassed: this.stagesPassed
        });
      }

      // Check if more stages remain
      if (this.currentStageIndex + 1 < this.loadStages.length) {
        this.currentStageIndex++;
        this.initCurrentStage();
      } else {
        this.completeTest();
      }
    }

    return {
      running: this.isRunning,
      complete: this.isComplete,
      failed: this.isFailed,
      stagesPassed: this.stagesPassed,
      stage: stageConfig.stage
    };
  }

  /**
   * Spawn a new vehicle for the current stage
   */
  spawnVehicle(stageConfig) {
    const startX = (this.roundConfig && this.roundConfig.cliffs && this.roundConfig.cliffs[0]) ? this.roundConfig.cliffs[0].x : 0;
    const endX = (this.roundConfig && this.roundConfig.cliffs && this.roundConfig.cliffs[1]) ? this.roundConfig.cliffs[1].x : 400;

    const colors = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#9333ea', '#0891b2'];
    const vehicleColor = colors[(this.spawnedCount) % colors.length];

    const vehicle = new Vehicle({
      id: this.spawnedCount + 1,
      mass: stageConfig.carWeight || 100,
      speed: stageConfig.speed || 25,
      startX,
      endX,
      color: vehicleColor
    });

    this.activeVehicles.push(vehicle);
    this.simulation.vehicles = this.activeVehicles;
  }

  /**
   * Complete the load test successfully
   */
  completeTest() {
    this.isRunning = false;
    this.isComplete = true;
    this.isFailed = false;

    eventBus.emit(EVENTS.ROUND_COMPLETED, {
      stagesPassed: this.stagesPassed,
      totalStages: this.loadStages.length,
      score: `${this.stagesPassed}/${this.loadStages.length}`
    });

    if (typeof this.onTestComplete === 'function') {
      this.onTestComplete({
        stagesPassed: this.stagesPassed,
        totalStages: this.loadStages.length,
        score: `${this.stagesPassed}/${this.loadStages.length}`,
        isFailed: false
      });
    }
  }

  /**
   * Handle test failure and halt test immediately
   */
  failTest(failure) {
    this.isRunning = false;
    this.isComplete = false;
    this.isFailed = true;
    this.failureDetails = failure;

    const stageConfig = this.getCurrentStageConfig();
    const failedStage = stageConfig ? stageConfig.stage : (this.stagesPassed + 1);

    eventBus.emit(EVENTS.STAGE_FAILED, {
      stage: failedStage,
      stagesPassed: this.stagesPassed,
      totalStages: this.loadStages.length,
      reason: failure ? failure.reason : 'COLLAPSE',
      message: failure ? failure.message : 'Structural collapse'
    });

    if (typeof this.onTestComplete === 'function') {
      this.onTestComplete({
        stagesPassed: this.stagesPassed,
        totalStages: this.loadStages.length,
        score: `${this.stagesPassed}/${this.loadStages.length}`,
        isFailed: true,
        failureDetails: failure
      });
    }

    return {
      running: false,
      complete: false,
      failed: true,
      stagesPassed: this.stagesPassed,
      failureDetails: failure
    };
  }

  /**
   * Run the load test synchronously for N ticks or until completion/failure
   * @param {number} maxTicks
   */
  runSync(maxTicks = 10000) {
    this.start();
    let ticks = 0;
    while (this.isRunning && ticks < maxTicks) {
      this.step(1 / 60);
      ticks++;
    }
    return {
      stagesPassed: this.stagesPassed,
      isComplete: this.isComplete,
      isFailed: this.isFailed,
      failureDetails: this.failureDetails,
      ticks
    };
  }
}
