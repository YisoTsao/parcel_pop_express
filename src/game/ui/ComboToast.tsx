import { useGame } from '../state/gameStore';

export function ComboToast() {
  const combo = useGame((s) => s.combo);
  const phase = useGame((s) => s.phase);
  if (!combo || phase !== 'resolving') return null;
  return (
    <div key={combo.key} className={`combo-toast c${Math.min(combo.n, 4)}`} aria-live="polite">
      連鎖 ×{combo.n}!
    </div>
  );
}
