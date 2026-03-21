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
