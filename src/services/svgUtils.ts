// 遞迴計算累積的 Transform 位移 (從 SVG 根節點到目標元素)
export const getCumulativeTransform = (element: Element, stopAt: Element): { x: number; y: number } => {
  let x = 0, y = 0;
  let current = element;

  while (current && current !== stopAt) {
    const transform = current.getAttribute('transform');
    if (transform) {
      const match = transform.match(/translate\s*\(\s*([-\d.]+)(?:[ ,]+([-\d.]+))?\s*\)/);
      if (match) {
        x += parseFloat(match[1]);
        y += parseFloat(match[2] || '0');
      }
    }
    current = current.parentElement as Element;
  }
  return { x, y };
};
