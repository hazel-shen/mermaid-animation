/** Parse a path segment into its command char and numeric arguments. */
export const parseSegment = (seg: string): { cmd: string; nums: number[] } => {
  const cmd = seg[0].toUpperCase();
  const nums = seg.slice(1).trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
  return { cmd, nums };
};

/** Tokenise a path `d` string into its segments. */
export const tokenisePath = (d: string) =>
  (d.trim().match(/[MLCQTSAZ][^MLCQTSAZ]*/gi) || []);

/**
 * Returns the LAST point of the path and the tangent direction approaching it.
 * angle points FROM the penultimate point TOWARD the endpoint (i.e. the arrow tip angle).
 */
export const getPathEnd = (pathD: string): { x: number; y: number; angle: number } | null => {
  const segs = tokenisePath(pathD);
  if (segs.length < 2) return null;

  const { cmd, nums } = parseSegment(segs[segs.length - 1]);
  const { cmd: pc, nums: pn } = parseSegment(segs[segs.length - 2]);

  let ex: number, ey: number, dx: number, dy: number;

  if (cmd === 'Q' && nums.length >= 4) {
    // Quadratic Bézier (C4 relationships): tangent at end = end − control point
    ex = nums[nums.length - 2]; ey = nums[nums.length - 1];
    dx = ex - nums[nums.length - 4]; dy = ey - nums[nums.length - 3];
  } else if (cmd === 'C' && nums.length >= 6) {
    ex = nums[nums.length - 2]; ey = nums[nums.length - 1];
    dx = ex - nums[nums.length - 4]; dy = ey - nums[nums.length - 3];
  } else if (cmd === 'L' && nums.length >= 2) {
    ex = nums[nums.length - 2]; ey = nums[nums.length - 1];
    const pEnd = pc === 'C' && pn.length >= 6
      ? { x: pn[pn.length - 2], y: pn[pn.length - 1] }
      : pn.length >= 2 ? { x: pn[pn.length - 2], y: pn[pn.length - 1] } : null;
    if (!pEnd) return null;
    dx = ex - pEnd.x; dy = ey - pEnd.y;
    if (pc === 'C' && pn.length >= 6) {
      const cDx = pn[pn.length - 2] - pn[pn.length - 4];
      const cDy = pn[pn.length - 1] - pn[pn.length - 3];
      const lLen = Math.hypot(dx, dy);
      if (lLen < 0.5) {
        dx = cDx; dy = cDy;
        ex = pn[pn.length - 2]; ey = pn[pn.length - 1];
      }
    }
  } else if (cmd === 'M' && nums.length >= 2) {
    ex = nums[nums.length - 2]; ey = nums[nums.length - 1];
    if (pn.length < 2) return null;
    dx = ex - pn[pn.length - 2]; dy = ey - pn[pn.length - 1];
  } else {
    return null;
  }

  if (Math.hypot(dx, dy) < 0.5) return null;
  return { x: ex, y: ey, angle: Math.atan2(dy, dx) };
};

/**
 * Returns the FIRST point of the path and the tangent direction leaving it
 * (angle points FROM the start TOWARD the second point — reversed for drawing).
 */
export const getPathStart = (pathD: string): { x: number; y: number; angle: number } | null => {
  const segs = tokenisePath(pathD);
  if (segs.length < 2) return null;

  const { cmd: c0, nums: n0 } = parseSegment(segs[0]!);
  const { cmd: c1, nums: n1 } = parseSegment(segs[1]!);

  if (c0 !== 'M' || n0.length < 2) return null;
  const sx = n0[0], sy = n0[1];

  let nx: number, ny: number;
  if (c1 === 'L' && n1.length >= 2) {
    nx = n1[0]; ny = n1[1];
  } else if (c1 === 'C' && n1.length >= 6) {
    nx = n1[0]; ny = n1[1];
  } else if (n1.length >= 2) {
    nx = n1[0]; ny = n1[1];
  } else {
    return null;
  }

  const dx = nx - sx, dy = ny - sy;
  if (Math.hypot(dx, dy) < 0.5) return null;
  return { x: sx, y: sy, angle: Math.atan2(dy, dx) + Math.PI };
};
