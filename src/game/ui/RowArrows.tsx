import { useGame } from '../state/gameStore';
import { useLayout } from '../render3d/layoutStore';
import { unlockAudio } from '../../shared/audio';
import type { Move } from '../engine';

/**
 * Accessible arrow buttons: left/right beside the selected row, and (when the level allows
 * column moves) up/down above/below the selected column. Same path as a swipe (submitMove).
 */
export function RowArrows() {
  const rows = useLayout((s) => s.rows);
  const cols = useLayout((s) => s.cols);
  const sel = useGame((s) => s.selected);
  const phase = useGame((s) => s.phase);
  const status = useGame((s) => s.game?.status);
  const allowCols = useGame((s) => s.game?.allowColumnMoves ?? false);
  const submit = useGame((s) => s.submitMove);
  const a = rows?.[sel.r];
  const col = cols?.[sel.c];
  if (!a) return null;
  const disabled = phase !== 'idle' || status !== 'ready';
  const size = Math.max(36, Math.min(48, a.height));
  const style = (x: number, y: number) => ({ top: y - size / 2, left: x - size / 2, width: size, height: size });
  const btn = (key: string, cls: string, pos: { x: number; y: number }, label: string, move: Move, glyph: string) => (
    <button
      key={key}
      className={`row-arrow ${cls}`}
      style={style(pos.x, pos.y)}
      disabled={disabled}
      aria-label={label}
      data-testid={`arrow-${key}`}
      onClick={() => {
        unlockAudio();
        submit(move);
      }}
    >
      {glyph}
    </button>
  );
  return (
    <>
      {btn('left', 'left', { x: a.left + size * 0.12, y: a.y }, `第 ${sel.r + 1} 排向左移`, { line: 'row', index: sel.r, direction: 'left' }, '◀')}
      {btn('right', 'right', { x: a.right - size * 0.12, y: a.y }, `第 ${sel.r + 1} 排向右移`, { line: 'row', index: sel.r, direction: 'right' }, '▶')}
      {allowCols && col && btn('up', 'up', { x: col.x, y: col.topY - size * 0.1 }, `第 ${sel.c + 1} 欄向上移`, { line: 'col', index: sel.c, direction: 'up' }, '▲')}
      {allowCols && col && btn('down', 'down', { x: col.x, y: col.bottomY + size * 0.1 }, `第 ${sel.c + 1} 欄向下移`, { line: 'col', index: sel.c, direction: 'down' }, '▼')}
    </>
  );
}
