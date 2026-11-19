import { useEffect } from 'react';
import { useGame } from '../game/state/gameStore';
import { GameCanvas } from '../game/render3d/GameCanvas';
import { MoveCounter, ObjectiveBar } from '../game/ui/Hud';
import { RowArrows } from '../game/ui/RowArrows';
import { ComboToast } from '../game/ui/ComboToast';
import { ResultModal } from '../game/ui/ResultModal';
import { unlockAudio } from '../shared/audio';
import { getLevel } from '../game/data/levels';

function LevelHint() {
  const levelId = useGame((s) => s.levelId);
  const cols = useGame((s) => s.game?.allowColumnMoves ?? false);
  const hint = getLevel(levelId)?.hint;
  return (
    <p className="hint" data-testid="level-hint">
      <span aria-hidden>{cols ? '✥' : '⟷'}</span> {hint ?? (cols ? '左右滑動整排、上下滑動整欄，湊出 3 個同色' : '左右滑動整排貨箱，湊出 3 個同色')}
    </p>
  );
}

/** Playing screen: DOM HUD on top, the WebGL board in the middle, controls below. */
export function GameShell() {
  const { restart, goto, toggleSettings, select, submitMove } = useGame.getState();
  const sound = useGame((s) => s.save.soundEnabled);
  const engineError = useGame((s) => s.engineError);

  // Keyboard (UI_UX_SPEC §4, v2): ←/→ shift the selected row; ↑/↓ shift the selected column
  // when the level allows it (otherwise they pick a row); W/A/S/D move the selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useGame.getState();
      if (s.showSettings || s.phase === 'result') return;
      if (e.target instanceof HTMLElement && e.target.closest('input, .modal')) return;
      unlockAudio();
      const { r, c } = s.selected;
      const cols = s.game?.allowColumnMoves ?? false;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === 'ArrowLeft' || k === 'ArrowRight') submitMove({ line: 'row', index: r, direction: k === 'ArrowLeft' ? 'left' : 'right' });
      else if ((k === 'ArrowUp' || k === 'ArrowDown') && cols) submitMove({ line: 'col', index: c, direction: k === 'ArrowUp' ? 'up' : 'down' });
      else if (k === 'ArrowUp' || k === 'w') select(Math.max(0, r - 1), c);
      else if (k === 'ArrowDown' || k === 's') select(Math.min(5, r + 1), c);
      else if (k === 'a') select(r, Math.max(0, c - 1));
      else if (k === 'd') select(r, Math.min(5, c + 1));
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [select, submitMove]);

  return (
    <div className="screen playing">
      <header className="topbar">
        <button className="icon-btn" aria-label="返回選關" onClick={() => goto('select')}>
          ‹
        </button>
        <h1 className="brand">轉轉物流局</h1>
        <button className="icon-btn" aria-label="設定" onClick={() => toggleSettings(true)}>
          ⚙
        </button>
      </header>
      <div className="hud-row">
        <ObjectiveBar />
        <MoveCounter />
      </div>
      <main className="board-area">
        <GameCanvas />
        <RowArrows />
        <ComboToast />
      </main>
      <LevelHint />
      <footer className="controls">
        <button className="btn secondary" data-testid="restart" onClick={() => restart()}>
          ↺ 重新開始
        </button>
        <button
          className="btn ghost"
          aria-pressed={sound}
          onClick={() => {
            unlockAudio();
            useGame.getState().setSettings({ soundEnabled: !sound });
          }}
        >
          {sound ? '🔊 音效開' : '🔇 音效關'}
        </button>
      </footer>
      <ResultModal />
      {engineError && (
        <div className="modal-backdrop" role="alertdialog">
          <div className="modal">
            <h2>引擎錯誤（開發用）</h2>
            <pre className="err">{engineError}</pre>
            <div className="modal-actions">
              <button className="btn primary" onClick={() => restart()}>
                重新開始
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
