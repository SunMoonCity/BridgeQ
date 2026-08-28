// viewport.js - World-to-Screen coordinate transformation and camera controller

export class Viewport {
  constructor(screenWidth = 800, screenHeight = 600) {
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    this.scale = 1.0;
    this.offsetX = 0;
    this.offsetY = 0;
  }

  resize(width, height) {
    this.screenWidth = Math.max(10, width);
    this.screenHeight = Math.max(10, height);
  }

  /**
   * Fit viewport to encompass specified world coordinate bounds with margin
   */
  fitBounds(bounds, paddingRatio = 0.12) {
    const spanX = Math.max(1, bounds.xMax - bounds.xMin);
    const spanY = Math.max(1, bounds.yMax - bounds.yMin);

    const padX = spanX * paddingRatio;
    const padY = spanY * paddingRatio;

    const minX = bounds.xMin - padX;
    const maxX = bounds.xMax + padX;
    const minY = bounds.yMin - padY;
    const maxY = bounds.yMax + padY;

    const targetSpanX = maxX - minX;
    const targetSpanY = maxY - minY;

    const scaleX = this.screenWidth / targetSpanX;
    const scaleY = this.screenHeight / targetSpanY;

    this.scale = Math.min(scaleX, scaleY);

    // Center geometry in screen
    const scaledWidth = targetSpanX * this.scale;
    const scaledHeight = targetSpanY * this.scale;

    this.offsetX = (this.screenWidth - scaledWidth) / 2 - minX * this.scale;
    // In world coordinates, +y is UP, so offsetY aligns with screen bottom
    this.offsetY = (this.screenHeight - scaledHeight) / 2 + maxY * this.scale;
  }

  /**
   * Convert World coordinate to Screen pixel coordinate
   */
  worldToScreen(wx, wy) {
    return {
      x: this.offsetX + wx * this.scale,
      y: this.offsetY - wy * this.scale
    };
  }

  /**
   * Convert Screen pixel coordinate to World coordinate
   */
  screenToWorld(sx, sy) {
    return {
      x: (sx - this.offsetX) / this.scale,
      y: (this.offsetY - sy) / this.scale
    };
  }
}
