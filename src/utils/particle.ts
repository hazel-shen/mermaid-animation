export class Particle {
  progress: number;
  speed: number;
  pathElement: SVGPathElement | null;

  constructor(pathD: string) {
    this.progress = Math.random();
    this.speed = 0.002 + Math.random() * 0.004;
    try {
      this.pathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
      this.pathElement.setAttribute("d", pathD);
    } catch {
      this.pathElement = null;
    }
  }

  update(multiplier: number = 1) {
    this.progress += this.speed * multiplier;
    if (this.progress >= 1) this.progress = 0;
  }

  getPosition() {
    if (!this.pathElement) return { x: 0, y: 0 };
    try {
      const len = this.pathElement.getTotalLength();
      if (len === 0 || isNaN(len)) return { x: 0, y: 0 };
      const point = this.pathElement.getPointAtLength(this.progress * len);
      return { x: point.x, y: point.y };
    } catch {
      return { x: 0, y: 0 };
    }
  }
}
