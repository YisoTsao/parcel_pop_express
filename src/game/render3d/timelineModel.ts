/**
 * Pure (no Three/React) translation of engine TurnEvents into presenter steps with
 * stable piece ids. It only *follows* the events; it never recomputes matches,
 * gravity or spawns. Tested to end exactly on nextState.board.
 */
import type { Color, ColorCount, Direction, ObjectiveProgress, Pos, StableBoard, TurnEvent } from '../engine';

export interface PieceRef {
  id: number;
  color: Color;
}
export type PieceGrid = (PieceRef | null)[][];

export type TimelineStep =
  | { kind: 'shift'; row: number; direction: Direction; wrapId: number; order: number[] }
  | { kind: 'remove'; cascadeIndex: number; pieces: { id: number; color: Color; at: Pos }[] }
  | { kind: 'fall'; cascadeIndex: number; moves: { id: number; from: Pos; to: Pos }[] }
  | { kind: 'spawn'; cascadeIndex: number; pieces: { id: number; color: Color; at: Pos; dropDistance: number }[] }
  | { kind: 'objectives'; collected: ColorCount; progress: ObjectiveProgress[] }
  | { kind: 'turnEnd'; remainingMoves: number }
  | { kind: 'won' }
  | { kind: 'lost' };

export class IdSource {
  private n = 0;
  next(): number {
    return ++this.n;
  }
}

export function gridFromBoard(board: StableBoard, ids: IdSource): PieceGrid {
  return board.map((row) => row.map((color) => ({ id: ids.next(), color })));
}

export function gridColors(grid: PieceGrid): (Color | null)[][] {
  return grid.map((row) => row.map((p) => (p ? p.color : null)));
}

const at = (g: PieceGrid, p: Pos): PieceRef | null => g[p.r]?.[p.c] ?? null;

export class TimelineMismatchError extends Error {}

/** Returns the steps and the resulting grid. Throws if events disagree with the grid. */
export function buildTimeline(start: PieceGrid, events: TurnEvent[], ids: IdSource): { steps: TimelineStep[]; grid: PieceGrid } {
  let grid: PieceGrid = start.map((r) => r.slice());
  const steps: TimelineStep[] = [];
  for (const ev of events) {
    switch (ev.type) {
      case 'ROW_SHIFTED': {
        const row = grid[ev.row];
        if (!row) throw new TimelineMismatchError(`row ${ev.row} missing`);
        const wrap = ev.direction === 'left' ? row[0] : row[row.length - 1];
        const next = ev.direction === 'left' ? [...row.slice(1), row[0]!] : [row[row.length - 1]!, ...row.slice(0, -1)];
        grid = grid.map((r, i) => (i === ev.row ? next : r));
        steps.push({ kind: 'shift', row: ev.row, direction: ev.direction, wrapId: wrap?.id ?? -1, order: next.map((p) => p?.id ?? -1) });
        break;
      }
      case 'MATCH_REMOVED': {
        const pieces = ev.cells.map((p, i) => {
          const ref = at(grid, p);
          if (!ref || ref.color !== ev.colors[i]) throw new TimelineMismatchError(`remove mismatch at ${p.r},${p.c}`);
          return { id: ref.id, color: ref.color, at: p };
        });
        grid = grid.map((r) => r.slice());
        for (const p of ev.cells) grid[p.r]![p.c] = null;
        steps.push({ kind: 'remove', cascadeIndex: ev.cascadeIndex, pieces });
        break;
      }
      case 'CELLS_FELL': {
        const next = grid.map((r) => r.slice());
        const moves = ev.falls.map((f) => {
          const ref = at(grid, f.from);
          if (!ref || ref.color !== f.color) throw new TimelineMismatchError(`fall mismatch at ${f.from.r},${f.from.c}`);
          return { ref, from: f.from, to: f.to };
        });
        for (const m of moves) next[m.from.r]![m.from.c] = null;
        for (const m of moves) next[m.to.r]![m.to.c] = m.ref;
        grid = next;
        steps.push({ kind: 'fall', cascadeIndex: ev.cascadeIndex, moves: moves.map((m) => ({ id: m.ref.id, from: m.from, to: m.to })) });
        break;
      }
      case 'CELLS_SPAWNED': {
        grid = grid.map((r) => r.slice());
        const pieces = ev.spawns.map((s) => {
          if (at(grid, s.position)) throw new TimelineMismatchError(`spawn into occupied ${s.position.r},${s.position.c}`);
          const ref = { id: ids.next(), color: s.color };
          grid[s.position.r]![s.position.c] = ref;
          return { id: ref.id, color: s.color, at: s.position, dropDistance: s.dropDistance };
        });
        steps.push({ kind: 'spawn', cascadeIndex: ev.cascadeIndex, pieces });
        break;
      }
      case 'OBJECTIVES_UPDATED':
        steps.push({ kind: 'objectives', collected: ev.collected, progress: ev.progress });
        break;
      case 'TURN_COMPLETED':
        steps.push({ kind: 'turnEnd', remainingMoves: ev.remainingMoves });
        break;
      case 'LEVEL_WON':
        steps.push({ kind: 'won' });
        break;
      case 'LEVEL_LOST':
        steps.push({ kind: 'lost' });
        break;
    }
  }
  return { steps, grid };
}
