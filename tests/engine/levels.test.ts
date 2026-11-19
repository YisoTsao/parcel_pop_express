import { describe, expect, it } from 'vitest';
import raw from '../../src/game/data/levels.v2.json';
import { LEVELS } from '../../src/game/data/levels';
import { loadLevelFile, replay, solve, validateLevel, validateLevelFile, type LevelDefinition } from '../../src/game/engine';
import { level, STABLE } from './helpers';

describe('E17 bundled 30 levels', () => {
  it('file passes schema, stable-board and witness validation', () => {
    expect(validateLevelFile(raw)).toEqual([]);
  });
  it('has 30 unique levels in order; columns unlock from level 6', () => {
    expect(LEVELS.map((l) => l.id)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    expect(LEVELS.filter((l) => !l.allowColumnMoves).map((l) => l.id)).toEqual([1, 2, 3, 4, 5]);
  });
  it('introduces crates from level 11 and ice from level 16', () => {
    const firstWith = (ch: RegExp) => LEVELS.find((l) => l.board.some((r) => ch.test(r)))!.id;
    expect(firstWith(/[12]/)).toBe(11);
    expect(firstWith(/[rbgy]/)).toBe(16);
  });
  it.each(LEVELS.map((l) => [l.id, l] as const))('level %i: witness wins deterministically within the move limit', (_id, l) => {
    const a = replay(l, l.witnessMoves);
    expect(a.state.status).toBe('won');
    expect(l.witnessMoves.length).toBeLessThanOrEqual(l.moveLimit);
    expect(JSON.stringify(replay(l, l.witnessMoves))).toBe(JSON.stringify(a));
  });
  it.each(LEVELS.filter((l) => l.id % 5 === 0).map((l) => [l.id, l] as const))('level %i cannot be won in 3 moves (exhaustive)', (_id, l) => {
    expect(solve({ ...l, moveLimit: 3 }, { maxNodes: 400_000, maxMs: 60_000 }).status).toBe('unsolvable');
  });
});

describe('E14/E15 loader rejects bad data', () => {
  const ok = level(STABLE);
  const f = (l: object) => validateLevel(l, { checkWitness: false }).map((i) => i.field);
  it('E14 initial match is rejected', () => {
    expect(f({ ...ok, board: ['RRRYGB', ...STABLE.slice(1)] })).toContain('board');
  });
  it('E15 zero seed and illegal tokens are rejected', () => {
    expect(f({ ...ok, seed: 0 })).toContain('seed');
    expect(f({ ...ok, board: ['RBGYRX', ...STABLE.slice(1)] })).toContain('board[0]');
    expect(f({ ...ok, board: ['RBGYR3', ...STABLE.slice(1)] })).toContain('board[0]');
  });
  it('rejects impossible obstacle objectives and duplicates', () => {
    expect(f({ ...ok, objectives: [{ type: 'clearCrates', count: 1 }] })).toContain('objectives[0].count');
    expect(f({ ...ok, objectives: [{ type: 'breakIce', count: 1 }] })).toContain('objectives[0].count');
    expect(f({ ...ok, board: ['1BGYRB', ...STABLE.slice(1)], objectives: [{ type: 'clearCrates', count: 1 }] })).toEqual([]);
    expect(f({ ...ok, objectives: [ok.objectives[0], ok.objectives[0]] })).toContain('objectives[1]');
    expect(f({ ...ok, objectives: [{ type: 'score', count: 3 }] })).toContain('objectives[0]');
  });
  it('rejects a column witness on a row-only level, and a non-winning witness', () => {
    expect(f({ ...ok, allowColumnMoves: false, witnessMoves: [{ line: 'col', index: 0, direction: 'up' }] })).toContain('witnessMoves[0]');
    const l: LevelDefinition = { ...ok, witnessMoves: [{ line: 'row', index: 0, direction: 'left' }] };
    expect(validateLevel(l).map((i) => i.field)).toContain('witnessMoves');
  });
  it('rejects unknown ruleVersion', () => {
    expect(() => loadLevelFile({ ...(raw as object), ruleVersion: '1.0.0' })).toThrow(/ruleVersion/);
  });
});

describe('solver', () => {
  it('returns unknown (never unsolvable) when the node limit is hit', () => {
    const l = level(STABLE, { moveLimit: 10, objectives: [{ type: 'collectColor', color: 'R', count: 99 }] });
    expect(solve(l, { maxNodes: 50 }).status).toBe('unknown');
  });
  it('returns unsolvable only after exhaustive search', () => {
    const l = level(STABLE, { moveLimit: 1, allowColumnMoves: false, objectives: [{ type: 'collectColor', color: 'R', count: 99 }] });
    expect(solve(l).status).toBe('unsolvable');
  });
});
