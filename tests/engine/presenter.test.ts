import { describe, expect, it } from 'vitest';
import { LEVELS } from '../../src/game/data/levels';
import { ALL_MOVES, applyMove, createGameState, xorshift32 } from '../../src/game/engine';
import { boardToWorld, worldToCell } from '../../src/game/render3d/coords';
import { decideSwipe } from '../../src/game/render3d/gesture';
import { buildTimeline, gridColors, gridFromBoard, IdSource } from '../../src/game/render3d/timelineModel';

describe('presenter timeline follows engine events exactly', () => {
  it('ends on nextState.board for 2000 random moves across all levels', () => {
    let rnd = 1234567;
    for (const lv of LEVELS) {
      for (let game = 0; game < 20; game++) {
        let s = createGameState({ ...lv, moveLimit: 10, objectives: [{ type: 'collectColor', color: 'R', count: 999 }] });
        const ids = new IdSource();
        let grid = gridFromBoard(s.board, ids);
        while (s.status === 'ready') {
          rnd = xorshift32(rnd);
          const { nextState, events } = applyMove(s, ALL_MOVES[rnd % 12]!);
          const t = buildTimeline(grid, events, ids);
          expect(gridColors(t.grid)).toEqual(nextState.board);
          // ids are unique on the board
          const flat = t.grid.flat().map((p) => p!.id);
          expect(new Set(flat).size).toBe(36);
          grid = t.grid;
          s = nextState;
        }
      }
    }
  });
  it('step order: shift, then remove/fall/spawn per cascade, then objectives and end', () => {
    const lv = LEVELS.find((l) => l.id === 7)!;
    const s = createGameState(lv);
    const { events } = applyMove(s, lv.witnessMoves[0]!);
    const t = buildTimeline(gridFromBoard(s.board, new IdSource()), events, new IdSource());
    expect(t.steps.map((x) => x.kind)).toEqual(['shift', 'remove', 'fall', 'spawn', 'remove', 'fall', 'spawn', 'objectives', 'turnEnd', 'won']);
  });
});

describe('boardToWorld mapping', () => {
  it('maps corners and centre consistently and round-trips', () => {
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
  it('commits only a dominant horizontal swipe past the threshold', () => {
    expect(decideSwipe(40, 5)).toBe('right');
    expect(decideSwipe(-40, 5)).toBe('left');
    expect(decideSwipe(20, 0)).toBeNull();
    expect(decideSwipe(40, 35)).toBeNull();
    expect(decideSwipe(5, 80)).toBeNull();
    expect(decideSwipe(400, 0)).toBe('right'); // never more than one cell: direction only
  });
});
