import raw from './levels.v1.json';
import { loadLevelFile, type LevelDefinition } from '../engine';

/** Validated at import time; an invalid file fails loudly instead of silently playing. */
export const LEVEL_FILE = loadLevelFile(raw);
export const LEVELS: LevelDefinition[] = [...LEVEL_FILE.levels].sort((a, b) => a.id - b.id);

export function getLevel(id: number): LevelDefinition | undefined {
  return LEVELS.find((l) => l.id === id);
}
