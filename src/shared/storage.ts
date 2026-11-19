/** localStorage persistence (TECH_ARCHITECTURE §9). Every access is guarded; bad data -> safe defaults. */
export type Quality = 'low' | 'medium' | 'high';

export interface SaveData {
  schemaVersion: 1;
  completedLevelIds: number[];
  lastLevelId: number;
  soundEnabled: boolean;
  reducedMotion: boolean;
  graphicsQuality: Quality;
}

/** Highest level id in the shipped level file (levels.v2.json). */
export const MAX_LEVEL_ID = 30;
const KEY = 'parcel-pop-express.save';

export function defaultQuality(): Quality {
  try {
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    return coarse ? 'medium' : 'high';
  } catch {
    return 'medium';
  }
}

export function prefersReducedMotion(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function defaultSave(): SaveData {
  return {
    schemaVersion: 1,
    completedLevelIds: [],
    lastLevelId: 1,
    soundEnabled: true,
    reducedMotion: prefersReducedMotion(),
    graphicsQuality: defaultQuality(),
  };
}

export function sanitize(raw: unknown): SaveData {
  const d = defaultSave();
  if (typeof raw !== 'object' || raw === null) return d;
  const o = raw as Record<string, unknown>;
  if (o.schemaVersion !== 1) return d;
  return {
    schemaVersion: 1,
    completedLevelIds: Array.isArray(o.completedLevelIds)
      ? [...new Set(o.completedLevelIds.filter((n): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= MAX_LEVEL_ID))]
      : d.completedLevelIds,
    lastLevelId: Number.isInteger(o.lastLevelId) && (o.lastLevelId as number) >= 1 && (o.lastLevelId as number) <= MAX_LEVEL_ID ? (o.lastLevelId as number) : 1,
    soundEnabled: typeof o.soundEnabled === 'boolean' ? o.soundEnabled : d.soundEnabled,
    reducedMotion: typeof o.reducedMotion === 'boolean' ? o.reducedMotion : d.reducedMotion,
    graphicsQuality: o.graphicsQuality === 'low' || o.graphicsQuality === 'medium' || o.graphicsQuality === 'high' ? o.graphicsQuality : d.graphicsQuality,
  };
}

export function loadSave(): SaveData {
  try {
    const s = localStorage.getItem(KEY);
    return s ? sanitize(JSON.parse(s)) : defaultSave();
  } catch {
    return defaultSave();
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable: play on without saving */
  }
}
