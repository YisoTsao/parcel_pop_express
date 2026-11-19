import { beforeEach, describe, expect, it } from 'vitest';
import { useGame } from '../../src/game/state/gameStore';
import { getLevel, LEVELS } from '../../src/game/data/levels';
import { applyMove, createGameState, type Move } from '../../src/game/engine';

const L1 = getLevel(1)!;
const witness = L1.witnessMoves as Move[];

/** Submit and immediately complete a turn, as the presenter would. */
function play(move: Move) {
  expect(useGame.getState().submitMove(move)).toBe(true);
  useGame.getState().finishTurn(useGame.getState().pending!.id);
}

describe('game store flow', () => {
  beforeEach(() => useGame.getState().startLevel(1));

  it('U03 locks input while resolving: a second submit is ignored', () => {
    const s = useGame.getState();
    expect(s.submitMove({ line: 'row', index: 0, direction: 'left' })).toBe(true);
    expect(useGame.getState().phase).toBe('resolving');
    expect(useGame.getState().submitMove({ line: 'row', index: 0, direction: 'left' })).toBe(false);
    expect(useGame.getState().game!.remainingMoves).toBe(L1.moveLimit - 1);
  });

  it('rejects column moves on a rows-only level without spending a move', () => {
    expect(L1.allowColumnMoves).toBe(false);
    expect(useGame.getState().submitMove({ line: 'col', index: 0, direction: 'up' })).toBe(false);
    expect(useGame.getState().game!.remainingMoves).toBe(L1.moveLimit);
  });

  it('accepts column moves where the level allows them and selects that column', () => {
    useGame.getState().startLevel(6);
    expect(useGame.getState().submitMove({ line: 'col', index: 4, direction: 'down' })).toBe(true);
    expect(useGame.getState().selected.c).toBe(4);
  });

  it('HUD only advances through presenter callbacks, then syncs on finish', () => {
    for (const m of witness.slice(0, -1)) play(m);
    const before = useGame.getState().hud!.remainingMoves;
    useGame.getState().submitMove(witness[witness.length - 1]!);
    const { pending } = useGame.getState();
    expect(useGame.getState().hud!.remainingMoves).toBe(before);
    expect(useGame.getState().game!.status).toBe('won');
    useGame.getState().onHudProgress(pending!.id, pending!.nextState.progress);
    expect(useGame.getState().hud!.progress.every((p) => p.done)).toBe(true);
    useGame.getState().finishTurn(pending!.id);
    expect(useGame.getState().phase).toBe('result');
    expect(useGame.getState().hud!.remainingMoves).toBe(before - 1);
    expect(useGame.getState().save.completedLevelIds).toContain(1);
  });

  it('U04 restart cancels the pending turn and ignores stale callbacks', () => {
    useGame.getState().submitMove({ line: 'row', index: 0, direction: 'left' });
    const stale = useGame.getState().pending!.id;
    const sessionBefore = useGame.getState().session;
    useGame.getState().restart();
    expect(useGame.getState().session).toBe(sessionBefore + 1);
    useGame.getState().onHudMoves(stale, 0);
    useGame.getState().finishTurn(stale);
    expect(useGame.getState().phase).toBe('idle');
    expect(useGame.getState().hud!.remainingMoves).toBe(L1.moveLimit);
    expect(useGame.getState().game).toEqual(createGameState(L1));
  });

  it('store result equals a direct engine replay (no rules in the store)', () => {
    let s = createGameState(L1);
    for (const m of witness) {
      play(m);
      s = applyMove(s, m).nextState;
    }
    expect(useGame.getState().game).toEqual(s);
  });

  it('nextLevel advances and wraps to select after the last level', () => {
    useGame.getState().nextLevel();
    expect(useGame.getState().levelId).toBe(2);
    useGame.getState().startLevel(LEVELS[LEVELS.length - 1]!.id);
    useGame.getState().nextLevel();
    expect(useGame.getState().screen).toBe('select');
  });
});
