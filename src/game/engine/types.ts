/**
 * Pure rule types for rules v2.0.0 (GAME_RULES.md is the authority).
 * Nothing in game/engine may import React, Three or DOM APIs.
 */
export const RULE_VERSION = '2.0.0' as const;
export const BOARD_SIZE = 6;
export const COLORS = ['R', 'B', 'G', 'Y'] as const;
export const MAX_CASCADE_ROUNDS = 64;

export type Color = (typeof COLORS)[number];
export type Special = 'rocketRow' | 'rocketCol' | 'bomb';

export interface ParcelTile {
  kind: 'parcel';
  color: Color;
  special?: Special;
  /** Frozen parcels move and fall but never match until thawed. */
  ice?: boolean;
}
export interface CrateTile {
  kind: 'crate';
  /** Remaining hits (1 or 2). Removed at 0. */
  hp: number;
}
export type Tile = ParcelTile | CrateTile;
export type Cell = Tile | null;
/** board[r][c]; r=0 top row, c=0 left column. */
export type Board = Cell[][];
/** Stable board: no nulls. */
export type StableBoard = Tile[][];

export type RowDirection = 'left' | 'right';
export type ColDirection = 'up' | 'down';
export type Direction = RowDirection | ColDirection;
export type Move =
  | { line: 'row'; index: number; direction: RowDirection }
  | { line: 'col'; index: number; direction: ColDirection };

export interface Pos {
  r: number;
  c: number;
}

export type Objective =
  | { type: 'collectColor'; color: Color; count: number }
  | { type: 'clearCrates'; count: number }
  | { type: 'breakIce'; count: number };
export type ObjectiveType = Objective['type'];

export interface LevelDefinition {
  id: number;
  name: string;
  width: 6;
  height: 6;
  moveLimit: number;
  seed: number;
  allowColumnMoves: boolean;
  /** 6 strings × 6 tokens: R/B/G/Y parcel, r/b/g/y frozen parcel, 1/2 tape crate with that many hits. */
  board: string[];
  objectives: Objective[];
  /** Test-only witness. Runtime never uses it to help the player. */
  witnessMoves: Move[];
  /** Optional designer note shown on level select / start. */
  hint?: string;
}

export interface LevelFile {
  ruleVersion: string;
  levels: LevelDefinition[];
}

export type GameStatus = 'ready' | 'resolving' | 'won' | 'lost';

export type ColorCount = Record<Color, number>;

export interface Progress {
  collected: ColorCount;
  cratesCleared: number;
  iceBroken: number;
}

export interface ObjectiveProgress {
  type: ObjectiveType;
  color?: Color;
  target: number;
  current: number;
  done: boolean;
}

export interface GameState {
  ruleVersion: typeof RULE_VERSION;
  levelId: number;
  board: StableBoard;
  moveLimit: number;
  remainingMoves: number;
  allowColumnMoves: boolean;
  objectives: Objective[];
  progress: Progress;
  rngState: number;
  comboCount: number;
  maxCombo: number;
  totalCleared: number;
  specialsCreated: number;
  score: number;
  turn: number;
  status: GameStatus;
}

export interface FallStep {
  from: Pos;
  to: Pos;
}
export interface SpawnStep {
  position: Pos;
  color: Color;
  /** Empty cells in that column (spawn height for animation). */
  dropDistance: number;
}
export interface CreatedSpecial {
  pos: Pos;
  color: Color;
  special: Special;
}
export interface Blast {
  origin: Pos;
  special: Special;
  cells: Pos[];
}

export type TurnEvent =
  | { type: 'LINE_SHIFTED'; turn: number; move: Move }
  | {
      type: 'MATCH_REMOVED';
      turn: number;
      cascadeIndex: number;
      /** Every parcel removed this round (matched or blasted), row-major. */
      cells: Pos[];
      colors: Color[];
      /** Cells that were part of a 3+ line (subset of cells ∪ created positions). */
      matched: Pos[];
      created: CreatedSpecial[];
      blasts: Blast[];
      /** Crates hit this round with their hp afterwards (0 = destroyed). */
      crateHits: { pos: Pos; hp: number }[];
      thawed: Pos[];
    }
  | { type: 'CELLS_FELL'; turn: number; cascadeIndex: number; falls: FallStep[] }
  | { type: 'CELLS_SPAWNED'; turn: number; cascadeIndex: number; spawns: SpawnStep[] }
  | { type: 'OBJECTIVES_UPDATED'; turn: number; progress: Progress; objectives: ObjectiveProgress[] }
  | { type: 'TURN_COMPLETED'; turn: number; remainingMoves: number }
  | { type: 'LEVEL_WON'; turn: number }
  | { type: 'LEVEL_LOST'; turn: number };

export interface TurnResult {
  nextState: GameState;
  events: TurnEvent[];
}

export type EngineErrorCode = 'ENGINE_CASCADE_LIMIT' | 'ENGINE_INVALID_MOVE' | 'ENGINE_NOT_READY';

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

export type MatchEvent = Extract<TurnEvent, { type: 'MATCH_REMOVED' }>;
