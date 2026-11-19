import { createGameState, type Color, type GameState, type LevelDefinition, type Objective } from '../../src/game/engine';

export function grid(rows: string[]): (Color | null)[][] {
  return rows.map((r) => r.split('').map((ch) => (ch === '.' ? null : (ch as Color))));
}

export function level(board: string[], opts: Partial<LevelDefinition> & { objectives?: Objective[] } = {}): LevelDefinition {
  return {
    id: 1,
    name: 'test',
    width: 6,
    height: 6,
    moveLimit: 5,
    seed: 12345,
    board,
    objectives: [{ type: 'collectColor', color: 'R', count: 3 }],
    witnessMoves: [],
    ...opts,
  };
}

export function state(board: string[], opts: Partial<LevelDefinition> = {}): GameState {
  return createGameState(level(board, opts));
}

/** A stable 6x6 board with no 3-runs, used as filler. */
export const STABLE = ['RBGYRB', 'GYRBGY', 'RBGYRB', 'GYRBGY', 'RBGYRB', 'GYRBGY'];
