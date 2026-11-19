import { useGame } from '../state/gameStore';
import { ParcelIcon } from './ParcelIcon';

export function HomeScreen() {
  const last = useGame((s) => s.save.lastLevelId);
  const done = useGame((s) => s.save.completedLevelIds.length);
  const { startLevel, goto, toggleSettings } = useGame.getState();
  return (
    <div className="screen home">
      <div className="logo">
        <div className="logo-boxes" aria-hidden>
          <ParcelIcon color="R" size={44} />
          <ParcelIcon color="B" size={44} />
          <ParcelIcon color="G" size={44} />
          <ParcelIcon color="Y" size={44} />
        </div>
        <h1>轉轉物流局</h1>
        <p className="en">Parcel Pop Express</p>
      </div>
      <div className="card howto">
        <p>
          <strong>左右滑動整排貨箱</strong>，一次移動一格（會從另一邊轉回來）。
        </p>
        <p>直排或橫排湊出 3 個同色就能出貨，在步數內完成配送訂單！</p>
      </div>
      <div className="home-actions">
        <button className="btn primary big" data-testid="continue" onClick={() => startLevel(last)}>
          {done > 0 ? `繼續第 ${last} 關` : '開始配送'}
        </button>
        <button className="btn secondary" onClick={() => goto('select')}>
          選擇關卡（已完成 {done}/10）
        </button>
        <button className="btn ghost" onClick={() => toggleSettings(true)}>
          設定
        </button>
      </div>
    </div>
  );
}
