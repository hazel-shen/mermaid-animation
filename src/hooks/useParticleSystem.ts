import { useState, useEffect } from 'react';
import type { DiagramEdge } from '../types';
import { Particle } from '../utils/particle';

export const useParticleSystem = (edges: DiagramEdge[]): Particle[] => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const newParticles: Particle[] = [];
    edges.forEach(edge => {
      if (edge.type === 'link') {
        const count = Math.max(1, Math.floor(edge.pathD.length / 150)) + 1;
        for (let i = 0; i < count; i++) {
          newParticles.push(new Particle(edge.pathD));
        }
      }
    });
    setParticles(newParticles);
  }, [edges]);

  return particles;
};
