import type { Board, Pos } from './types';

/**
 * Scan the WHOLE board for every horizontal or vertical run of length >= 3 of the
 * same non-null colour and return the union of their cells (each cell once),
 * sorted row-major so output is independent of scan order (GAME_RULES §3).
 */
export function findMatches(board: Board): Pos[] {
  const h = board.length;
  const w = board[0]?.length ?? 0;
  const hit: boolean[] = new Array<boolean>(h * w).fill(false);

  // Horizontal runs
  for (let r = 0; r < h; r++) {
    const row = board[r]!;
    let start = 0;
    for (let c = 1; c <= w; c++) {
      const prev = row[c - 1];
      const cur = c < w ? row[c] : undefined;
      if (c < w && cur !== null && cur === prev) continue;
      if (prev !== null && prev !== undefined && c - start >= 3) {
        for (let k = start; k < c; k++) hit[r * w + k] = true;
      }
      start = c;
    }
  }
  // Vertical runs
  for (let c = 0; c < w; c++) {
    let start = 0;
    for (let r = 1; r <= h; r++) {
      const prev = board[r - 1]![c];
      const cur = r < h ? board[r]![c] : undefined;
      if (r < h && cur !== null && cur === prev) continue;
      if (prev !== null && prev !== undefined && r - start >= 3) {
        for (let k = start; k < r; k++) hit[k * w + c] = true;
      }
      start = r;
    }
  }

  const out: Pos[] = [];
  for (let i = 0; i < hit.length; i++) if (hit[i]) out.push({ r: Math.floor(i / w), c: i % w });
  return out;
}

export function hasMatch(board: Board): boolean {
  return findMatches(board).length > 0;
}
