import { BOARD_SIZE, COLORS, type Board, type Cell, type Color, type StableBoard, type Tile } from './types';

const COLOR_SET = new Set<string>(COLORS);

/** Token grammar for level boards (LEVEL_DATA_SPEC v2). */
export function parseToken(ch: string): Tile | null {
  if (COLOR_SET.has(ch)) return { kind: 'parcel', color: ch as Color };
  const up = ch.toUpperCase();
  if (ch !== up && COLOR_SET.has(up)) return { kind: 'parcel', color: up as Color, ice: true };
  if (ch === '1' || ch === '2') return { kind: 'crate', hp: Number(ch) };
  return null;
}

/** Inverse of parseToken for plain tiles; specials use * (rocketRow) | (rocketCol) @ (bomb) suffix-free debug form. */
export function tileToken(t: Cell): string {
  if (!t) return '.';
  if (t.kind === 'crate') return String(t.hp);
  const base = t.ice ? t.color.toLowerCase() : t.color;
  if (!t.special) return base;
  return t.special === 'bomb' ? '@' : t.special === 'rocketRow' ? '-' : '|';
}

export function parseBoardRows(rows: string[]): StableBoard {
  return rows.map((row, r) =>
    row.split('').map((ch, c) => {
      const t = parseToken(ch);
      if (!t) throw new Error(`invalid board token '${ch}' at ${r},${c}`);
      return t;
    }),
  );
}

export function boardToRows(board: Board): string[] {
  return board.map((row) => row.map(tileToken).join(''));
}

export function cloneTile<T extends Tile>(t: T): T {
  return { ...t };
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((t) => (t ? cloneTile(t) : null)));
}

export function isStable(board: Board): board is StableBoard {
  return board.length === BOARD_SIZE && board.every((row) => row.length === BOARD_SIZE && row.every((c) => c !== null));
}

/** A tile that can take part in a colour line. */
export function matchColor(t: Cell): Color | null {
  return t && t.kind === 'parcel' && !t.ice ? t.color : null;
}

export function countTiles(board: Board, pred: (t: Tile) => boolean): number {
  let n = 0;
  for (const row of board) for (const t of row) if (t && pred(t)) n++;
  return n;
}
