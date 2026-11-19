/**
 * Pure (no Three/React) translation of engine TurnEvents into presenter steps with
 * stable piece ids. It only *follows* events; it never recomputes matches, blasts,
 * gravity or spawns. Tested to end exactly on nextState.board.
 */
import { tileToken, type Blast, type Move, type Pos, type Progress, type ObjectiveProgress, type Special, type StableBoard, type Tile, type TurnEvent } from '../engine';

export interface PieceRef {
  id: number;
  tile: Tile;
}
export type PieceGrid = (PieceRef | null)[][];

export type TimelineStep =
  | { kind: 'shift'; move: Move; wrapId: number; order: number[] }
  | {
      kind: 'remove';
      cascadeIndex: number;
      removed: { id: number; tile: Tile; at: Pos }[];
      created: { id: number; at: Pos; special: Special }[];
      blasts: Blast[];
      crateHits: { id: number; at: Pos; hp: number }[];
      thawed: { id: number; at: Pos }[];
    }
  | { kind: 'fall'; cascadeIndex: number; moves: { id: number; from: Pos; to: Pos }[] }
  | { kind: 'spawn'; cascadeIndex: number; pieces: { id: number; tile: Tile; at: Pos; dropDistance: number }[] }
  | { kind: 'objectives'; progress: Progress; objectives: ObjectiveProgress[] }
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
  return board.map((row) => row.map((tile) => ({ id: ids.next(), tile: { ...tile } })));
}

/** Board tokens of the presenter grid, comparable with boardToRows(nextState.board). */
export function gridRows(grid: PieceGrid): string[] {
  return grid.map((row) => row.map((p) => tileToken(p ? p.tile : null)).join(''));
}

export class TimelineMismatchError extends Error {}

const at = (g: PieceGrid, p: Pos): PieceRef | null => g[p.r]?.[p.c] ?? null;
const must = (g: PieceGrid, p: Pos, what: string): PieceRef => {
  const ref = at(g, p);
  if (!ref) throw new TimelineMismatchError(`${what}: nothing at ${p.r},${p.c}`);
  return ref;
};

export function buildTimeline(start: PieceGrid, events: TurnEvent[], ids: IdSource): { steps: TimelineStep[]; grid: PieceGrid } {
  let grid: PieceGrid = start.map((r) => r.slice());
  const steps: TimelineStep[] = [];
  for (const ev of events) {
    switch (ev.type) {
      case 'LINE_SHIFTED': {
        const m = ev.move;
        const line = m.line === 'row' ? grid[m.index]!.slice() : grid.map((r) => r[m.index]!);
        const back = m.direction === 'left' || m.direction === 'up';
        const wrap = back ? line[0] : line[line.length - 1];
        const next = back ? [...line.slice(1), line[0]!] : [line[line.length - 1]!, ...line.slice(0, -1)];
        grid = grid.map((r) => r.slice());
        if (m.line === 'row') grid[m.index] = next;
        else next.forEach((p, r) => (grid[r]![m.index] = p));
        steps.push({ kind: 'shift', move: m, wrapId: wrap?.id ?? -1, order: next.map((p) => p?.id ?? -1) });
        break;
      }
      case 'MATCH_REMOVED': {
        const removed = ev.cells.map((p, i) => {
          const ref = must(grid, p, 'remove');
          if (ref.tile.kind !== 'parcel' || ref.tile.color !== ev.colors[i]) throw new TimelineMismatchError(`remove colour mismatch at ${p.r},${p.c}`);
          return { id: ref.id, tile: ref.tile, at: p };
        });
        const crateHits = ev.crateHits.map((h) => ({ id: must(grid, h.pos, 'crate').id, at: h.pos, hp: h.hp }));
        const thawed = ev.thawed.map((p) => ({ id: must(grid, p, 'thaw').id, at: p }));
        const created = ev.created.map((c) => ({ id: must(grid, c.pos, 'create').id, at: c.pos, special: c.special }));
        grid = grid.map((r) => r.slice());
        for (const h of ev.crateHits) {
          const ref = at(grid, h.pos)!;
          grid[h.pos.r]![h.pos.c] = h.hp <= 0 ? null : { id: ref.id, tile: { kind: 'crate', hp: h.hp } };
        }
        for (const p of ev.thawed) {
          const ref = at(grid, p)!;
          if (ref.tile.kind !== 'parcel') throw new TimelineMismatchError('thaw on crate');
          const { ice: _ice, ...rest } = ref.tile;
          grid[p.r]![p.c] = { id: ref.id, tile: rest };
        }
        for (const p of ev.cells) grid[p.r]![p.c] = null;
        for (const c of ev.created) {
          const ref = at(grid, c.pos)!;
          grid[c.pos.r]![c.pos.c] = { id: ref.id, tile: { kind: 'parcel', color: c.color, special: c.special } };
        }
        steps.push({ kind: 'remove', cascadeIndex: ev.cascadeIndex, removed, created, blasts: ev.blasts, crateHits, thawed });
        break;
      }
      case 'CELLS_FELL': {
        const next = grid.map((r) => r.slice());
        const moves = ev.falls.map((f) => ({ ref: must(grid, f.from, 'fall'), from: f.from, to: f.to }));
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
          const ref: PieceRef = { id: ids.next(), tile: { kind: 'parcel', color: s.color } };
          grid[s.position.r]![s.position.c] = ref;
          return { id: ref.id, tile: ref.tile, at: s.position, dropDistance: s.dropDistance };
        });
        steps.push({ kind: 'spawn', cascadeIndex: ev.cascadeIndex, pieces });
        break;
      }
      case 'OBJECTIVES_UPDATED':
        steps.push({ kind: 'objectives', progress: ev.progress, objectives: ev.objectives });
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
