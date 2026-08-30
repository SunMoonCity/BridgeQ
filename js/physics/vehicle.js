// vehicle.js - Vehicle dynamics, wheel contact, traction, and load distribution model

export class Vehicle {
  /**
   * @param {object} config
   * @param {number} config.id - Vehicle ID
   * @param {number} config.mass - Vehicle mass in kg (e.g. 50 to 250)
   * @param {number} config.speed - Target driving speed in m/s (e.g. 20 to 25)
   * @param {number} config.startX - Initial starting X coordinate (default 0)
   * @param {number} config.wheelBase - Distance between front and rear wheels (default 10m)
   * @param {number} config.fallThresholdY - Y coordinate below which vehicle is considered fallen (default -50)
   * @param {number} config.endX - X coordinate representing successful bridge crossing (default 400)
   * @param {string} config.color - Vehicle rendering color
   */
  constructor(config = {}) {
    this.id = config.id || 1;
    this.mass = config.mass || 100;
    this.targetSpeed = config.speed || 25;
    this.wheelBase = config.wheelBase || 10;
    this.halfWheelBase = this.wheelBase / 2;
    this.fallThresholdY = config.fallThresholdY !== undefined ? config.fallThresholdY : 200;
    this.endX = config.endX !== undefined ? config.endX : 400;
    this.color = config.color || '#2563eb';

    // Kinematic state
    this.x = config.startX !== undefined ? config.startX : 0;
    this.y = 600;
    this.vx = this.targetSpeed;
    this.vy = 0;
    this.angle = 0; // Chassis pitch angle in radians

    // Wheel states
    this.frontWheel = { x: this.x + this.halfWheelBase, y: this.y, onRoad: true };
    this.rearWheel = { x: this.x - this.halfWheelBase, y: this.y, onRoad: true };

    // Lifecycle status
    this.hasEntered = false;
    this.hasCrossed = false;
    this.hasFallen = false;
    this.inAir = false;
  }

  /**
   * Step vehicle physics by timestep dt
   * @param {number} dt - Timestep in seconds
   * @param {import('./road-surface.js').RoadSurface} roadSurface
   * @param {number} gravity - Gravity acceleration (e.g. -9.81 m/s^2)
   */
  update(dt, roadSurface, gravity = -9.81) {
    if (this.hasCrossed || this.hasFallen) return;

    const halfW = this.halfWheelBase;
    const frontX = this.x + halfW;
    const rearX = this.x - halfW;

    // 1. Query road surface for front and rear wheels
    const qFront = roadSurface ? roadSurface.queryAtX(frontX) : { onRoad: false };
    const qRear = roadSurface ? roadSurface.queryAtX(rearX) : { onRoad: false };

    this.frontWheel.x = frontX;
    this.rearWheel.x = rearX;
    this.frontWheel.onRoad = qFront.onRoad;
    this.rearWheel.onRoad = qRear.onRoad;

    if (qFront.onRoad || qRear.onRoad) {
      this.inAir = false;
      this.hasEntered = true;

      // Determine chassis elevation & orientation from wheels
      const frontY = qFront.onRoad ? qFront.y : (qRear.y || this.y);
      const rearY = qRear.onRoad ? qRear.y : (qFront.y || this.y);

      this.frontWheel.y = frontY;
      this.rearWheel.y = rearY;

      // Chassis center elevation & orientation angle
      this.y = (frontY + rearY) / 2;
      this.angle = Math.atan2(frontY - rearY, this.wheelBase);

      // Total vehicle downward weight force: F_g = m * g (negative)
      const totalWeightForce = this.mass * gravity;
      const halfWeight = totalWeightForce / 2;

      // Apply wheel loads to road nodes
      if (qFront.onRoad) {
        roadSurface.applyContactLoad(frontX, 0, halfWeight);
      }
      if (qRear.onRoad) {
        roadSurface.applyContactLoad(rearX, 0, halfWeight);
      }

      // Drive traction forward along road tangent
      const slopeCos = Math.cos(this.angle);
      this.vx = this.targetSpeed * Math.max(0.2, slopeCos);
      this.x += this.vx * dt;
    } else {
      // Vehicle in freefall (road collapsed or end of cliff gap)
      this.inAir = true;
      this.vy += gravity * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.frontWheel.y = this.y;
      this.rearWheel.y = this.y;
    }

    // 2. Check for falling failure
    if (this.y < this.fallThresholdY) {
      this.hasFallen = true;
    }

    // 3. Check for successful crossing completion
    if (this.x >= this.endX && !this.hasFallen && !this.inAir) {
      this.hasCrossed = true;
    }
  }

  /**
   * Reset vehicle to initial state
   * @param {number} startX
   */
  reset(startX = 0) {
    this.x = startX;
    this.y = 600;
    this.vx = this.targetSpeed;
    this.vy = 0;
    this.angle = 0;
    this.hasEntered = false;
    this.hasCrossed = false;
    this.hasFallen = false;
    this.inAir = false;
  }
}
