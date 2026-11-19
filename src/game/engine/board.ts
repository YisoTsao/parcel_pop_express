import { BOARD_SIZE, type Board, type Cell, type Color, type StableBoard } from './types';

export function cloneBoard<T extends Cell>(board: T[][]): T[][] {
  return board.map((row) => row.slice());
}

export function parseBoardRows(rows: string[]): StableBoard {
  return rows.map((row) => row.split('') as Color[]);
}

export function boardToRows(board: Board): string[] {
  return board.map((row) => row.map((c) => c ?? '.').join(''));
}

export function cellAt<T>(board: T[][], r: number, c: number): T {
  const row = board[r];
  if (!row) throw new RangeError(`row ${r} out of range`);
  const v = row[c];
  if (v === undefined) throw new RangeError(`cell (${r},${c}) out of range`);
  return v;
}

export function setCell<T>(board: T[][], r: number, c: number, v: T): void {
  const row = board[r];
  if (!row || c < 0 || c >= row.length) throw new RangeError(`cell (${r},${c}) out of range`);
  row[c] = v;
}

export function isStable(board: Board): board is StableBoard {
  return board.length === BOARD_SIZE && board.every((row) => row.length === BOARD_SIZE && row.every((c) => c !== null));
}
