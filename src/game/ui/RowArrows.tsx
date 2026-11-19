import { useGame } from '../state/gameStore';
import { useLayout } from '../render3d/layoutStore';
import { unlockAudio } from '../../shared/audio';

/** Accessible left/right buttons beside the selected row; same path as a swipe (submitMove). */
export function RowArrows() {
  const rows = useLayout((s) => s.rows);
  const row = useGame((s) => s.selectedRow);
  const phase = useGame((s) => s.phase);
  const status = useGame((s) => s.game?.status);
  const submit = useGame((s) => s.submitMove);
  const a = rows?.[row];
  if (!a) return null;
  const disabled = phase !== 'idle' || status !== 'ready';
  const size = Math.max(36, Math.min(48, a.height));
  const style = (x: number) => ({ top: a.y - size / 2, left: x - size / 2, width: size, height: size });
  return (
    <>
      <button
        className="row-arrow left"
        style={style(a.left + size * 0.12)}
        disabled={disabled}
        aria-label={`第 ${row + 1} 排向左移`}
        data-testid="arrow-left"
        onClick={() => {
          unlockAudio();
          submit({ row, direction: 'left' });
        }}
      >
        ◀
      </button>
      <button
        className="row-arrow right"
        style={style(a.right - size * 0.12)}
        disabled={disabled}
        aria-label={`第 ${row + 1} 排向右移`}
        data-testid="arrow-right"
        onClick={() => {
          unlockAudio();
          submit({ row, direction: 'right' });
        }}
      >
        ▶
      </button>
    </>
  );
}
