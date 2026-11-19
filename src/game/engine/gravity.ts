import { nextColor } from './rng';
import type { Board, Color, FallStep, SpawnStep, StableBoard } from './types';

/**
 * Per-column gravity (GAME_RULES §4). Non-null cells keep their top-to-bottom order
 * and compress to the bottom. Mutates nothing; returns the new board and fall steps
 * (only for cells whose row actually changed).
 */
export function applyGravity(board: Board): { board: Board; falls: FallStep[] } {
  const h = board.length;
  const w = board[0]?.length ?? 0;
  const out: Board = Array.from({ length: h }, () => new Array<Color | null>(w).fill(null));
  const falls: FallStep[] = [];
  for (let c = 0; c < w; c++) {
    let write = h - 1;
    for (let r = h - 1; r >= 0; r--) {
      const v = board[r]![c];
      if (v === null || v === undefined) continue;
      out[write]![c] = v;
      if (write !== r) falls.push({ from: { r, c }, to: { r: write, c }, color: v });
      write--;
    }
  }
  return { board: out, falls };
}

/**
 * Fill empty cells. Order is exact: c = 0..w-1, and inside each column from the
 * top-most empty cell downward, each drawing one xorshift32 sample.
 */
export function refill(board: Board, rngState: number): { board: StableBoard; spawns: SpawnStep[]; rngState: number } {
  const h = board.length;
  const w = board[0]?.length ?? 0;
  const out = board.map((row) => row.slice());
  const spawns: SpawnStep[] = [];
  let state = rngState;
  for (let c = 0; c < w; c++) {
    let empties = 0;
    for (let r = 0; r < h; r++) if (out[r]![c] === null) empties++;
    for (let r = 0; r < h; r++) {
      if (out[r]![c] !== null) continue;
      const draw = nextColor(state);
      state = draw.state;
      out[r]![c] = draw.color;
      spawns.push({ position: { r, c }, color: draw.color, dropDistance: empties });
    }
  }
  return { board: out as StableBoard, spawns, rngState: state };
}
