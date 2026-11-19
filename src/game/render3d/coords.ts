import { BOARD_SIZE } from '../engine';

/** One world unit per cell, board centred on the origin (TECH_ARCHITECTURE §4). */
export const CELL = 1;
export const HALF = (BOARD_SIZE - 1) / 2; // 2.5
export const PARCEL_W = 0.86;
export const PARCEL_H = 0.5;
export const PARCEL_Y = PARCEL_H / 2;

export function boardToWorld(r: number, c: number): { x: number; z: number } {
  return { x: (c - HALF) * CELL, z: (r - HALF) * CELL };
}

/** Inverse mapping used by raycast row picking. Returns null outside the board. */
export function worldToCell(x: number, z: number): { r: number; c: number } | null {
  const c = Math.round(x / CELL + HALF) | 0;
  const r = Math.round(z / CELL + HALF) | 0;
  if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return null;
  if (Math.abs(x) > (HALF + 0.5) * CELL || Math.abs(z) > (HALF + 0.5) * CELL) return null;
  return { r: r + 0, c: c + 0 };
}
