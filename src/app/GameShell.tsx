import { useEffect } from 'react';
import { useGame } from '../game/state/gameStore';
import { GameCanvas } from '../game/render3d/GameCanvas';
import { MoveCounter, ObjectiveBar } from '../game/ui/Hud';
import { RowArrows } from '../game/ui/RowArrows';
import { ComboToast } from '../game/ui/ComboToast';
import { ResultModal } from '../game/ui/ResultModal';
import { unlockAudio } from '../shared/audio';

/** Playing screen: DOM HUD on top, the WebGL board in the middle, controls below. */
export function GameShell() {
  const { restart, goto, toggleSettings, selectRow, submitMove } = useGame.getState();
  const sound = useGame((s) => s.save.soundEnabled);
  const engineError = useGame((s) => s.engineError);

  // Keyboard: ↑/↓ choose a row, ←/→ shift it (UI_UX_SPEC §4).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useGame.getState();
      if (s.showSettings || s.phase === 'result') return;
      if (e.target instanceof HTMLElement && e.target.closest('input, .modal')) return;
      unlockAudio();
      if (e.key === 'ArrowUp') selectRow(Math.max(0, s.selectedRow - 1));
      else if (e.key === 'ArrowDown') selectRow(Math.min(5, s.selectedRow + 1));
      else if (e.key === 'ArrowLeft') submitMove({ row: s.selectedRow, direction: 'left' });
      else if (e.key === 'ArrowRight') submitMove({ row: s.selectedRow, direction: 'right' });
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectRow, submitMove]);

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
      <p className="hint">
        <span aria-hidden>⟷</span> 左右滑動整排貨箱，湊出 3 個同色
      </p>
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
