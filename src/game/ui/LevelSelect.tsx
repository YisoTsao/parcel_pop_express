import { useGame } from '../state/gameStore';
import { LEVELS } from '../data/levels';
import { GoalIcon } from './ParcelIcon';

export function LevelSelect() {
  const done = useGame((s) => s.save.completedLevelIds);
  const { startLevel, goto } = useGame.getState();
  return (
    <div className="screen select">
      <header className="topbar">
        <button className="icon-btn" aria-label="返回首頁" onClick={() => goto('home')}>
          ‹
        </button>
        <h1>選擇關卡</h1>
        <span className="spacer" />
      </header>
      <ul className="level-grid">
        {LEVELS.map((l) => (
          <li key={l.id}>
            <button className={`level-card ${done.includes(l.id) ? 'done' : ''}`} onClick={() => startLevel(l.id)} data-testid={`level-${l.id}`}>
              <span className="lv-num">{l.id}</span>
              <span className="lv-name">{l.name}</span>
              <span className="lv-goals">
                {l.objectives.map((o) => (
                  <GoalIcon key={o.type === 'collectColor' ? o.color : o.type} type={o.type} color={o.type === 'collectColor' ? o.color : undefined} size={20} />
                ))}
                {l.allowColumnMoves && (
                  <span className="lv-cols" aria-label="可上下移動" title="可上下移動">
                    ↕
                  </span>
                )}
              </span>
              {done.includes(l.id) && <span className="badge" aria-label="已通關">✓</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
