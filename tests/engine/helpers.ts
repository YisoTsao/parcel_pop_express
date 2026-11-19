import { createGameState, parseToken, type Board, type GameState, type LevelDefinition, type StableBoard } from '../../src/game/engine';

/** '.' = empty; other tokens per LEVEL_DATA_SPEC v2; '-' '|' '@' = R rocketRow / rocketCol / bomb (test only). */
export function grid(rows: string[]): Board {
  return rows.map((row) =>
    [...row].map((ch) => {
      if (ch === '.') return null;
      if (ch === '-') return { kind: 'parcel' as const, color: 'R' as const, special: 'rocketRow' as const };
      if (ch === '|') return { kind: 'parcel' as const, color: 'R' as const, special: 'rocketCol' as const };
      if (ch === '@') return { kind: 'parcel' as const, color: 'R' as const, special: 'bomb' as const };
      const t = parseToken(ch);
      if (!t) throw new Error(`bad token ${ch}`);
      return t;
    }),
  );
}
export const sgrid = (rows: string[]) => grid(rows) as StableBoard;

export function level(board: string[], opts: Partial<LevelDefinition> = {}): LevelDefinition {
  return {
    id: 1,
    name: 'test',
    width: 6,
    height: 6,
    moveLimit: 5,
    seed: 12345,
    allowColumnMoves: true,
    board,
    objectives: [{ type: 'collectColor', color: 'R', count: 3 }],
    witnessMoves: [],
    ...opts,
  };
}

export function state(board: string[], opts: Partial<LevelDefinition> = {}): GameState {
  return createGameState(level(board, opts));
}

/** A stable 6x6 board with no 3-runs. */
export const STABLE = ['RBGYRB', 'GYRBGY', 'RBGYRB', 'GYRBGY', 'RBGYRB', 'GYRBGY'];
