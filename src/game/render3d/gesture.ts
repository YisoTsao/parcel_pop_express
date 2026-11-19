/** Swipe decision (UI_UX_SPEC §2 + TECH_ARCHITECTURE §4). Pure, unit-tested. */
export const SWIPE_THRESHOLD_PX = 28;
export const SWIPE_DOMINANCE = 1.3;

export function decideSwipe(dx: number, dy: number): 'left' | 'right' | null {
  if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return null;
  if (Math.abs(dx) <= Math.abs(dy) * SWIPE_DOMINANCE) return null;
  return dx < 0 ? 'left' : 'right';
}

/** Visual drag preview offset in world units: follows the finger, then rubber-bands past ~0.45. */
export function previewOffset(dxWorld: number): number {
  const limit = 0.45;
  const a = Math.abs(dxWorld);
  const v = a <= limit ? a : limit + (1 - 1 / (1 + (a - limit) * 2)) * 0.15;
  return Math.sign(dxWorld) * v;
}
