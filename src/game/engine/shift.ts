import type { Board, Cell, Move } from './types';

/** Cyclic shift of a list by exactly one cell. 'back' = towards index 0 (left/up). */
export function shiftCells<T>(cells: readonly T[], toward: 'back' | 'forward'): T[] {
  if (cells.length === 0) return [];
  if (toward === 'back') return [...cells.slice(1), cells[0] as T];
  return [cells[cells.length - 1] as T, ...cells.slice(0, -1)];
}

/** Kept for v1 naming: row shift by one. */
export function shiftRowCells<T>(row: readonly T[], direction: 'left' | 'right'): T[] {
  return shiftCells(row, direction === 'left' ? 'back' : 'forward');
}

/** Returns a new board with one row or column cyclically shifted (GAME_RULES §2). Tiles are moved, not copied. */
export function applyShift(board: Board, move: Move): Board {
  const out: Cell[][] = board.map((row) => row.slice());
  if (move.line === 'row') {
    out[move.index] = shiftCells(board[move.index]!, move.direction === 'left' ? 'back' : 'forward');
  } else {
    const col = board.map((row) => row[move.index] ?? null);
    const next = shiftCells(col, move.direction === 'up' ? 'back' : 'forward');
    next.forEach((t, r) => (out[r]![move.index] = t));
  }
  return out;
}
