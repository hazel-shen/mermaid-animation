import { describe, it, expect } from 'vitest';
import { applyParticleSettingsPatch, DEFAULT_PARTICLE_SETTINGS } from '../../utils/particleSettings';

describe('applyParticleSettingsPatch', () => {
  it('merges a simple patch without touching other fields', () => {
    const next = applyParticleSettingsPatch(DEFAULT_PARTICLE_SETTINGS, { speed: 2.5 });
    expect(next).toEqual({ ...DEFAULT_PARTICLE_SETTINGS, speed: 2.5 });
  });

  it('does not mutate the previous settings object', () => {
    const prev = { ...DEFAULT_PARTICLE_SETTINGS };
    applyParticleSettingsPatch(prev, { size: 8 });
    expect(prev).toEqual(DEFAULT_PARTICLE_SETTINGS);
  });

  it('resets color to the dark default when switching to dark background', () => {
    const prev = { ...DEFAULT_PARTICLE_SETTINGS, color: '#ff0000' };
    const next = applyParticleSettingsPatch(prev, { bgMode: 'dark' });
    expect(next.bgMode).toBe('dark');
    expect(next.color).toBe('#a5b4fc');
  });

  it('resets color to the light default when switching to grid or white background', () => {
    const prev = { ...DEFAULT_PARTICLE_SETTINGS, bgMode: 'dark' as const, color: '#a5b4fc' };
    expect(applyParticleSettingsPatch(prev, { bgMode: 'grid' }).color).toBe('#2ea4ff');
    expect(applyParticleSettingsPatch(prev, { bgMode: 'white' }).color).toBe('#2ea4ff');
  });

  it('lets an explicit color in the same patch win over the bgMode reset', () => {
    const next = applyParticleSettingsPatch(DEFAULT_PARTICLE_SETTINGS, { bgMode: 'dark', color: '#123456' });
    expect(next.color).toBe('#123456');
  });

  it('keeps a custom color when the patch does not change bgMode', () => {
    const prev = { ...DEFAULT_PARTICLE_SETTINGS, color: '#ff0000' };
    expect(applyParticleSettingsPatch(prev, { shape: 'star' }).color).toBe('#ff0000');
  });
});
