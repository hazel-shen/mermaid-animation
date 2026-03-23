// 遞迴計算累積的 Transform 位移 (從 SVG 根節點到目標元素)
export const getCumulativeTransform = (element: Element, stopAt: Element): { x: number; y: number } => {
  let x = 0, y = 0;
  let current = element;

  while (current && current !== stopAt) {
    const transform = current.getAttribute('transform');
    if (transform) {
      // matrix(a,b,c,d,e,f) — e and f are the translation components
      const matrixMatch = transform.match(/matrix\s*\(\s*([-\d.e+]+)[\s,]+([-\d.e+]+)[\s,]+([-\d.e+]+)[\s,]+([-\d.e+]+)[\s,]+([-\d.e+]+)[\s,]+([-\d.e+]+)\s*\)/);
      if (matrixMatch) {
        x += parseFloat(matrixMatch[5]);
        y += parseFloat(matrixMatch[6]);
      } else {
        const translateMatch = transform.match(/translate\s*\(\s*([-\d.e+]+)(?:[\s,]+([-\d.e+]+))?\s*\)/);
        if (translateMatch) {
          x += parseFloat(translateMatch[1]);
          y += parseFloat(translateMatch[2] || '0');
        }
      }
    }
    current = current.parentElement as Element;
  }
  return { x, y };
};

/**
 * Computes the cumulative affine transform from an element up to the SVG root,
 * in SVG viewBox coordinate space. Returns { tx, ty, sx, sy } suitable for
 * mapping local path coordinates: worldX = sx * localX + tx.
 *
 * Transforms are composed outer-first (root → element order), correctly
 * handling nested matrix(), translate(), and scale() attributes.
 */
export const getCumulativeMatrix = (
  element: Element,
  stopAt: Element,
): { tx: number; ty: number; sx: number; sy: number } => {
  // Collect ancestors from element up to (not including) stopAt
  const chain: Element[] = [];
  let cur = element;
  while (cur && cur !== stopAt) {
    chain.push(cur);
    cur = cur.parentElement as Element;
  }

  // Represent cumulative transform as [a, d, e, f] (no shear for SVG pie):
  // world = [ sx * local_x + tx, sy * local_y + ty ]
  // Compose outer-first (chain is inner→outer, so iterate reversed)
  let sx = 1, sy = 1, tx = 0, ty = 0;

  for (let i = chain.length - 1; i >= 0; i--) {
    const attr = chain[i].getAttribute('transform');
    if (!attr) continue;

    const matM = attr.match(
      /matrix\s*\(\s*([-\d.e+]+)[\s,]+([-\d.e+]+)[\s,]+([-\d.e+]+)[\s,]+([-\d.e+]+)[\s,]+([-\d.e+]+)[\s,]+([-\d.e+]+)\s*\)/
    );
    if (matM) {
      const na = parseFloat(matM[1]); // scale x
      const nd = parseFloat(matM[4]); // scale y
      const ne = parseFloat(matM[5]); // translate x
      const nf = parseFloat(matM[6]); // translate y
      // new_world = outer(inner(local))
      // outer: X = na*x + ne, Y = nd*y + nf  (applied to inner result sx*l+tx)
      // => X = na*(sx*l+tx)+ne = (na*sx)*l + (na*tx+ne)
      tx = na * tx + ne;
      ty = nd * ty + nf;
      sx = na * sx;
      sy = nd * sy;
      continue;
    }

    const trM = attr.match(/translate\s*\(\s*([-\d.e+]+)(?:[\s,]+([-\d.e+]+))?\s*\)/);
    if (trM) {
      // outer translate: X = x + e  => tx_new = tx + e (but e is added after current sx scaling)
      // world = (sx*l + tx) + e  => tx += e  (translate is additive in world space)
      tx += parseFloat(trM[1]);
      ty += parseFloat(trM[2] || '0');
    }

    const scM = attr.match(/scale\s*\(\s*([-\d.e+]+)(?:[\s,]+([-\d.e+]+))?\s*\)/);
    if (scM) {
      const ns = parseFloat(scM[1]);
      const ns2 = parseFloat(scM[2] || scM[1]);
      tx *= ns;
      ty *= ns2;
      sx *= ns;
      sy *= ns2;
    }
  }

  return { tx, ty, sx, sy };
};
