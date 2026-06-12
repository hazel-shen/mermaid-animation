import type { ParticleSettings } from '../types';

export const DEFAULT_PARTICLE_SETTINGS: ParticleSettings = {
  speed: 1,
  color: '#2ea4ff',
  size: 3,
  shape: 'circle',
  bgMode: 'grid',
};

/**
 * Merges a settings patch, with one coupling rule: switching the canvas
 * background mode resets the particle color to that mode's default (light
 * blue on light backgrounds, indigo on dark) unless the same patch also
 * sets a color explicitly.
 */
export const applyParticleSettingsPatch = (
  prev: ParticleSettings,
  patch: Partial<ParticleSettings>
): ParticleSettings => {
  const next = { ...prev, ...patch };
  if (patch.bgMode !== undefined && patch.color === undefined) {
    next.color = patch.bgMode === 'dark' ? '#a5b4fc' : '#2ea4ff';
  }
  return next;
};
