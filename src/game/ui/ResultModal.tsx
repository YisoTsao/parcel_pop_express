import { useGame } from '../state/gameStore';
import { LEVELS } from '../data/levels';
import { objectiveProgress } from '../engine';
import { GoalIcon } from './ParcelIcon';

export function ResultModal() {
  const phase = useGame((s) => s.phase);
  const game = useGame((s) => s.game);
  const { restart, nextLevel, goto } = useGame.getState();
  if (phase !== 'result' || !game) return null;
  const won = game.status === 'won';
  const progress = objectiveProgress(game.objectives, game.progress);
  const isLast = game.levelId === LEVELS[LEVELS.length - 1]!.id;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="result-title">
      <div className={`modal result ${won ? 'won' : 'lost'}`} data-testid={won ? 'result-won' : 'result-lost'}>
        {won && <div className="stamp" aria-hidden>已送達</div>}
        <h2 id="result-title" className="ribbon">
          {won ? '配送完成！' : '差一點就送到了'}
        </h2>
        <p className="sub">第 {game.levelId} 關</p>
        <ul className="goal-list result-goals">
          {progress.map((p) => (
            <li key={p.color ?? p.type} className={`goal ${p.done ? 'done' : 'miss'}`}>
              <GoalIcon type={p.type} color={p.color} size={34} />
              <span className="goal-count">
                {p.current}/{p.target}
              </span>
              {p.done ? <span className="check">✓</span> : <span className="miss-note">還差 {p.target - p.current}</span>}
            </li>
          ))}
        </ul>
        {won && (
          <dl className="stats">
            <div>
              <dt>使用步數</dt>
              <dd>{game.moveLimit - game.remainingMoves}</dd>
            </div>
            <div>
              <dt>清除貨箱</dt>
              <dd>{game.totalCleared}</dd>
            </div>
            <div>
              <dt>特殊箱</dt>
              <dd>{game.specialsCreated}</dd>
            </div>
            <div>
              <dt>最高連鎖</dt>
              <dd>{game.maxCombo}</dd>
            </div>
          </dl>
        )}
        <div className="modal-actions">
          <button className="btn secondary" onClick={() => goto('select')}>
            選關
          </button>
          {won ? (
            <button className="btn primary" data-testid="next-level" onClick={() => nextLevel()} autoFocus>
              {isLast ? '回到選關' : '下一關 ›'}
            </button>
          ) : (
            <button className="btn primary" data-testid="retry" onClick={() => restart()} autoFocus>
              重新開始
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
