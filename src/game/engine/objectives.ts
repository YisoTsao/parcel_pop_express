import { COLORS, type ColorCount, type Objective, type ObjectiveProgress, type Progress } from './types';

export function emptyColorCount(): ColorCount {
  return { R: 0, B: 0, G: 0, Y: 0 };
}
export function emptyProgress(): Progress {
  return { collected: emptyColorCount(), cratesCleared: 0, iceBroken: 0 };
}
export function cloneProgress(p: Progress): Progress {
  return { collected: { ...p.collected }, cratesCleared: p.cratesCleared, iceBroken: p.iceBroken };
}
export function addCounts(a: ColorCount, b: ColorCount): ColorCount {
  const out = emptyColorCount();
  for (const k of COLORS) out[k] = a[k] + b[k];
  return out;
}

function have(o: Objective, p: Progress): number {
  switch (o.type) {
    case 'collectColor':
      return p.collected[o.color];
    case 'clearCrates':
      return p.cratesCleared;
    case 'breakIce':
      return p.iceBroken;
  }
}

export function objectiveProgress(objectives: Objective[], p: Progress): ObjectiveProgress[] {
  return objectives.map((o) => {
    const h = have(o, p);
    return { type: o.type, color: o.type === 'collectColor' ? o.color : undefined, target: o.count, current: Math.min(h, o.count), done: h >= o.count };
  });
}

/** AND of all objectives; over-collection is never subtracted. */
export function objectivesMet(objectives: Objective[], p: Progress): boolean {
  return objectives.every((o) => have(o, p) >= o.count);
}

export function objectiveKey(o: Objective): string {
  return o.type === 'collectColor' ? `collectColor:${o.color}` : o.type;
}
