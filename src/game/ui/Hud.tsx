import { useGame } from '../state/gameStore';
import { ParcelIcon } from './ParcelIcon';
import { PARCEL_NAME } from '../../shared/parcelStyle';

export function ObjectiveBar() {
  const hud = useGame((s) => s.hud);
  const levelId = useGame((s) => s.levelId);
  if (!hud) return null;
  return (
    <section className="card goals" aria-label="配送目標">
      <div className="goals-head">
        <span className="pill">第 {String(levelId).padStart(2, '0')} 關</span>
        <span className="goals-title">配送目標</span>
      </div>
      <ul className="goal-list">
        {hud.progress.map((p) => (
          <li key={p.color} className={`goal ${p.done ? 'done' : ''}`} data-testid={`goal-${p.color}`}>
            <ParcelIcon color={p.color} size={34} />
            <span className="goal-count" aria-label={`${PARCEL_NAME[p.color]} ${p.current} / ${p.target}`}>
              {p.current}/{p.target}
            </span>
            {p.done && <span className="check" aria-hidden>✓</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function MoveCounter() {
  const hud = useGame((s) => s.hud);
  if (!hud) return null;
  const low = hud.remainingMoves <= 2;
  return (
    <section className={`card moves ${low ? 'low' : ''}`} aria-label="剩餘步數">
      <span className="moves-label">剩餘步數</span>
      <span className="moves-num" data-testid="moves" aria-live="polite">
        {hud.remainingMoves}
      </span>
    </section>
  );
}
