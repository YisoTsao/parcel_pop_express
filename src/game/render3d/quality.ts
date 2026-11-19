import type { Quality } from '../../shared/storage';

export interface QualityProfile {
  dpr: [number, number];
  shadowMap: number; // 0 = no shadow map
  contactShadows: boolean; // drei ContactShadows (soft, short-range)
  particlesPerBatch: number;
  antialias: boolean;
}

/** TECH_ARCHITECTURE §7 table. */
export const QUALITY: Record<Quality, QualityProfile> = {
  low: { dpr: [1, 1], shadowMap: 0, contactShadows: false, particlesPerBatch: 12, antialias: false },
  medium: { dpr: [1, 1.5], shadowMap: 0, contactShadows: true, particlesPerBatch: 32, antialias: true },
  high: { dpr: [1, 2], shadowMap: 2048, contactShadows: false, particlesPerBatch: 64, antialias: true },
};
