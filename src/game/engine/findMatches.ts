import { matchColor } from './board';
import type { Board, Color, Pos } from './types';

export interface Run {
  dir: 'h' | 'v';
  color: Color;
  cells: Pos[];
}

/** Every maximal horizontal/vertical run (>=3) of the same matchable colour. Frozen parcels and crates never match. */
export function findRuns(board: Board): Run[] {
  const h = board.length;
  const w = board[0]?.length ?? 0;
  const runs: Run[] = [];
  for (let r = 0; r < h; r++) {
    let c = 0;
    while (c < w) {
      const col = matchColor(board[r]![c] ?? null);
      let e = c + 1;
      while (col && e < w && matchColor(board[r]![e] ?? null) === col) e++;
      if (col && e - c >= 3) runs.push({ dir: 'h', color: col, cells: Array.from({ length: e - c }, (_, k) => ({ r, c: c + k })) });
      c = e;
    }
  }
  for (let c = 0; c < w; c++) {
    let r = 0;
    while (r < h) {
      const col = matchColor(board[r]?.[c] ?? null);
      let e = r + 1;
      while (col && e < h && matchColor(board[e]?.[c] ?? null) === col) e++;
      if (col && e - r >= 3) runs.push({ dir: 'v', color: col, cells: Array.from({ length: e - r }, (_, k) => ({ r: r + k, c })) });
      r = e;
    }
  }
  return runs;
}

/** Union of all run cells, row-major, each cell once (GAME_RULES §3). */
export function findMatches(board: Board): Pos[] {
  const w = board[0]?.length ?? 0;
  const set = new Set<number>();
  for (const run of findRuns(board)) for (const p of run.cells) set.add(p.r * w + p.c);
  return [...set].sort((a, b) => a - b).map((i) => ({ r: Math.floor(i / w), c: i % w }));
}

export function hasMatch(board: Board): boolean {
  return findRuns(board).length > 0;
}
