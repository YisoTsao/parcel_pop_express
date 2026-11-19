import { nextColor } from './rng';
import type { Board, Cell, FallStep, SpawnStep, StableBoard } from './types';

/** Per-column gravity: every tile (parcels and crates) compresses down keeping order (GAME_RULES §4). */
export function applyGravity(board: Board): { board: Board; falls: FallStep[] } {
  const h = board.length;
  const w = board[0]?.length ?? 0;
  const out: Board = Array.from({ length: h }, () => new Array<Cell>(w).fill(null));
  const falls: FallStep[] = [];
  for (let c = 0; c < w; c++) {
    let write = h - 1;
    for (let r = h - 1; r >= 0; r--) {
      const t = board[r]![c];
      if (!t) continue;
      out[write]![c] = t;
      if (write !== r) falls.push({ from: { r, c }, to: { r: write, c } });
      write--;
    }
  }
  return { board: out, falls };
}

/** Refill: c = 0..w-1, top empty cell downward, one xorshift32 draw each. Only plain parcels spawn. */
export function refill(board: Board, rngState: number): { board: StableBoard; spawns: SpawnStep[]; rngState: number } {
  const h = board.length;
  const w = board[0]?.length ?? 0;
  const out = board.map((row) => row.slice());
  const spawns: SpawnStep[] = [];
  let state = rngState;
  for (let c = 0; c < w; c++) {
    let empties = 0;
    for (let r = 0; r < h; r++) if (!out[r]![c]) empties++;
    for (let r = 0; r < h; r++) {
      if (out[r]![c]) continue;
      const d = nextColor(state);
      state = d.state;
      out[r]![c] = { kind: 'parcel', color: d.color };
      spawns.push({ position: { r, c }, color: d.color, dropDistance: empties });
    }
  }
  return { board: out as StableBoard, spawns, rngState: state };
}
