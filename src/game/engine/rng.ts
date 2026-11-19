import { COLORS, type Color } from './types';

/** True for a valid xorshift32 seed: integer in 1..2^32-1. */
export function isValidSeed(seed: unknown): seed is number {
  return typeof seed === 'number' && Number.isInteger(seed) && seed >= 1 && seed <= 0xffffffff;
}

/** One xorshift32 step. Input/Output are uint32. Never returns 0 for a non-zero input. */
export function xorshift32(state: number): number {
  let x = state >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}

/**
 * Draw one parcel colour. Per GAME_RULES §4: advance the state first,
 * then colorIndex = state % 4 mapped to [R,B,G,Y].
 */
export function nextColor(state: number): { state: number; color: Color } {
  const next = xorshift32(state);
  return { state: next, color: COLORS[next % 4] as Color };
}
