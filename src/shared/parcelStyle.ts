/** Single source for parcel colours + stamp symbols, shared by the 3D textures and DOM HUD icons. */
import type { Color } from '../game/engine';

export const PARCEL_HEX: Record<Color, string> = {
  R: '#EF7279',
  B: '#65B8E9',
  G: '#72CBB1',
  Y: '#F1C66C',
};

/** Darker tint used for symbol outlines so white stamps stay readable (esp. on yellow). */
export const PARCEL_INK: Record<Color, string> = {
  R: '#B8434C',
  B: '#2E7FB3',
  G: '#2F8F74',
  Y: '#B7862A',
};

export const PARCEL_NAME: Record<Color, string> = {
  R: '紅色郵票箱',
  B: '藍色水滴箱',
  G: '綠色葉片箱',
  Y: '黃色星星箱',
};

/** viewBox 0 0 100 100. `fill` is the white stamp; `detail` is stroked with the ink colour. */
export const PARCEL_SYMBOL: Record<Color, { fill: string; detail?: string }> = {
  // envelope / stamp
  R: { fill: 'M16 28 Q16 22 22 22 H78 Q84 22 84 28 V72 Q84 78 78 78 H22 Q16 78 16 72 Z', detail: 'M20 28 L50 54 L80 28' },
  // water drop
  B: { fill: 'M50 10 C50 10 22 44 22 62 A28 28 0 0 0 78 62 C78 44 50 10 50 10 Z', detail: 'M38 64 A13 13 0 0 0 50 76' },
  // leaf
  G: { fill: 'M18 84 C12 46 40 16 86 14 C88 58 60 88 18 84 Z', detail: 'M24 78 C40 60 54 46 72 30' },
  // star
  Y: { fill: 'M50 8 L61.8 35.5 L91.6 38.2 L69 57.9 L75.7 87.1 L50 71.8 L24.3 87.1 L31 57.9 L8.4 38.2 L38.2 35.5 Z' },
};
