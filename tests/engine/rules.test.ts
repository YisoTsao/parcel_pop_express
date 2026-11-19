import { describe, expect, it } from 'vitest';
import {
  applyGravity,
  applyMove,
  boardToRows,
  createGameState,
  EngineError,
  findMatches,
  nextColor,
  refill,
  resolveBoard,
  shiftRow,
  shiftRowCells,
  xorshift32,
  type StableBoard,
} from '../../src/game/engine';
import { grid, level, STABLE, state } from './helpers';

describe('E01/E02 row cyclic shift', () => {
  it('E01 left: [R,B,G,Y,R,B] -> [B,G,Y,R,B,R]', () => {
    expect(shiftRowCells(['R', 'B', 'G', 'Y', 'R', 'B'], 'left')).toEqual(['B', 'G', 'Y', 'R', 'B', 'R']);
  });
  it('E02 right: last wraps to first', () => {
    expect(shiftRowCells(['A', 'B', 'C', 'D', 'E', 'F'], 'right')).toEqual(['F', 'A', 'B', 'C', 'D', 'E']);
  });
  it('shifts only the target row and does not mutate input', () => {
    const b = grid(STABLE);
    const snapshot = JSON.stringify(b);
    const out = shiftRow(b, 2, 'left');
    expect(JSON.stringify(b)).toBe(snapshot);
    expect(boardToRows(out)).toEqual(['RBGYRB', 'GYRBGY', 'BGYRBR', 'GYRBGY', 'RBGYRB', 'GYRBGY']);
  });
  it('six shifts in one direction return the original row', () => {
    let row = ['R', 'B', 'G', 'Y', 'R', 'B'];
    for (let i = 0; i < 6; i++) row = shiftRowCells(row, 'right');
    expect(row).toEqual(['R', 'B', 'G', 'Y', 'R', 'B']);
  });
});

describe('E03–E06 match detection', () => {
  it('E03 horizontal 3/4/5 runs are plain clears', () => {
    expect(findMatches(grid(['RRRBGY', '......', '......', '......', '......', '......']))).toHaveLength(3);
    expect(findMatches(grid(['RRRRGY', '......', '......', '......', '......', '......']))).toHaveLength(4);
    expect(findMatches(grid(['RRRRRY', '......', '......', '......', '......', '......']))).toHaveLength(5);
  });
  it('E03 a 4-run removes 4 parcels and creates no special parcel', () => {
    const b = grid(['YYYYGB', ...STABLE.slice(1)]) as StableBoard;
    const r = resolveBoard(b, 99, 1);
    expect(r.removed.Y).toBeGreaterThanOrEqual(4);
    expect(r.board.flat().every((c) => ['R', 'B', 'G', 'Y'].includes(c))).toBe(true);
  });
  it('E04 vertical 3-run', () => {
    const m = findMatches(grid(['G.....', 'G.....', 'G.....', 'B.....', '......', '......']));
    expect(m).toEqual([{ r: 0, c: 0 }, { r: 1, c: 0 }, { r: 2, c: 0 }]);
  });
  it('E05 L/T/cross overlap counts each cell once (5 not 6)', () => {
    const cross = grid(['.R....', 'RRR...', '.R....', '......', '......', '......']);
    expect(findMatches(cross)).toHaveLength(5);
    const t = grid(['RRR...', '.R....', '.R....', '......', '......', '......']);
    expect(findMatches(t)).toHaveLength(5);
  });
  it('E06 two separate groups are found in the same batch regardless of position', () => {
    const b = grid(['BBB...', '......', '......', '......', '.....G', '...GGG'].map((s) => s));
    const m = findMatches(b);
    expect(m).toHaveLength(6);
    // order-independence: mirrored board yields the mirrored set
    const mirrored = b.map((row) => row.slice().reverse());
    expect(findMatches(mirrored)).toHaveLength(6);
  });
  it('nulls never match', () => {
    expect(findMatches(grid(['...RGB', '......', '......', '......', '......', '......']))).toHaveLength(0);
  });
});

describe('E07/E08 gravity and refill', () => {
  it('E07 compresses each column keeping relative order', () => {
    const b = grid(['R.....', '.B....', 'G.....', '.Y....', 'B.....', '......']);
    b[1]![0] = null;
    const { board, falls } = applyGravity(b);
    expect(board.map((r) => r[0])).toEqual([null, null, null, 'R', 'G', 'B']);
    expect(board.map((r) => r[1])).toEqual([null, null, null, null, 'B', 'Y']);
    expect(falls).toContainEqual({ from: { r: 0, c: 0 }, to: { r: 3, c: 0 }, color: 'R' });
  });
  it('E08 refill order: c=0..5, then top->bottom inside each column, one xorshift32 draw each', () => {
    const b = grid(STABLE);
    b[0]![3] = null;
    b[1]![3] = null;
    b[0]![1] = null;
    const seed = 2463534242;
    const r = refill(b, seed);
    // expected draws: (0,1) first, then (0,3), then (1,3)
    let s = seed;
    const exp: string[] = [];
    for (let i = 0; i < 3; i++) {
      const d = nextColor(s);
      s = d.state;
      exp.push(d.color);
    }
    expect(r.spawns.map((x) => [x.position.r, x.position.c, x.color])).toEqual([
      [0, 1, exp[0]],
      [0, 3, exp[1]],
      [1, 3, exp[2]],
    ]);
    expect(r.rngState).toBe(s);
  });
});

describe('PRNG', () => {
  it('xorshift32 matches the reference sequence for seed 1', () => {
    // reference values from the canonical Marsaglia xorshift32 (13,17,5)
    expect(xorshift32(1)).toBe(270369);
    expect(xorshift32(270369)).toBe(67634689);
    expect(xorshift32(67634689)).toBe(2647435461);
  });
  it('maps state % 4 to [R,B,G,Y] after advancing', () => {
    const d = nextColor(1);
    expect(d.state).toBe(270369);
    expect(d.color).toBe(['R', 'B', 'G', 'Y'][270369 % 4]);
  });
  it('stays uint32 and never hits 0', () => {
    let s = 0xffffffff;
    for (let i = 0; i < 10000; i++) {
      s = xorshift32(s);
      expect(s).toBeGreaterThan(0);
      expect(s).toBeLessThanOrEqual(0xffffffff);
    }
  });
});

describe('cascade', () => {
  it('auto-resolves a gravity-created match in the same turn (chain)', () => {
    // Round 1 clears the vertical YYY in column 0; the R above falls to row 3 and forms RRR.
    const b = grid(['RGBYGB', 'YBGRBG', 'YGBGYR', 'YRRBGY', 'RBYGRB', 'BYGRBG']) as StableBoard;
    const r = resolveBoard(b, 7, 1);
    expect(r.rounds).toBeGreaterThanOrEqual(2);
    expect(findMatches(r.board)).toHaveLength(0);
    const removed = r.events.flatMap((e) => (e.type === 'MATCH_REMOVED' ? [e] : []));
    expect(removed[0]!.cells).toEqual([{ r: 1, c: 0 }, { r: 2, c: 0 }, { r: 3, c: 0 }]);
    expect(removed[1]!.cascadeIndex).toBe(2);
    expect(removed[1]!.cells).toEqual(expect.arrayContaining([{ r: 3, c: 0 }, { r: 3, c: 1 }, { r: 3, c: 2 }]));
    expect(removed.map((e) => e.cascadeIndex)).toEqual(Array.from({ length: r.rounds }, (_, i) => i + 1));
  });
  it('E13 throws ENGINE_CASCADE_LIMIT instead of looping when the cap is exceeded', () => {
    const b = grid(['RRRBGY', ...STABLE.slice(1)]) as StableBoard;
    expect(() => resolveBoard(b, 1, 1, 0)).toThrowError(EngineError);
    try {
      resolveBoard(b, 1, 1, 0);
    } catch (e) {
      expect((e as EngineError).code).toBe('ENGINE_CASCADE_LIMIT');
      expect((e as EngineError).detail.rngState).toBe(1);
    }
  });
});

describe('moves, win/lose', () => {
  it('E10 a move without match costs one move and keeps the shifted board, no RNG draw', () => {
    const s = state(STABLE);
    const { nextState, events } = applyMove(s, { row: 0, direction: 'left' });
    expect(nextState.remainingMoves).toBe(4);
    expect(nextState.board[0]).toEqual(['B', 'G', 'Y', 'R', 'B', 'R']);
    expect(nextState.rngState).toBe(s.rngState);
    expect(events.map((e) => e.type)).toEqual(['ROW_SHIFTED', 'OBJECTIVES_UPDATED', 'TURN_COMPLETED']);
  });
  it('does not mutate the input state', () => {
    const s = state(STABLE);
    const snap = JSON.stringify(s);
    applyMove(s, { row: 3, direction: 'right' });
    expect(JSON.stringify(s)).toBe(snap);
  });
  it('rejects invalid moves', () => {
    const s = state(STABLE);
    expect(() => applyMove(s, { row: 6, direction: 'left' })).toThrow(/ENGINE_INVALID_MOVE/);
    expect(() => applyMove(s, { row: 0, direction: 'up' as never })).toThrow(/ENGINE_INVALID_MOVE/);
  });
  it('E11 completing the objective on the last move is a win, not a loss', () => {
    // Row 1 shifted left aligns R at column 0 rows 0..2.
    const board = ['RBGYBG', 'BRGYGY', 'RYBGYB', 'GBYRBR', 'YGRBRG', 'BYGRGY'];
    const s = state(board, { moveLimit: 1 });
    const { nextState, events } = applyMove(s, { row: 1, direction: 'left' });
    expect(nextState.collected.R).toBeGreaterThanOrEqual(3);
    expect(nextState.remainingMoves).toBe(0);
    expect(nextState.status).toBe('won');
    expect(events.at(-1)?.type).toBe('LEVEL_WON');
    expect(events.some((e) => e.type === 'LEVEL_LOST')).toBe(false);
  });
  it('E12 running out of moves without the objective is a loss and blocks further input', () => {
    const s = state(STABLE, { moveLimit: 1, objectives: [{ type: 'collectColor', color: 'R', count: 30 }] });
    const { nextState, events } = applyMove(s, { row: 0, direction: 'left' });
    expect(nextState.status).toBe('lost');
    expect(events.at(-1)?.type).toBe('LEVEL_LOST');
    expect(() => applyMove(nextState, { row: 0, direction: 'left' })).toThrow(/ENGINE_NOT_READY/);
  });
  it('won state blocks further input', () => {
    const board = ['RBGYBG', 'BRGYGY', 'RYBGYB', 'GBYRBR', 'YGRBRG', 'BYGRGY'];
    const won = applyMove(state(board), { row: 1, direction: 'left' }).nextState;
    expect(won.status).toBe('won');
    expect(() => applyMove(won, { row: 0, direction: 'left' })).toThrow(/ENGINE_NOT_READY/);
  });
  it('multi-objective is AND; over-collection is kept', () => {
    const board = ['RBGYBG', 'BRGYGY', 'RYBGYB', 'GBYRBR', 'YGRBRG', 'BYGRGY'];
    const s = state(board, {
      objectives: [
        { type: 'collectColor', color: 'R', count: 3 },
        { type: 'collectColor', color: 'Y', count: 99 },
      ],
    });
    const { nextState, events } = applyMove(s, { row: 1, direction: 'left' });
    expect(nextState.status).toBe('ready');
    const upd = events.find((e) => e.type === 'OBJECTIVES_UPDATED');
    expect(upd && upd.type === 'OBJECTIVES_UPDATED' && upd.progress[0]!.done).toBe(true);
  });
  it('a uniform row shift is still a valid, paid move', () => {
    const board = ['RBGYRB', 'GYRBGY', 'RBGYRB', 'GYRBGY', 'RBGYRB', 'GYRBGY'];
    const s = state(board);
    expect(applyMove(s, { row: 0, direction: 'right' }).nextState.remainingMoves).toBe(4);
  });
});

describe('E09/E16 determinism and restart', () => {
  const lv = level(['RBGYBG', 'BRGYGY', 'RYBGYB', 'GBYRBR', 'YGRBRG', 'BYGRGY'], {
    moveLimit: 20,
    objectives: [{ type: 'collectColor', color: 'R', count: 999 }],
    seed: 987654321,
  });
  const moves = [
    { row: 1, direction: 'left' as const },
    { row: 3, direction: 'right' as const },
    { row: 0, direction: 'left' as const },
    { row: 5, direction: 'right' as const },
    { row: 2, direction: 'left' as const },
    { row: 4, direction: 'left' as const },
  ];
  const run = () => {
    let s = createGameState(lv);
    const log: unknown[] = [];
    for (const m of moves) {
      const r = applyMove(s, m);
      log.push(r.events);
      s = r.nextState;
    }
    return { s, log };
  };
  it('E09 same seed + same moves -> identical events and final state', () => {
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });
  it('different seed diverges once something is spawned', () => {
    const a = run();
    let s = createGameState({ ...lv, seed: 5 });
    for (const m of moves) s = applyMove(s, m).nextState;
    expect(s.board).not.toEqual(a.s.board);
  });
  it('E16 restart returns board, rng, moves and progress to the initial values', () => {
    const fresh = createGameState(lv);
    const played = run().s;
    expect(played.rngState).not.toBe(fresh.rngState);
    expect(createGameState(lv)).toEqual(fresh);
  });
});
