import { COLORS, type ColorCount, type Objective, type ObjectiveProgress } from './types';

export function emptyColorCount(): ColorCount {
  return { R: 0, B: 0, G: 0, Y: 0 };
}

export function objectiveProgress(objectives: Objective[], collected: ColorCount): ObjectiveProgress[] {
  return objectives.map((o) => {
    const have = collected[o.color];
    return { color: o.color, target: o.count, current: Math.min(have, o.count), done: have >= o.count };
  });
}

/** Multiple objectives are AND-ed (GAME_RULES §6). */
export function objectivesMet(objectives: Objective[], collected: ColorCount): boolean {
  return objectives.every((o) => collected[o.color] >= o.count);
}

export function addCounts(a: ColorCount, b: ColorCount): ColorCount {
  const out = emptyColorCount();
  for (const k of COLORS) out[k] = a[k] + b[k];
  return out;
}
