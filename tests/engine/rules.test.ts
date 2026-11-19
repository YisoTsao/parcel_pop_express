import { describe, expect, it } from 'vitest';
import {
  applyGravity,
  applyMove,
  applyShift,
  blastArea,
  boardToRows,
  createGameState,
  EngineError,
  findMatches,
  nextColor,
  refill,
  resolveBoard,
  shiftRowCells,
  xorshift32,
  type MatchEvent,
} from '../../src/game/engine';
import { grid, level, sgrid, STABLE, state } from './helpers';

const firstRound = (rows: string[], move: Parameters<typeof resolveBoard>[3] = null) => {
  const r = resolveBoard(sgrid(rows), 99, 1, move);
  return { res: r, ev: r.events.find((e): e is MatchEvent => e.type === 'MATCH_REMOVED')! };
};

describe('E01/E02 + column: cyclic line shift', () => {
  it('E01 row left: [R,B,G,Y,R,B] -> [B,G,Y,R,B,R]', () => {
    expect(shiftRowCells(['R', 'B', 'G', 'Y', 'R', 'B'], 'left')).toEqual(['B', 'G', 'Y', 'R', 'B', 'R']);
  });
  it('E02 row right wraps last to first', () => {
    expect(shiftRowCells(['A', 'B', 'C', 'D', 'E', 'F'], 'right')).toEqual(['F', 'A', 'B', 'C', 'D', 'E']);
  });
  it('column up / down wrap vertically and leave other columns alone', () => {
    const b = grid(STABLE);
    const up = boardToRows(applyShift(b, { line: 'col', index: 0, direction: 'up' }));
    expect(up.map((r) => r[0]).join('')).toBe('GRGRGR');
    expect(up.map((r) => r.slice(1))).toEqual(STABLE.map((r) => r.slice(1)));
    const down = boardToRows(applyShift(b, { line: 'col', index: 0, direction: 'down' }));
    expect(down.map((r) => r[0]).join('')).toBe('GRGRGR'); // alternating column: up and down coincide
  });
  it('crates and ice travel with the shifted line', () => {
    const b = grid(['1r....', '......', '......', '......', '......', '......']);
    const out = boardToRows(applyShift(b, { line: 'row', index: 0, direction: 'right' }));
    expect(out[0]).toBe('.1r...');
    const col = boardToRows(applyShift(b, { line: 'col', index: 0, direction: 'down' }));
    expect(col[1]![0]).toBe('1');
  });
  it('does not mutate the input board', () => {
    const b = grid(STABLE);
    const snap = JSON.stringify(b);
    applyShift(b, { line: 'col', index: 3, direction: 'up' });
    expect(JSON.stringify(b)).toBe(snap);
  });
});

describe('E03–E06 matching', () => {
  it('E04 vertical 3-run clears three, no special', () => {
    const { ev } = firstRound(['G.....', 'G.....', 'G.....', 'B.....', '......', '......']);
    expect(ev.cells).toHaveLength(3);
    expect(ev.created).toEqual([]);
  });
  it('E05 cross overlap counts once: 5 cells -> 4 removed + 1 bomb at the crossing', () => {
    const { ev } = firstRound(['.R....', 'RRR...', '.R....', '......', '......', '......']);
    expect(ev.matched).toHaveLength(5);
    expect(ev.created).toEqual([{ pos: { r: 1, c: 1 }, color: 'R', special: 'bomb' }]);
    expect(ev.cells).toHaveLength(4);
  });
  it('E06 two separate groups resolve in the same batch', () => {
    const { ev } = firstRound(['BBB...', '......', '......', '......', '.....G', '...GGG']);
    expect(ev.cells).toHaveLength(6);
  });
  it('frozen parcels and crates never match', () => {
    expect(findMatches(grid(['RRr...', '111...', '......', '......', '......', '......']))).toHaveLength(0);
  });
});

describe('specials (GAME_RULES §5)', () => {
  it('horizontal 4 -> rocketRow; vertical 4 -> rocketCol', () => {
    expect(firstRound(['RRRR..', '......', '......', '......', '......', '......']).ev.created[0]!.special).toBe('rocketRow');
    expect(firstRound(['B.....', 'B.....', 'B.....', 'B.....', '......', '......']).ev.created[0]!.special).toBe('rocketCol');
  });
  it('5 in a line -> bomb', () => {
    expect(firstRound(['YYYYY.', '......', '......', '......', '......', '......']).ev.created[0]!.special).toBe('bomb');
  });
  it('special is placed on the moved line when possible, else bottom-most then left-most', () => {
    const rows = ['G.....', 'G.....', 'G.....', 'G.....', '......', '......'];
    expect(firstRound(rows).ev.created[0]!.pos).toEqual({ r: 3, c: 0 });
    expect(firstRound(rows, { line: 'row', index: 1, direction: 'left' }).ev.created[0]!.pos).toEqual({ r: 1, c: 0 });
  });
  it('blast areas', () => {
    expect(blastArea('rocketRow', { r: 2, c: 3 })).toHaveLength(6);
    expect(blastArea('rocketCol', { r: 2, c: 3 }).every((p) => p.c === 3)).toBe(true);
    expect(blastArea('bomb', { r: 0, c: 0 })).toHaveLength(4);
    expect(blastArea('bomb', { r: 3, c: 3 })).toHaveLength(9);
  });
  it('a matched rocket clears its whole row', () => {
    // '-' = R rocketRow at (2,0), matched by the RR beside it
    const { ev } = firstRound(['GBYGBY', 'BYGBYG', '-RRBGY', 'YGBYGB', 'GBYGBY', 'BYGBYG']);
    expect(ev.blasts[0]!.special).toBe('rocketRow');
    expect(ev.cells.filter((p) => p.r === 2)).toHaveLength(6);
  });
  it('specials hit by a blast chain-activate', () => {
    // rocketRow in row 2 hits a bomb at (2,5)
    const rows = ['GBYGBY', 'BYGBYG', '-RRBG@', 'YGBYGB', 'GBYGBY', 'BYGBYG'];
    const { ev } = firstRound(rows);
    expect(ev.blasts.map((b) => b.special)).toEqual(['rocketRow', 'bomb']);
    expect(ev.cells).toEqual(expect.arrayContaining([{ r: 1, c: 4 }, { r: 3, c: 5 }]));
  });
});

describe('obstacles (GAME_RULES §6)', () => {
  it('tape crate takes 1 damage from an adjacent line; hp2 -> 1 -> removed', () => {
    const rows = ['RRR...', '2.....', '......', '......', '......', '......'];
    const { ev } = firstRound(rows);
    expect(ev.crateHits).toEqual([{ pos: { r: 1, c: 0 }, hp: 1 }]);
    const r1 = firstRound(['RRR...', '1.....', '......', '......', '......', '......']);
    expect(r1.ev.crateHits).toEqual([{ pos: { r: 1, c: 0 }, hp: 0 }]);
    expect(r1.res.gained.cratesCleared).toBe(1);
  });
  it('a crate is hit at most once per round even when touched by several cells', () => {
    const { ev } = firstRound(['RRR...', '12....', '......', '......', '......', '......']);
    expect(ev.crateHits.find((h) => h.pos.c === 1)!.hp).toBe(1);
  });
  it('blasts damage crates and thaw ice but do not remove frozen parcels', () => {
    const { ev, res } = firstRound(['GBYGBY', 'BYGBYG', '-RR1gY', 'YGBYGB', 'GBYGBY', 'BYGBYG']);
    expect(ev.crateHits).toEqual([{ pos: { r: 2, c: 3 }, hp: 0 }]);
    expect(ev.thawed).toEqual([{ r: 2, c: 4 }]);
    expect(ev.cells.some((p) => p.r === 2 && p.c === 4)).toBe(false);
    expect(res.gained.iceBroken).toBe(1);
  });
  it('ice next to a line thaws and then matches normally later', () => {
    const { ev } = firstRound(['RRRg..', '......', '......', '......', '......', '......']);
    expect(ev.thawed).toEqual([{ r: 0, c: 3 }]);
  });
  it('crates fall with gravity', () => {
    const b = grid(['1.....', '......', 'R.....', '......', '......', '......']);
    const g = applyGravity(b);
    expect(boardToRows(g.board).map((r) => r[0]).join('')).toBe('....1R');
  });
});

describe('E07/E08 gravity and refill', () => {
  it('E07 compresses each column keeping relative order', () => {
    const b = grid(['R.....', '.B....', 'G.....', '.Y....', 'B.....', '......']);
    const { board, falls } = applyGravity(b);
    expect(boardToRows(board).map((r) => r[0]).join('')).toBe('...RGB');
    expect(falls).toContainEqual({ from: { r: 0, c: 0 }, to: { r: 3, c: 0 } });
  });
  it('E08 refill: c=0..5, top->bottom, one xorshift32 draw each; only plain parcels spawn', () => {
    const b = grid(STABLE);
    b[0]![3] = null;
    b[1]![3] = null;
    b[0]![1] = null;
    const seed = 2463534242;
    const r = refill(b, seed);
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
    expect(r.board.flat().every((t) => t.kind === 'parcel' && !t.ice && !t.special)).toBe(true);
  });
});

describe('PRNG', () => {
  it('xorshift32 matches the Marsaglia (13,17,5) reference for seed 1', () => {
    expect(xorshift32(1)).toBe(270369);
    expect(xorshift32(270369)).toBe(67634689);
    expect(xorshift32(67634689)).toBe(2647435461);
  });
  it('maps state % 4 to [R,B,G,Y] after advancing', () => {
    expect(nextColor(1)).toEqual({ state: 270369, color: ['R', 'B', 'G', 'Y'][270369 % 4] });
  });
});

describe('cascade', () => {
  it('auto-resolves a gravity-created match in the same turn', () => {
    const r = resolveBoard(sgrid(['RGBYGB', 'YBGRBG', 'YGBGYR', 'YRRBGY', 'RBYGRB', 'BYGRBG']), 7, 1);
    expect(r.rounds).toBeGreaterThanOrEqual(2);
    expect(findMatches(r.board)).toHaveLength(0);
    const removed = r.events.flatMap((e) => (e.type === 'MATCH_REMOVED' ? [e] : []));
    expect(removed[1]!.cells).toEqual(expect.arrayContaining([{ r: 3, c: 0 }, { r: 3, c: 1 }, { r: 3, c: 2 }]));
  });
  it('E13 throws ENGINE_CASCADE_LIMIT instead of looping', () => {
    const b = sgrid(['RRRBGY', ...STABLE.slice(1)]);
    try {
      resolveBoard(b, 1, 1, null, 0);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(EngineError);
      expect((e as EngineError).code).toBe('ENGINE_CASCADE_LIMIT');
    }
  });
});

describe('moves, win/lose', () => {
  it('E10 a move without match costs one move, keeps the shifted board, no RNG draw', () => {
    const s = state(STABLE);
    const { nextState, events } = applyMove(s, { line: 'row', index: 0, direction: 'left' });
    expect(nextState.remainingMoves).toBe(4);
    expect(boardToRows(nextState.board)[0]).toBe('BGYRBR');
    expect(nextState.rngState).toBe(s.rngState);
    expect(events.map((e) => e.type)).toEqual(['LINE_SHIFTED', 'OBJECTIVES_UPDATED', 'TURN_COMPLETED']);
  });
  it('column moves are rejected when the level disallows them', () => {
    const s = state(STABLE, { allowColumnMoves: false });
    expect(() => applyMove(s, { line: 'col', index: 0, direction: 'up' })).toThrow(/ENGINE_INVALID_MOVE/);
    expect(() => applyMove(s, { line: 'row', index: 0, direction: 'up' } as never)).toThrow(/ENGINE_INVALID_MOVE/);
  });
  it('does not mutate the input state', () => {
    const s = state(['RBGYBG', 'BRGYGY', 'RYBGYB', 'GBYRBR', 'YGRBRG', 'BYGRGY']);
    const snap = JSON.stringify(s);
    applyMove(s, { line: 'row', index: 1, direction: 'left' });
    expect(JSON.stringify(s)).toBe(snap);
  });
  it('E11 completing the objective on the last move is a win', () => {
    const s = state(['RBGYBG', 'BRGYGY', 'RYBGYB', 'GBYRBR', 'YGRBRG', 'BYGRGY'], { moveLimit: 1 });
    const { nextState, events } = applyMove(s, { line: 'row', index: 1, direction: 'left' });
    expect(nextState.remainingMoves).toBe(0);
    expect(nextState.status).toBe('won');
    expect(events.some((e) => e.type === 'LEVEL_LOST')).toBe(false);
  });
  it('E12 out of moves without the objective is a loss and blocks input', () => {
    const s = state(STABLE, { moveLimit: 1, objectives: [{ type: 'collectColor', color: 'R', count: 30 }] });
    const { nextState } = applyMove(s, { line: 'row', index: 0, direction: 'left' });
    expect(nextState.status).toBe('lost');
    expect(() => applyMove(nextState, { line: 'row', index: 0, direction: 'left' })).toThrow(/ENGINE_NOT_READY/);
  });
  it('clearCrates / breakIce objectives progress and AND together', () => {
    const s = state(['RBGYBG', 'BRGYGY', 'RYBGYB', '1BYRBR', 'gGRBRG', 'BYGRGY'], {
      objectives: [{ type: 'clearCrates', count: 1 }, { type: 'collectColor', color: 'R', count: 3 }],
    });
    const { nextState } = applyMove(s, { line: 'row', index: 1, direction: 'left' });
    expect(nextState.progress.collected.R).toBeGreaterThanOrEqual(3);
  });
});

describe('E09/E16 determinism and restart', () => {
  const lv = level(['RBGYBG', 'BRGYGY', 'RYBGYB', 'G1YRBR', 'YGrBRG', 'BYGR2Y'], {
    moveLimit: 20,
    objectives: [{ type: 'collectColor', color: 'R', count: 999 }],
    seed: 987654321,
  });
  const moves = [
    { line: 'row', index: 1, direction: 'left' },
    { line: 'col', index: 3, direction: 'down' },
    { line: 'row', index: 0, direction: 'left' },
    { line: 'col', index: 1, direction: 'up' },
    { line: 'row', index: 2, direction: 'left' },
    { line: 'col', index: 4, direction: 'down' },
  ] as const;
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
  it('E16 restart returns everything to the initial values', () => {
    expect(createGameState(lv)).toEqual(createGameState(lv));
    expect(run().s.turn).toBe(6);
  });
});
