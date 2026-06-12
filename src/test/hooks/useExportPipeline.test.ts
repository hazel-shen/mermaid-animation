import { describe, it, expect } from 'vitest';
import { computeExportFrame } from '../../hooks/useExportPipeline';

describe('computeExportFrame', () => {
  it('sizes the output canvas to the diagram plus padding on each side', () => {
    const frame = computeExportFrame({ w: 800, h: 600 });
    expect(frame.OUT_W).toBe(880);
    expect(frame.OUT_H).toBe(680);
  });

  it('doubles the supersampled canvas by default (SS=2)', () => {
    const frame = computeExportFrame({ w: 800, h: 600 });
    expect(frame.SS_W).toBe(1760);
    expect(frame.SS_H).toBe(1360);
    expect(frame.ssTr).toEqual({ x: 80, y: 80, scale: 2 });
  });

  it('respects custom padding and supersampling factor', () => {
    const frame = computeExportFrame({ w: 100, h: 100 }, 10, 3);
    expect(frame.OUT_W).toBe(120);
    expect(frame.SS_W).toBe(360);
    expect(frame.ssTr).toEqual({ x: 30, y: 30, scale: 3 });
  });

  it('uses SS=1 for preview renders without scaling the transform', () => {
    const frame = computeExportFrame({ w: 640, h: 480 }, 40, 1);
    expect(frame.SS_W).toBe(frame.OUT_W);
    expect(frame.ssTr).toEqual({ x: 40, y: 40, scale: 1 });
  });

  it('falls back to 1920×1080 when the diagram size is not known yet', () => {
    const frame = computeExportFrame({ w: 0, h: 0 });
    expect(frame.OUT_W).toBe(1920);
    expect(frame.OUT_H).toBe(1080);
    expect(frame.SS_W).toBe(3840);
  });

  it('rounds fractional diagram sizes to whole pixels', () => {
    const frame = computeExportFrame({ w: 100.4, h: 99.6 });
    expect(frame.OUT_W).toBe(180);
    expect(frame.OUT_H).toBe(180);
  });
});
