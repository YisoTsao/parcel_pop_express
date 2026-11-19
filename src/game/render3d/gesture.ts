/** Swipe decision (UI_UX_SPEC §2 + TECH_ARCHITECTURE §4). Pure, unit-tested. */
export const SWIPE_THRESHOLD_PX = 28;
export const SWIPE_DOMINANCE = 1.3;

export type SwipeDir = 'left' | 'right' | 'up' | 'down';

/** One cell at most, whatever the distance. Vertical swipes only count when columns are allowed. */
export function decideSwipe(dx: number, dy: number, allowColumns: boolean): SwipeDir | null {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax >= SWIPE_THRESHOLD_PX && ax > ay * SWIPE_DOMINANCE) return dx < 0 ? 'left' : 'right';
  if (allowColumns && ay >= SWIPE_THRESHOLD_PX && ay > ax * SWIPE_DOMINANCE) return dy < 0 ? 'up' : 'down';
  return null;
}

/** Visual drag preview offset in world units: follows the finger, then rubber-bands past ~0.45. */
export function previewOffset(dWorld: number): number {
  const limit = 0.45;
  const a = Math.abs(dWorld);
  const v = a <= limit ? a : limit + (1 - 1 / (1 + (a - limit) * 2)) * 0.15;
  return Math.sign(dWorld) * v;
}
