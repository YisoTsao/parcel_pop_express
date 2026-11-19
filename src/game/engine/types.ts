/**
 * Pure rule types. GAME_RULES.md is the authority for every shape here.
 * This module (and all of game/engine) must never import React, Three or DOM APIs.
 */
export const RULE_VERSION = '1.0.0' as const;
export const BOARD_SIZE = 6;
export const COLORS = ['R', 'B', 'G', 'Y'] as const;
export const MAX_CASCADE_ROUNDS = 64;

export type Color = (typeof COLORS)[number];
export type Cell = Color | null;
/** board[r][c]; r=0 is the top row, c=0 is the left column. */
export type Board = Cell[][];
/** A stable board: no nulls. */
export type StableBoard = Color[][];

export type Direction = 'left' | 'right';
export interface Move {
  row: number;
  direction: Direction;
}

export interface Pos {
  r: number;
  c: number;
}

export interface CollectColorObjective {
  type: 'collectColor';
  color: Color;
  count: number;
}
export type Objective = CollectColorObjective;

export interface LevelDefinition {
  id: number;
  name: string;
  width: 6;
  height: 6;
  moveLimit: number;
  seed: number;
  board: string[];
  objectives: Objective[];
  /** Test-only. Runtime must never use this to help the player. */
  witnessMoves: Move[];
}

export interface LevelFile {
  ruleVersion: string;
  levels: LevelDefinition[];
}

export type GameStatus = 'ready' | 'resolving' | 'won' | 'lost';

export type ColorCount = Record<Color, number>;

export interface ObjectiveProgress {
  color: Color;
  target: number;
  /** Capped at target for display; over-collection is never subtracted. */
  current: number;
  done: boolean;
}

export interface GameState {
  ruleVersion: typeof RULE_VERSION;
  levelId: number;
  board: StableBoard;
  moveLimit: number;
  remainingMoves: number;
  objectives: Objective[];
  /** Total removed per color across the whole level (uncapped). */
  collected: ColorCount;
  rngState: number;
  /** Number of cascade rounds the last turn produced (1 = single batch). */
  comboCount: number;
  maxCombo: number;
  totalCleared: number;
  score: number;
  turn: number;
  status: GameStatus;
}

export interface FallStep {
  from: Pos;
  to: Pos;
  color: Color;
}
export interface SpawnStep {
  position: Pos;
  color: Color;
  /** How many cells above the board top the parcel should appear from (>=1). */
  dropDistance: number;
}

export type TurnEvent =
  | { type: 'ROW_SHIFTED'; turn: number; row: number; direction: Direction }
  | { type: 'MATCH_REMOVED'; turn: number; cascadeIndex: number; cells: Pos[]; colors: Color[] }
  | { type: 'CELLS_FELL'; turn: number; cascadeIndex: number; falls: FallStep[] }
  | { type: 'CELLS_SPAWNED'; turn: number; cascadeIndex: number; spawns: SpawnStep[] }
  | { type: 'OBJECTIVES_UPDATED'; turn: number; collected: ColorCount; progress: ObjectiveProgress[] }
  | { type: 'TURN_COMPLETED'; turn: number; remainingMoves: number }
  | { type: 'LEVEL_WON'; turn: number }
  | { type: 'LEVEL_LOST'; turn: number };

export interface TurnResult {
  nextState: GameState;
  events: TurnEvent[];
}

export type EngineErrorCode =
  | 'ENGINE_CASCADE_LIMIT'
  | 'ENGINE_INVALID_MOVE'
  | 'ENGINE_NOT_READY';

export class EngineError extends Error {
  readonly code: EngineErrorCode;
  readonly detail: Record<string, unknown>;
  constructor(code: EngineErrorCode, message: string, detail: Record<string, unknown> = {}) {
    super(`${code}: ${message}`);
    this.name = 'EngineError';
    this.code = code;
    this.detail = detail;
  }
}
