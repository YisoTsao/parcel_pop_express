import { addCounts, emptyColorCount, objectiveProgress, objectivesMet } from './objectives';
import { parseBoardRows } from './board';
import { resolveBoard } from './resolve';
import { shiftRow } from './shift';
import {
  BOARD_SIZE,
  EngineError,
  RULE_VERSION,
  type GameState,
  type LevelDefinition,
  type Move,
  type TurnEvent,
  type TurnResult,
} from './types';

/** Fresh state for a level. Restart = call this again (resets board, seed, moves, progress). */
export function createGameState(level: LevelDefinition): GameState {
  return {
    ruleVersion: RULE_VERSION,
    levelId: level.id,
    board: parseBoardRows(level.board),
    moveLimit: level.moveLimit,
    remainingMoves: level.moveLimit,
    objectives: level.objectives.map((o) => ({ ...o })),
    collected: emptyColorCount(),
    rngState: level.seed >>> 0,
    comboCount: 0,
    maxCombo: 0,
    totalCleared: 0,
    score: 0,
    turn: 0,
    status: 'ready',
  };
}

export function isValidMove(move: unknown): move is Move {
  if (typeof move !== 'object' || move === null) return false;
  const m = move as Partial<Move>;
  return (
    typeof m.row === 'number' &&
    Number.isInteger(m.row) &&
    m.row >= 0 &&
    m.row < BOARD_SIZE &&
    (m.direction === 'left' || m.direction === 'right')
  );
}

/**
 * The single entry point for a player action. Synchronously computes the whole turn
 * (shift, every cascade round, objectives, win/lose) and returns the committed state
 * plus the event list the presenter animates. Never mutates `state`.
 */
export function applyMove(state: GameState, move: Move, maxRounds?: number): TurnResult {
  if (state.status !== 'ready') {
    throw new EngineError('ENGINE_NOT_READY', `cannot move while status=${state.status}`);
  }
  if (state.remainingMoves <= 0) {
    throw new EngineError('ENGINE_NOT_READY', 'no moves remaining');
  }
  if (!isValidMove(move)) {
    throw new EngineError('ENGINE_INVALID_MOVE', `invalid move ${JSON.stringify(move)}`);
  }

  const turn = state.turn + 1;
  const events: TurnEvent[] = [{ type: 'ROW_SHIFTED', turn, row: move.row, direction: move.direction }];
  const shifted = shiftRow(state.board, move.row, move.direction);
  const res = resolveBoard(shifted, state.rngState, turn, maxRounds);
  events.push(...res.events);

  const collected = res.rounds > 0 ? addCounts(state.collected, res.removed) : { ...state.collected };
  const remainingMoves = state.remainingMoves - 1;
  const progress = objectiveProgress(state.objectives, collected);
  events.push({ type: 'OBJECTIVES_UPDATED', turn, collected: { ...collected }, progress });

  // Settlement order (GAME_RULES §6): cascades first, then objectives (win beats out-of-moves).
  const won = objectivesMet(state.objectives, collected);
  const status = won ? 'won' : remainingMoves === 0 ? 'lost' : 'ready';
  events.push({ type: 'TURN_COMPLETED', turn, remainingMoves });
  if (status === 'won') events.push({ type: 'LEVEL_WON', turn });
  if (status === 'lost') events.push({ type: 'LEVEL_LOST', turn });

  const nextState: GameState = {
    ...state,
    board: res.board,
    remainingMoves,
    objectives: state.objectives.map((o) => ({ ...o })),
    collected,
    rngState: res.rngState,
    comboCount: res.rounds,
    maxCombo: Math.max(state.maxCombo, res.rounds),
    totalCleared: state.totalCleared + res.removedCells,
    score: state.score + res.score,
    turn,
    status,
  };
  return { nextState, events };
}

/** Replays a move list from the level's initial state. Stops early once the game ends. */
export function replay(level: LevelDefinition, moves: Move[]): { state: GameState; events: TurnEvent[] } {
  let state = createGameState(level);
  const all: TurnEvent[] = [];
  for (const m of moves) {
    if (state.status !== 'ready') break;
    const r = applyMove(state, m);
    state = r.nextState;
    all.push(...r.events);
  }
  return { state, events: all };
}

export const emptyCollected = emptyColorCount;
