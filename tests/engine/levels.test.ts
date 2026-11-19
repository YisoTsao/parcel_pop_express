import { describe, expect, it } from 'vitest';
import raw from '../../src/game/data/levels.v1.json';
import { LEVELS } from '../../src/game/data/levels';
import { loadLevelFile, replay, solve, validateLevel, validateLevelFile, type LevelDefinition } from '../../src/game/engine';
import { level, STABLE } from './helpers';

describe('E17 bundled levels', () => {
  it('file passes schema, stable-board and witness validation', () => {
    expect(validateLevelFile(raw)).toEqual([]);
  });
  it('has 10 unique levels in order', () => {
    expect(LEVELS.map((l) => l.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
  it.each(LEVELS.map((l) => [l.id, l] as const))('level %i witness replays to won, deterministically', (_id, l) => {
    const a = replay(l, l.witnessMoves);
    const b = replay(l, l.witnessMoves);
    expect(a.state.status).toBe('won');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it.each(LEVELS.map((l) => [l.id, l] as const))('level %i is solvable by BFS on the real engine', (_id, l) => {
    const r = solve(l, { maxNodes: 50_000 });
    expect(r.status).toBe('solvable');
  });
});

describe('E14/E15 loader rejects bad data', () => {
  const ok = level(STABLE);
  it('E14 initial match is rejected', () => {
    const bad = { ...ok, board: ['RRRYGB', ...STABLE.slice(1)] };
    expect(validateLevel(bad, { checkWitness: false }).map((i) => i.field)).toContain('board');
  });
  it('E15 zero seed and illegal colours are rejected', () => {
    expect(validateLevel({ ...ok, seed: 0 }, { checkWitness: false }).map((i) => i.field)).toContain('seed');
    expect(validateLevel({ ...ok, seed: 2 ** 32 }, { checkWitness: false }).map((i) => i.field)).toContain('seed');
    const bad = { ...ok, board: ['RBGYRX', ...STABLE.slice(1)] };
    expect(validateLevel(bad, { checkWitness: false }).map((i) => i.field)).toContain('board[0]');
  });
  it('rejects wrong sizes, duplicate objectives, bad moveLimit', () => {
    const f = (l: object) => validateLevel(l, { checkWitness: false }).map((i) => i.field);
    expect(f({ ...ok, width: 7 })).toContain('width');
    expect(f({ ...ok, board: STABLE.slice(1) })).toContain('board');
    expect(f({ ...ok, moveLimit: 0 })).toContain('moveLimit');
    expect(f({ ...ok, objectives: [ok.objectives[0], ok.objectives[0]] })).toContain('objectives[1].color');
    expect(f({ ...ok, objectives: [{ type: 'score', count: 3 }] })).toContain('objectives[0]');
  });
  it('rejects a witness that does not win', () => {
    const l: LevelDefinition = { ...ok, witnessMoves: [{ row: 0, direction: 'left' }] };
    expect(validateLevel(l).map((i) => i.field)).toContain('witnessMoves');
  });
  it('rejects unknown ruleVersion', () => {
    expect(() => loadLevelFile({ ...(raw as object), ruleVersion: '2.0.0' })).toThrow(/ruleVersion/);
  });
});

describe('solver', () => {
  it('returns unknown (never unsolvable) when the node limit is hit', () => {
    const l = level(STABLE, { moveLimit: 10, objectives: [{ type: 'collectColor', color: 'R', count: 99 }] });
    const r = solve(l, { maxNodes: 50 });
    expect(r.status).toBe('unknown');
  });
  it('returns unsolvable only after exhaustive search', () => {
    const l = level(STABLE, { moveLimit: 1, objectives: [{ type: 'collectColor', color: 'R', count: 99 }] });
    expect(solve(l).status).toBe('unsolvable');
  });
});
