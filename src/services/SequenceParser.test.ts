import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  parseSequenceNodes,
  parseSequenceLoopFrames,
  parseSequenceMessageLabels,
  parseSequenceEdges,
} from './SequenceParser';
import type { DiagramNode, DiagramEdge, SeqLabel } from '../types';

describe('SequenceParser', () => {
  let svgElement: SVGSVGElement;

  beforeEach(() => {
    svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(svgElement);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('parseSequenceNodes', () => {
    it('should parse actor rectangles with labels', () => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.classList.add('actor');
      rect.setAttribute('x', '10');
      rect.setAttribute('y', '20');
      rect.setAttribute('width', '100');
      rect.setAttribute('height', '50');
      rect.setAttribute('name', 'Alice');

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.textContent = 'Alice';

      g.appendChild(rect);
      g.appendChild(text);
      svgElement.appendChild(g);

      const nodes = parseSequenceNodes(svgElement);

      expect(nodes.length).toBe(1);
      expect(nodes[0]).toMatchObject({
        label: 'Alice',
        type: 'actor',
        shape: 'roundRect',
        x: 60, // 10 + 100/2
        y: 45, // 20 + 50/2
        width: 100,
        height: 50,
      });
    });

    it('should parse actor-man elements', () => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.classList.add('actor-man');
      g.setAttribute('name', 'Bob');
      g.id = 'actor-bob';

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('r', '15');

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.textContent = 'Bob';

      g.appendChild(circle);
      g.appendChild(text);
      svgElement.appendChild(g);

      const nodes = parseSequenceNodes(svgElement);

      expect(nodes.length).toBe(1);
      expect(nodes[0]).toMatchObject({
        id: 'actor-bob',
        label: 'Bob',
        type: 'actor',
        shape: 'circle',
        color: '#ECECFF',
        stroke: '#9370DB',
      });
    });

    it('should parse note boxes', () => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.classList.add('note');
      rect.setAttribute('x', '50');
      rect.setAttribute('y', '100');
      rect.setAttribute('width', '150');
      rect.setAttribute('height', '80');

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.textContent = 'Important note';

      g.appendChild(rect);
      g.appendChild(text);
      svgElement.appendChild(g);

      const nodes = parseSequenceNodes(svgElement);

      expect(nodes.length).toBe(1);
      expect(nodes[0]).toMatchObject({
        label: 'Important note',
        type: 'note',
        shape: 'note',
        x: 125, // 50 + 150/2
        y: 140, // 100 + 80/2
        width: 150,
        height: 80,
        color: '#fff5ad',
        stroke: '#aaaa33',
      });
    });

    it('should parse background rect blocks', () => {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.classList.add('rect');
      rect.setAttribute('x', '0');
      rect.setAttribute('y', '0');
      rect.setAttribute('width', '200');
      rect.setAttribute('height', '300');
      rect.setAttribute('fill', 'rgba(240,240,240,0.5)');

      svgElement.appendChild(rect);

      const nodes = parseSequenceNodes(svgElement);

      expect(nodes.length).toBe(1);
      expect(nodes[0]).toMatchObject({
        type: 'cluster',
        shape: 'rect',
        x: 100,
        y: 150,
        width: 200,
        height: 300,
        color: 'rgba(240,240,240,0.5)',
      });
    });

    it('should skip duplicate nodes at the same position', () => {
      const rect1 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect1.classList.add('actor');
      rect1.setAttribute('x', '10');
      rect1.setAttribute('y', '20');
      rect1.setAttribute('width', '100');
      rect1.setAttribute('height', '50');

      const rect2 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect2.classList.add('actor');
      rect2.setAttribute('x', '10');
      rect2.setAttribute('y', '20');
      rect2.setAttribute('width', '100');
      rect2.setAttribute('height', '50');

      svgElement.appendChild(rect1);
      svgElement.appendChild(rect2);

      const nodes = parseSequenceNodes(svgElement);

      expect(nodes.length).toBe(1);
    });

    it('should skip elements with invalid dimensions', () => {
      const rect1 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect1.classList.add('actor');
      rect1.setAttribute('x', '10');
      rect1.setAttribute('y', '20');
      rect1.setAttribute('width', '0');
      rect1.setAttribute('height', '50');

      const rect2 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect2.classList.add('note');
      rect2.setAttribute('x', '10');
      rect2.setAttribute('y', '20');
      rect2.setAttribute('width', '100');
      rect2.setAttribute('height', '-10');

      svgElement.appendChild(rect1);
      svgElement.appendChild(rect2);

      const nodes = parseSequenceNodes(svgElement);

      expect(nodes.length).toBe(0);
    });

    it('should return empty array for empty SVG', () => {
      const nodes = parseSequenceNodes(svgElement);

      expect(nodes).toEqual([]);
    });

    it('should handle missing attributes gracefully', () => {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.classList.add('actor');
      rect.setAttribute('width', '100');
      rect.setAttribute('height', '50');

      svgElement.appendChild(rect);

      const nodes = parseSequenceNodes(svgElement);

      expect(nodes.length).toBe(1);
      expect(nodes[0].x).toBe(50);
      expect(nodes[0].y).toBe(25);
    });

    it('should apply transforms correctly', () => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', 'translate(100, 50)');

      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.classList.add('actor');
      rect.setAttribute('x', '10');
      rect.setAttribute('y', '20');
      rect.setAttribute('width', '100');
      rect.setAttribute('height', '50');

      g.appendChild(rect);
      svgElement.appendChild(g);

      const nodes = parseSequenceNodes(svgElement);

      expect(nodes.length).toBe(1);
      expect(nodes[0].x).toBe(160); // 100 + 10 + 100/2
      expect(nodes[0].y).toBe(95);  // 50 + 20 + 50/2
    });
  });

  describe('parseSequenceLoopFrames', () => {
    it('should parse loop frames with labels', () => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

      const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line1.classList.add('loopLine');
      line1.setAttribute('x1', '10');
      line1.setAttribute('y1', '20');
      line1.setAttribute('x2', '200');
      line1.setAttribute('y2', '20');

      const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line2.classList.add('loopLine');
      line2.setAttribute('x1', '10');
      line2.setAttribute('y1', '100');
      line2.setAttribute('x2', '200');
      line2.setAttribute('y2', '100');

      const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      labelText.classList.add('labelText');
      labelText.setAttribute('x', '15');
      labelText.setAttribute('y', '30');
      labelText.textContent = 'loop';

      const loopText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      loopText.classList.add('loopText');
      loopText.setAttribute('x', '50');
      loopText.setAttribute('y', '35');
      loopText.textContent = '[condition]';

      g.appendChild(line1);
      g.appendChild(line2);
      g.appendChild(labelText);
      g.appendChild(loopText);
      svgElement.appendChild(g);

      const result = parseSequenceLoopFrames(svgElement);

      expect(result.nodes.length).toBe(1);
      expect(result.nodes[0]).toMatchObject({
        type: 'cluster',
        shape: 'rect',
        width: 190,
        height: 80,
        color: 'rgba(236,236,255,0.15)',
        stroke: '#9370DB',
      });

      expect(result.labels.length).toBe(2);
      expect(result.labels[0]).toMatchObject({
        text: 'loop',
        fontSize: 12,
        bold: true,
        color: '#5b21b6',
      });
      expect(result.labels[1]).toMatchObject({
        text: '[condition]',
        fontSize: 13,
        bold: false,
        color: '#374151',
      });
    });

    it('should handle loop frames without labels', () => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

      const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line1.classList.add('loopLine');
      line1.setAttribute('x1', '10');
      line1.setAttribute('y1', '20');
      line1.setAttribute('x2', '200');
      line1.setAttribute('y2', '20');

      const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line2.classList.add('loopLine');
      line2.setAttribute('x1', '10');
      line2.setAttribute('y1', '100');
      line2.setAttribute('x2', '200');
      line2.setAttribute('y2', '100');

      g.appendChild(line1);
      g.appendChild(line2);
      svgElement.appendChild(g);

      const result = parseSequenceLoopFrames(svgElement);

      expect(result.nodes.length).toBe(1);
      expect(result.labels.length).toBe(0);
    });

    it('should skip frames with less than 2 loop lines', () => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

      const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line1.classList.add('loopLine');
      line1.setAttribute('x1', '10');
      line1.setAttribute('y1', '20');
      line1.setAttribute('x2', '200');
      line1.setAttribute('y2', '20');

      g.appendChild(line1);
      svgElement.appendChild(g);

      const result = parseSequenceLoopFrames(svgElement);

      expect(result.nodes.length).toBe(0);
      expect(result.labels.length).toBe(0);
    });

    it('should skip frames with invalid dimensions', () => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

      const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line1.classList.add('loopLine');
      line1.setAttribute('x1', '10');
      line1.setAttribute('y1', '20');
      line1.setAttribute('x2', '10');
      line1.setAttribute('y2', '20');

      const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line2.classList.add('loopLine');
      line2.setAttribute('x1', '10');
      line2.setAttribute('y1', '20');
      line2.setAttribute('x2', '10');
      line2.setAttribute('y2', '20');

      g.appendChild(line1);
      g.appendChild(line2);
      svgElement.appendChild(g);

      const result = parseSequenceLoopFrames(svgElement);

      expect(result.nodes.length).toBe(0);
    });

    it('should return empty arrays for empty SVG', () => {
      const result = parseSequenceLoopFrames(svgElement);

      expect(result.nodes).toEqual([]);
      expect(result.labels).toEqual([]);
    });

    it('should handle loopText with tspan elements', () => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

      const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line1.classList.add('loopLine');
      line1.setAttribute('x1', '10');
      line1.setAttribute('y1', '20');
      line1.setAttribute('x2', '200');
      line1.setAttribute('y2', '20');

      const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line2.classList.add('loopLine');
      line2.setAttribute('x1', '10');
      line2.setAttribute('y1', '100');
      line2.setAttribute('x2', '200');
      line2.setAttribute('y2', '100');

      const loopText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      loopText.classList.add('loopText');
      loopText.setAttribute('x', '50');
      loopText.setAttribute('y', '35');

      const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
      tspan.textContent = 'tspan text';

      loopText.appendChild(tspan);
      g.appendChild(line1);
      g.appendChild(line2);
      g.appendChild(loopText);
      svgElement.appendChild(g);

      const result = parseSequenceLoopFrames(svgElement);

      expect(result.labels.length).toBe(1);
      expect(result.labels[0].text).toBe('tspan text');
    });
  });

  describe('parseSequenceMessageLabels', () => {
    it('should parse message text labels', () => {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.classList.add('messageText');
      text.setAttribute('x', '100');
      text.setAttribute('y', '50');
      text.textContent = 'Hello World';

      svgElement.appendChild(text);

      const labels = parseSequenceMessageLabels(svgElement);

      expect(labels.length).toBe(1);
      expect(labels[0]).toMatchObject({
        x: 100,
        y: 50,
        text: 'Hello World',
        fontSize: 13,
        bold: false,
        color: '#333',
        align: 'center',
      });
    });

    it('should apply dy attribute to y position', () => {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.classList.add('messageText');
      text.setAttribute('x', '100');
      text.setAttribute('y', '50');
      text.setAttribute('dy', '10');
      text.textContent = 'Message';

      svgElement.appendChild(text);

      const labels = parseSequenceMessageLabels(svgElement);

      expect(labels.length).toBe(1);
      expect(labels[0].y).toBe(60); // 50 + 10
    });

    it('should skip labels with empty text', () => {
      const text1 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text1.classList.add('messageText');
      text1.setAttribute('x', '100');
      text1.setAttribute('y', '50');
      text1.textContent = '';

      const text2 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text2.classList.add('messageText');
      text2.setAttribute('x', '200');
      text2.setAttribute('y', '100');
      text2.textContent = '   ';

      svgElement.appendChild(text1);
      svgElement.appendChild(text2);

      const labels = parseSequenceMessageLabels(svgElement);

      expect(labels.length).toBe(0);
    });

    it('should handle missing attributes', () => {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.classList.add('messageText');
      text.textContent = 'No attributes';

      svgElement.appendChild(text);

      const labels = parseSequenceMessageLabels(svgElement);

      expect(labels.length).toBe(1);
      expect(labels[0].x).toBe(0);
      expect(labels[0].y).toBe(0);
    });

    it('should return empty array for empty SVG', () => {
      const labels = parseSequenceMessageLabels(svgElement);

      expect(labels).toEqual([]);
    });

    it('should apply transforms correctly', () => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', 'translate(50, 25)');

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.classList.add('messageText');
      text.setAttribute('x', '100');
      text.setAttribute('y', '50');
      text.textContent = 'Transformed';

      g.appendChild(text);
      svgElement.appendChild(g);

      const labels = parseSequenceMessageLabels(svgElement);

      expect(labels.length).toBe(1);
      expect(labels[0].x).toBe(150); // 50 + 100
      expect(labels[0].y).toBe(75);  // 25 + 50
    });
  });

  describe('parseSequenceEdges', () => {
    it('should parse line elements as links', () => {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.classList.add('messageLine0');
      line.setAttribute('x1', '10');
      line.setAttribute('y1', '20');
      line.setAttribute('x2', '100');
      line.setAttribute('y2', '50');

      svgElement.appendChild(line);

      const edges = parseSequenceEdges(svgElement, false);

      expect(edges.length).toBe(1);
      expect(edges[0]).toMatchObject({
        pathD: 'M 10 20 L 100 50',
        stroke: '#333',
        type: 'link',
        hasArrow: true,
      });
    });

    it('should parse path elements as links', () => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.classList.add('messageLine0');
      path.setAttribute('d', 'M 10 20 L 100 50');

      svgElement.appendChild(path);

      const edges = parseSequenceEdges(svgElement, false);

      expect(edges.length).toBe(1);
      expect(edges[0].pathD).toBe('M 10 20 L 100 50');
    });

    it('should use premium stroke color when isPremium is true', () => {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.classList.add('messageLine0');
      line.setAttribute('x1', '10');
      line.setAttribute('y1', '20');
      line.setAttribute('x2', '100');
      line.setAttribute('y2', '50');

      svgElement.appendChild(line);

      const edges = parseSequenceEdges(svgElement, true);

      expect(edges.length).toBe(1);
      expect(edges[0].stroke).toBe('#94a3b8');
    });

    it('should parse dashed lines', () => {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.classList.add('messageLine1');
      line.setAttribute('x1', '10');
      line.setAttribute('y1', '20');
      line.setAttribute('x2', '100');
      line.setAttribute('y2', '50');
      line.style.strokeDasharray = '5, 3';

      svgElement.appendChild(line);

      const edges = parseSequenceEdges(svgElement, false);

      expect(edges.length).toBe(1);
      expect(edges[0].dash).toEqual([5, 3]);
    });

    it('should detect arrows from marker-end attribute', () => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.classList.add('flowchart-link');
      path.setAttribute('d', 'M 10 20 L 100 50');
      path.setAttribute('marker-end', 'url(#arrowhead)');

      svgElement.appendChild(path);

      const edges = parseSequenceEdges(svgElement, false);

      expect(edges.length).toBe(1);
      expect(edges[0].hasArrow).toBe(true);
    });

    it('should parse structural lines', () => {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.classList.add('actor-line');
      line.setAttribute('x1', '50');
      line.setAttribute('y1', '10');
      line.setAttribute('x2', '50');
      line.setAttribute('y2', '200');

      svgElement.appendChild(line);

      const edges = parseSequenceEdges(svgElement, false);

      expect(edges.length).toBe(1);
      expect(edges[0].type).toBe('structural');
    });

    it('should skip loop lines', () => {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.classList.add('loopLine');
      line.setAttribute('x1', '10');
      line.setAttribute('y1', '20');
      line.setAttribute('x2', '100');
      line.setAttribute('y2', '20');

      svgElement.appendChild(line);

      const edges = parseSequenceEdges(svgElement, false);

      expect(edges.length).toBe(0);
    });

    it('should skip short path strings', () => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.classList.add('messageLine0');
      path.setAttribute('d', 'M 0 0');

      svgElement.appendChild(path);

      const edges = parseSequenceEdges(svgElement, false);

      expect(edges.length).toBe(0);
    });

    it('should detect vertical lines as structural', () => {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', '50');
      line.setAttribute('y1', '10');
      line.setAttribute('x2', '50');
      line.setAttribute('y2', '200');

      svgElement.appendChild(line);

      const edges = parseSequenceEdges(svgElement, false);

      expect(edges.length).toBe(1);
      expect(edges[0].type).toBe('structural');
    });

    it('should skip duplicate edges', () => {
      const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line1.setAttribute('x1', '50');
      line1.setAttribute('y1', '10');
      line1.setAttribute('x2', '50');
      line1.setAttribute('y2', '200');

      const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line2.setAttribute('x1', '50');
      line2.setAttribute('y1', '10');
      line2.setAttribute('x2', '50');
      line2.setAttribute('y2', '200');

      svgElement.appendChild(line1);
      svgElement.appendChild(line2);

      const edges = parseSequenceEdges(svgElement, false);

      expect(edges.length).toBe(1);
    });

    it('should skip lines with sibling path elements', () => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.classList.add('messageLine0');
      line.setAttribute('x1', '10');
      line.setAttribute('y1', '20');
      line.setAttribute('x2', '100');
      line.setAttribute('y2', '50');

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.classList.add('messageLine0');
      path.setAttribute('d', 'M 10 20 L 100 50');

      g.appendChild(line);
      g.appendChild(path);
      svgElement.appendChild(g);

      const edges = parseSequenceEdges(svgElement, false);

      expect(edges.length).toBe(1);
      expect(edges[0].pathD).toBe('M 10 20 L 100 50');
    });

    it('should return empty array for empty SVG', () => {
      const edges = parseSequenceEdges(svgElement, false);

      expect(edges).toEqual([]);
    });

    it('should handle strokeDasharray none', () => {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.classList.add('messageLine0');
      line.setAttribute('x1', '10');
      line.setAttribute('y1', '20');
      line.setAttribute('x2', '100');
      line.setAttribute('y2', '50');
      line.style.strokeDasharray = 'none';

      svgElement.appendChild(line);

      const edges = parseSequenceEdges(svgElement, false);

      expect(edges.length).toBe(1);
      expect(edges[0].dash).toBeUndefined();
    });

    it('should apply transforms to line elements', () => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', 'translate(100, 50)');

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.classList.add('messageLine0');
      line.setAttribute('x1', '10');
      line.setAttribute('y1', '20');
      line.setAttribute('x2', '90');
      line.setAttribute('y2', '40');

      g.appendChild(line);
      svgElement.appendChild(g);

      const edges = parseSequenceEdges(svgElement, false);

      expect(edges.length).toBe(1);
      expect(edges[0].pathD).toBe('M 110 70 L 190 90');
    });
  });
});
