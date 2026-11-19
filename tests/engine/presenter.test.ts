import { describe, expect, it } from 'vitest';
import { LEVELS } from '../../src/game/data/levels';
import { applyMove, boardToRows, createGameState, legalMoves, xorshift32 } from '../../src/game/engine';
import { boardToWorld, worldToCell } from '../../src/game/render3d/coords';
import { decideSwipe } from '../../src/game/render3d/gesture';
import { buildTimeline, gridFromBoard, gridRows, IdSource } from '../../src/game/render3d/timelineModel';

describe('presenter timeline follows engine events exactly', () => {
  it('ends on nextState.board for random play on every level (specials, crates, ice included)', () => {
    let rnd = 1234567;
    let sawBlast = false;
    let sawCrate = false;
    let sawThaw = false;
    for (const lv of LEVELS) {
      for (let game = 0; game < 4; game++) {
        let s = createGameState(lv);
        const moves = legalMoves(lv.allowColumnMoves);
        const ids = new IdSource();
        let grid = gridFromBoard(s.board, ids);
        while (s.status === 'ready') {
          rnd = xorshift32(rnd);
          const { nextState, events } = applyMove(s, moves[rnd % moves.length]!);
          const t = buildTimeline(grid, events, ids);
          expect(gridRows(t.grid)).toEqual(boardToRows(nextState.board));
          expect(new Set(t.grid.flat().map((p) => p!.id)).size).toBe(36);
          for (const st of t.steps)
            if (st.kind === 'remove') {
              sawBlast ||= st.blasts.length > 0;
              sawCrate ||= st.crateHits.length > 0;
              sawThaw ||= st.thawed.length > 0;
            }
          grid = t.grid;
          s = nextState;
        }
      }
    }
    expect([sawBlast, sawCrate, sawThaw]).toEqual([true, true, true]);
  });
});

describe('boardToWorld mapping', () => {
  it('maps corners and round-trips', () => {
    expect(boardToWorld(0, 0)).toEqual({ x: -2.5, z: -2.5 });
    expect(boardToWorld(5, 5)).toEqual({ x: 2.5, z: 2.5 });
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 6; c++) {
        const w = boardToWorld(r, c);
        expect(worldToCell(w.x + 0.3, w.z - 0.3)).toEqual({ r, c });
      }
    expect(worldToCell(3.2, 0)).toBeNull();
  });
});

describe('swipe decision (U01/U02)', () => {
  it('horizontal swipes', () => {
    expect(decideSwipe(40, 5, true)).toBe('right');
    expect(decideSwipe(-40, 5, true)).toBe('left');
    expect(decideSwipe(20, 0, true)).toBeNull();
    expect(decideSwipe(40, 35, true)).toBeNull();
    expect(decideSwipe(400, 0, true)).toBe('right');
  });
  it('vertical swipes only when columns are allowed', () => {
    expect(decideSwipe(5, -60, true)).toBe('up');
    expect(decideSwipe(5, 60, true)).toBe('down');
    expect(decideSwipe(5, 60, false)).toBeNull();
    expect(decideSwipe(30, 35, true)).toBeNull();
  });
});
