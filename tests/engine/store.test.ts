import { beforeEach, describe, expect, it } from 'vitest';
import { useGame } from '../../src/game/state/gameStore';
import { getLevel } from '../../src/game/data/levels';
import { createGameState } from '../../src/game/engine';

describe('game store flow', () => {
  beforeEach(() => useGame.getState().startLevel(1));

  it('U03 locks input while resolving: a second submit is ignored', () => {
    const s = useGame.getState();
    expect(s.submitMove({ row: 0, direction: 'left' })).toBe(true);
    expect(useGame.getState().phase).toBe('resolving');
    expect(useGame.getState().submitMove({ row: 0, direction: 'left' })).toBe(false);
    expect(useGame.getState().game!.remainingMoves).toBe(4);
  });

  it('HUD only advances through presenter callbacks, then syncs on finish', () => {
    useGame.getState().submitMove({ row: 5, direction: 'left' });
    const { pending } = useGame.getState();
    expect(useGame.getState().hud!.remainingMoves).toBe(5);
    expect(useGame.getState().game!.status).toBe('won');
    useGame.getState().finishTurn(pending!.id);
    expect(useGame.getState().phase).toBe('result');
    expect(useGame.getState().hud!.remainingMoves).toBe(4);
    expect(useGame.getState().save.completedLevelIds).toContain(1);
  });

  it('U04 restart cancels the pending turn and ignores stale callbacks', () => {
    useGame.getState().submitMove({ row: 0, direction: 'left' });
    const stale = useGame.getState().pending!.id;
    const sessionBefore = useGame.getState().session;
    useGame.getState().restart();
    expect(useGame.getState().session).toBe(sessionBefore + 1);
    useGame.getState().onHudMoves(stale, 0);
    useGame.getState().finishTurn(stale);
    expect(useGame.getState().phase).toBe('idle');
    expect(useGame.getState().hud!.remainingMoves).toBe(5);
    expect(useGame.getState().game).toEqual(createGameState(getLevel(1)!));
  });

  it('nextLevel advances and wraps to select after the last level', () => {
    useGame.getState().nextLevel();
    expect(useGame.getState().levelId).toBe(2);
    useGame.getState().startLevel(10);
    useGame.getState().nextLevel();
    expect(useGame.getState().screen).toBe('select');
  });
});
