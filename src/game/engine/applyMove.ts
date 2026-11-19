import { parseBoardRows } from './board';
import { addCounts, cloneProgress, emptyProgress, objectiveProgress, objectivesMet } from './objectives';
import { resolveBoard } from './resolve';
import { applyShift } from './shift';
import {
  BOARD_SIZE,
  EngineError,
  RULE_VERSION,
  type GameState,
  type LevelDefinition,
  type Move,
  type Progress,
  type TurnEvent,
  type TurnResult,
} from './types';

/** Fresh state for a level. Restart = call this again. */
export function createGameState(level: LevelDefinition): GameState {
  return {
    ruleVersion: RULE_VERSION,
    levelId: level.id,
    board: parseBoardRows(level.board),
    moveLimit: level.moveLimit,
    remainingMoves: level.moveLimit,
    allowColumnMoves: level.allowColumnMoves,
    objectives: level.objectives.map((o) => ({ ...o })),
    progress: emptyProgress(),
    rngState: level.seed >>> 0,
    comboCount: 0,
    maxCombo: 0,
    totalCleared: 0,
    specialsCreated: 0,
    score: 0,
    turn: 0,
    status: 'ready',
  };
}

export function isValidMove(move: unknown, allowColumnMoves = true): move is Move {
  if (typeof move !== 'object' || move === null) return false;
  const m = move as Record<string, unknown>;
  if (typeof m.index !== 'number' || !Number.isInteger(m.index) || m.index < 0 || m.index >= BOARD_SIZE) return false;
  if (m.line === 'row') return m.direction === 'left' || m.direction === 'right';
  if (m.line === 'col') return allowColumnMoves && (m.direction === 'up' || m.direction === 'down');
  return false;
}

function addProgress(a: Progress, b: Progress): Progress {
  return { collected: addCounts(a.collected, b.collected), cratesCleared: a.cratesCleared + b.cratesCleared, iceBroken: a.iceBroken + b.iceBroken };
}

/**
 * The single entry point for a player action: synchronously computes the whole turn and
 * returns the committed state plus the events the presenter animates. Never mutates `state`.
 */
export function applyMove(state: GameState, move: Move, maxRounds?: number): TurnResult {
  if (state.status !== 'ready') throw new EngineError('ENGINE_NOT_READY', `cannot move while status=${state.status}`);
  if (state.remainingMoves <= 0) throw new EngineError('ENGINE_NOT_READY', 'no moves remaining');
  if (!isValidMove(move, state.allowColumnMoves)) throw new EngineError('ENGINE_INVALID_MOVE', `invalid move ${JSON.stringify(move)}`);

  const turn = state.turn + 1;
  const events: TurnEvent[] = [{ type: 'LINE_SHIFTED', turn, move: { ...move } }];
  const shifted = applyShift(state.board, move);
  const res = resolveBoard(shifted as GameState['board'], state.rngState, turn, move, maxRounds);
  events.push(...res.events);

  const progress = res.rounds > 0 ? addProgress(state.progress, res.gained) : cloneProgress(state.progress);
  const remainingMoves = state.remainingMoves - 1;
  events.push({ type: 'OBJECTIVES_UPDATED', turn, progress: cloneProgress(progress), objectives: objectiveProgress(state.objectives, progress) });

  // Settlement (GAME_RULES §7): all cascades first, then objectives; a win beats running out of moves.
  const won = objectivesMet(state.objectives, progress);
  const status = won ? 'won' : remainingMoves === 0 ? 'lost' : 'ready';
  events.push({ type: 'TURN_COMPLETED', turn, remainingMoves });
  if (status === 'won') events.push({ type: 'LEVEL_WON', turn });
  if (status === 'lost') events.push({ type: 'LEVEL_LOST', turn });

  return {
    nextState: {
      ...state,
      board: res.board,
      remainingMoves,
      objectives: state.objectives.map((o) => ({ ...o })),
      progress,
      rngState: res.rngState,
      comboCount: res.rounds,
      maxCombo: Math.max(state.maxCombo, res.rounds),
      totalCleared: state.totalCleared + res.removedCells,
      specialsCreated: state.specialsCreated + res.specialsCreated,
      score: state.score + res.score,
      turn,
      status,
    },
    events,
  };
}

/** Replays moves from the level start; stops once the game ends. */
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

/** All legal moves in fixed order: rows 0..5 (left, right), then columns 0..5 (up, down) if allowed. */
export function legalMoves(allowColumnMoves: boolean): Move[] {
  const out: Move[] = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    out.push({ line: 'row', index: i, direction: 'left' }, { line: 'row', index: i, direction: 'right' });
  }
  if (allowColumnMoves)
    for (let i = 0; i < BOARD_SIZE; i++) out.push({ line: 'col', index: i, direction: 'up' }, { line: 'col', index: i, direction: 'down' });
  return out;
}

export function moveLabel(m: Move): string {
  return `${m.line === 'row' ? 'R' : 'C'}${m.index}${m.direction[0]!.toUpperCase()}`;
}
