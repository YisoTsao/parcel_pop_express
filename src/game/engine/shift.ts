import type { Board, Cell, Direction } from './types';

/** Cyclic shift of one row by exactly one cell (GAME_RULES §2). Returns a new array. */
export function shiftRowCells<T>(row: readonly T[], direction: Direction): T[] {
  if (row.length === 0) return [];
  if (direction === 'left') return [...row.slice(1), row[0] as T];
  return [row[row.length - 1] as T, ...row.slice(0, -1)];
}

/** Returns a new board with board[row] shifted. Other rows are copied. */
export function shiftRow<T extends Cell>(board: T[][], row: number, direction: Direction): T[][] {
  return board.map((cells, r) => (r === row ? shiftRowCells(cells, direction) : cells.slice()));
}

export type { Board };
