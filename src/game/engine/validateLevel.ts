import { countTiles, parseToken } from './board';
import { findMatches } from './findMatches';
import { isValidSeed } from './rng';
import { isValidMove, replay } from './applyMove';
import { objectiveKey } from './objectives';
import { COLORS, RULE_VERSION, type LevelDefinition, type LevelFile, type StableBoard } from './types';

export interface LevelIssue {
  levelId: number | null;
  field: string;
  message: string;
}

export const MAX_LEVELS = 99;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Structural + rule validation of one level (LEVEL_DATA_SPEC v2, GAME_RULES §8). */
export function validateLevel(raw: unknown, opts: { checkWitness?: boolean } = {}): LevelIssue[] {
  const issues: LevelIssue[] = [];
  if (!isObj(raw)) return [{ levelId: null, field: '(root)', message: 'level must be an object' }];
  const id = typeof raw.id === 'number' ? raw.id : null;
  const bad = (field: string, message: string) => issues.push({ levelId: id, field, message });

  if (!(typeof raw.id === 'number' && Number.isInteger(raw.id) && raw.id >= 1 && raw.id <= MAX_LEVELS)) bad('id', `must be integer 1–${MAX_LEVELS}`);
  if (!(typeof raw.name === 'string' && raw.name.length >= 1 && raw.name.length <= 40)) bad('name', 'must be 1–40 chars');
  if (raw.width !== 6) bad('width', 'must be 6');
  if (raw.height !== 6) bad('height', 'must be 6');
  if (!(typeof raw.moveLimit === 'number' && Number.isInteger(raw.moveLimit) && raw.moveLimit >= 1 && raw.moveLimit <= 99)) bad('moveLimit', 'must be integer 1–99');
  if (!isValidSeed(raw.seed)) bad('seed', 'must be integer 1..4294967295');
  if (typeof raw.allowColumnMoves !== 'boolean') bad('allowColumnMoves', 'must be boolean');

  let grid: StableBoard | null = null;
  if (!Array.isArray(raw.board) || raw.board.length !== 6) bad('board', 'must have 6 rows');
  else {
    let ok = true;
    raw.board.forEach((row, r) => {
      if (typeof row !== 'string' || row.length !== 6) {
        bad(`board[${r}]`, 'must be a 6-char string');
        ok = false;
      } else if (![...row].every((ch) => parseToken(ch))) {
        bad(`board[${r}]`, 'only R/B/G/Y, r/b/g/y (frozen), 1/2 (tape crate) allowed');
        ok = false;
      }
    });
    if (ok) {
      grid = (raw.board as string[]).map((s) => [...s].map((ch) => parseToken(ch)!));
      const m = findMatches(grid);
      if (m.length > 0) bad('board', `initial board has ${m.length} matched cells (must be stable)`);
    }
  }

  if (!Array.isArray(raw.objectives) || raw.objectives.length < 1 || raw.objectives.length > 3) bad('objectives', 'must have 1–3 objectives');
  else {
    const seen = new Set<string>();
    raw.objectives.forEach((o, i) => {
      if (!isObj(o)) return bad(`objectives[${i}]`, 'must be an object');
      if (!(typeof o.count === 'number' && Number.isInteger(o.count) && o.count > 0)) bad(`objectives[${i}].count`, 'must be positive integer');
      if (o.type === 'collectColor') {
        if (!(COLORS as readonly unknown[]).includes(o.color)) bad(`objectives[${i}].color`, 'invalid colour');
      } else if (o.type === 'clearCrates') {
        if (grid && typeof o.count === 'number' && o.count > countTiles(grid, (t) => t.kind === 'crate'))
          bad(`objectives[${i}].count`, 'more crates required than exist on the board');
      } else if (o.type === 'breakIce') {
        if (grid && typeof o.count === 'number' && o.count > countTiles(grid, (t) => t.kind === 'parcel' && !!t.ice))
          bad(`objectives[${i}].count`, 'more ice required than exists on the board');
      } else return bad(`objectives[${i}]`, 'type must be collectColor | clearCrates | breakIce');
      const k = objectiveKey(o as never);
      if (seen.has(k)) bad(`objectives[${i}]`, 'duplicate objective');
      seen.add(k);
    });
  }

  if (!Array.isArray(raw.witnessMoves)) bad('witnessMoves', 'must be an array');
  else {
    raw.witnessMoves.forEach((m, i) => {
      if (!isValidMove(m, raw.allowColumnMoves === true)) bad(`witnessMoves[${i}]`, 'invalid move for this level');
    });
    if (typeof raw.moveLimit === 'number' && raw.witnessMoves.length > raw.moveLimit) bad('witnessMoves', 'longer than moveLimit');
  }

  if (issues.length === 0 && opts.checkWitness !== false) {
    const level = raw as unknown as LevelDefinition;
    try {
      const a = replay(level, level.witnessMoves);
      if (a.state.status !== 'won') bad('witnessMoves', `witness replay ended with status=${a.state.status}`);
      const b = replay(level, level.witnessMoves);
      if (JSON.stringify(a) !== JSON.stringify(b)) bad('witnessMoves', 'replay is not deterministic');
    } catch (e) {
      bad('witnessMoves', `engine error during replay: ${(e as Error).message}`);
    }
  }
  return issues;
}

export function validateLevelFile(raw: unknown, opts: { checkWitness?: boolean } = {}): LevelIssue[] {
  if (!isObj(raw)) return [{ levelId: null, field: '(root)', message: 'file must be an object' }];
  const issues: LevelIssue[] = [];
  if (raw.ruleVersion !== RULE_VERSION) issues.push({ levelId: null, field: 'ruleVersion', message: `must be ${RULE_VERSION}` });
  if (!Array.isArray(raw.levels) || raw.levels.length === 0) {
    issues.push({ levelId: null, field: 'levels', message: 'must be a non-empty array' });
    return issues;
  }
  const ids = new Set<unknown>();
  for (const l of raw.levels) {
    if (isObj(l)) {
      if (ids.has(l.id)) issues.push({ levelId: Number(l.id), field: 'id', message: 'duplicate id' });
      ids.add(l.id);
    }
    issues.push(...validateLevel(l, opts));
  }
  return issues;
}

/** App loader: rejects the file if anything structural is invalid. */
export function loadLevelFile(raw: unknown): LevelFile {
  const issues = validateLevelFile(raw, { checkWitness: false });
  if (issues.length > 0) throw new Error('Invalid level data:\n' + issues.map((i) => `  [L${i.levelId ?? '-'}] ${i.field}: ${i.message}`).join('\n'));
  return raw as LevelFile;
}
