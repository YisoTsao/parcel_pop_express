import { findMatches } from './findMatches';
import { applyGravity, refill } from './gravity';
import { emptyColorCount } from './objectives';
import {
  EngineError,
  MAX_CASCADE_ROUNDS,
  type Board,
  type Color,
  type ColorCount,
  type StableBoard,
  type TurnEvent,
} from './types';

export interface ResolveResult {
  board: StableBoard;
  rngState: number;
  removed: ColorCount;
  rounds: number;
  removedCells: number;
  score: number;
  events: TurnEvent[];
}

/**
 * Batch remove -> gravity -> refill, repeated until no match is left (GAME_RULES §3–§5).
 * Throws ENGINE_CASCADE_LIMIT if the board is still not stable after `maxRounds` rounds.
 */
export function resolveBoard(
  input: StableBoard,
  rngState: number,
  turn: number,
  maxRounds: number = MAX_CASCADE_ROUNDS,
): ResolveResult {
  let board: Board = input.map((row) => row.slice());
  let state = rngState;
  const removed = emptyColorCount();
  const events: TurnEvent[] = [];
  let rounds = 0;
  let removedCells = 0;
  let score = 0;

  for (;;) {
    const cells = findMatches(board);
    if (cells.length === 0) break;
    if (rounds >= maxRounds) {
      throw new EngineError('ENGINE_CASCADE_LIMIT', `cascade exceeded ${maxRounds} rounds`, {
        rngState: state,
        turn,
        maxRounds,
      });
    }
    rounds++;
    const colors: Color[] = cells.map(({ r, c }) => board[r]![c] as Color);
    for (const col of colors) removed[col]++;
    removedCells += cells.length;
    score += cells.length * 10 * rounds;
    events.push({ type: 'MATCH_REMOVED', turn, cascadeIndex: rounds, cells, colors });

    const cleared = board.map((row) => row.slice());
    for (const { r, c } of cells) cleared[r]![c] = null;
    const g = applyGravity(cleared);
    events.push({ type: 'CELLS_FELL', turn, cascadeIndex: rounds, falls: g.falls });
    const f = refill(g.board, state);
    state = f.rngState;
    board = f.board;
    events.push({ type: 'CELLS_SPAWNED', turn, cascadeIndex: rounds, spawns: f.spawns });
  }

  return { board: board as StableBoard, rngState: state, removed, rounds, removedCells, score, events };
}
