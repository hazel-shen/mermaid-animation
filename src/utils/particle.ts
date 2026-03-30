const SAMPLE_COUNT = 100;

export class Particle {
  progress: number;
  speed: number;
  pathElement: SVGPathElement | null;
  private samples: { x: number; y: number }[];

  constructor(pathD: string) {
    this.progress = Math.random();
    this.speed = 0.002 + Math.random() * 0.004;
    this.samples = [];
    this.pathElement = null;

    try {
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      el.setAttribute('d', pathD);
      const len = el.getTotalLength();
      if (len > 0 && !isNaN(len)) {
        for (let i = 0; i < SAMPLE_COUNT; i++) {
          const pt = el.getPointAtLength((i / (SAMPLE_COUNT - 1)) * len);
          this.samples.push({ x: pt.x, y: pt.y });
        }
      }
      // el is now unreferenced and eligible for GC
    } catch {
      // leave samples empty — getPosition() will return (0,0)
    }
  }

  update(multiplier: number = 1) {
    this.progress += this.speed * multiplier;
    if (this.progress >= 1) this.progress = 0;
  }

  getPosition() {
    if (this.samples.length < 2) return { x: 0, y: 0 };
    const idx = this.progress * (this.samples.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.min(lo + 1, this.samples.length - 1);
    const t = idx - lo;
    return {
      x: this.samples[lo].x + (this.samples[hi].x - this.samples[lo].x) * t,
      y: this.samples[lo].y + (this.samples[hi].y - this.samples[lo].y) * t,
    };
  }
}
