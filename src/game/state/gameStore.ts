/**
 * Game flow store. Holds the *committed* engine state and a separate HUD view that is
 * advanced by the presenter as it plays events, so goals never fill before the board
 * shows the clear (UI_UX_SPEC §3). It calls applyMove exactly once per input and never
 * decides matches itself.
 */
import { create } from 'zustand';
import { LEVELS, getLevel } from '../data/levels';
import {
  applyMove,
  createGameState,
  EngineError,
  objectiveProgress,
  type ColorCount,
  type GameState,
  type Move,
  type ObjectiveProgress,
  type TurnEvent,
} from '../engine';
import { loadSave, writeSave, type Quality, type SaveData } from '../../shared/storage';
import { setSoundEnabled } from '../../shared/audio';

export type Screen = 'home' | 'select' | 'playing';
export type Phase = 'idle' | 'resolving' | 'result';

export interface PendingTurn {
  id: number;
  session: number;
  events: TurnEvent[];
  nextState: GameState;
}

export interface HudView {
  remainingMoves: number;
  collected: ColorCount;
  progress: ObjectiveProgress[];
}

export interface GameStore {
  screen: Screen;
  levelId: number;
  game: GameState | null;
  hud: HudView | null;
  phase: Phase;
  /** Bumped on start/restart; the presenter resets and stale timelines abort. */
  session: number;
  turnSeq: number;
  pending: PendingTurn | null;
  combo: { n: number; key: number } | null;
  selectedRow: number;
  engineError: string | null;
  save: SaveData;
  showSettings: boolean;

  goto(screen: Screen): void;
  startLevel(id: number): void;
  restart(): void;
  nextLevel(): void;
  selectRow(row: number): void;
  submitMove(move: Move): boolean;
  /** Presenter callbacks (ignored if stale). */
  onHudMoves(turnId: number, remainingMoves: number): void;
  onHudObjectives(turnId: number, collected: ColorCount): void;
  onCombo(turnId: number, n: number): void;
  finishTurn(turnId: number): void;
  setSettings(patch: Partial<Pick<SaveData, 'soundEnabled' | 'reducedMotion' | 'graphicsQuality'>>): void;
  toggleSettings(open?: boolean): void;
}

function hudFrom(s: GameState): HudView {
  return { remainingMoves: s.remainingMoves, collected: { ...s.collected }, progress: objectiveProgress(s.objectives, s.collected) };
}

const initialSave = loadSave();
setSoundEnabled(initialSave.soundEnabled);

export const useGame = create<GameStore>((set, get) => ({
  screen: 'home',
  levelId: initialSave.lastLevelId,
  game: null,
  hud: null,
  phase: 'idle',
  session: 0,
  turnSeq: 0,
  pending: null,
  combo: null,
  selectedRow: 3,
  engineError: null,
  save: initialSave,
  showSettings: false,

  goto(screen) {
    set({ screen, pending: null, phase: 'idle', session: get().session + 1, combo: null, showSettings: false });
  },

  startLevel(id) {
    const level = getLevel(id);
    if (!level) return;
    const game = createGameState(level);
    const save = { ...get().save, lastLevelId: id };
    writeSave(save);
    set({
      screen: 'playing',
      levelId: id,
      game,
      hud: hudFrom(game),
      phase: 'idle',
      session: get().session + 1,
      pending: null,
      combo: null,
      engineError: null,
      save,
      showSettings: false,
    });
  },

  restart() {
    get().startLevel(get().levelId);
  },

  nextLevel() {
    const idx = LEVELS.findIndex((l) => l.id === get().levelId);
    const next = LEVELS[idx + 1];
    if (next) get().startLevel(next.id);
    else get().goto('select');
  },

  selectRow(row) {
    if (row >= 0 && row < 6) set({ selectedRow: row });
  },

  submitMove(move) {
    const { game, phase, session } = get();
    if (!game || phase !== 'idle' || game.status !== 'ready' || game.remainingMoves <= 0) return false;
    try {
      const { nextState, events } = applyMove(game, move);
      const id = get().turnSeq + 1;
      set({ game: nextState, phase: 'resolving', turnSeq: id, pending: { id, session, events, nextState }, selectedRow: move.row });
      return true;
    } catch (e) {
      const msg = e instanceof EngineError ? `${e.message}\n${JSON.stringify({ levelId: game.levelId, ...e.detail })}` : String(e);
      console.error(e);
      set({ engineError: msg });
      return false;
    }
  },

  onHudMoves(turnId, remainingMoves) {
    const { pending, hud } = get();
    if (!pending || pending.id !== turnId || !hud) return;
    set({ hud: { ...hud, remainingMoves } });
  },

  onHudObjectives(turnId, collected) {
    const { pending, hud, game } = get();
    if (!pending || pending.id !== turnId || !hud || !game) return;
    set({ hud: { ...hud, collected: { ...collected }, progress: objectiveProgress(game.objectives, collected) } });
  },

  onCombo(turnId, n) {
    const { pending } = get();
    if (!pending || pending.id !== turnId) return;
    set({ combo: { n, key: Date.now() } });
  },

  finishTurn(turnId) {
    const { pending, game, save } = get();
    if (!pending || pending.id !== turnId || !game) return;
    let nextSave = save;
    if (game.status === 'won' && !save.completedLevelIds.includes(game.levelId)) {
      nextSave = { ...save, completedLevelIds: [...save.completedLevelIds, game.levelId].sort((a, b) => a - b) };
      writeSave(nextSave);
    }
    set({
      pending: null,
      hud: hudFrom(game),
      phase: game.status === 'won' || game.status === 'lost' ? 'result' : 'idle',
      save: nextSave,
    });
  },

  setSettings(patch) {
    const save = { ...get().save, ...patch };
    if (patch.soundEnabled !== undefined) setSoundEnabled(patch.soundEnabled);
    writeSave(save);
    set({ save });
  },

  toggleSettings(open) {
    set({ showSettings: open ?? !get().showSettings });
  },
}));

export type { Quality };
