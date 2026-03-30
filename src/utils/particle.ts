export class Particle {
  progress: number;
  speed: number;
  pathElement: SVGPathElement | null;
  private totalLength: number;

  constructor(pathD: string) {
    this.progress = Math.random();
    this.speed = 0.002 + Math.random() * 0.004;
    this.totalLength = 0;
    try {
      this.pathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
      this.pathElement.setAttribute("d", pathD);
      this.totalLength = this.pathElement.getTotalLength();
    } catch {
      this.pathElement = null;
    }
  }

  update(multiplier: number = 1) {
    this.progress += this.speed * multiplier;
    if (this.progress >= 1) this.progress = 0;
  }

  getPosition() {
    if (!this.pathElement || this.totalLength === 0) return { x: 0, y: 0 };
    try {
      const point = this.pathElement.getPointAtLength(this.progress * this.totalLength);
      return { x: point.x, y: point.y };
    } catch {
      return { x: 0, y: 0 };
    }
  }
}
