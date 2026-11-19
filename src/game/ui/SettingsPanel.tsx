import { useGame } from '../state/gameStore';
import { RULE_VERSION } from '../engine';
import type { Quality } from '../../shared/storage';

const Q: { id: Quality; label: string }[] = [
  { id: 'low', label: '低' },
  { id: 'medium', label: '中' },
  { id: 'high', label: '高' },
];

export function SettingsPanel() {
  const open = useGame((s) => s.showSettings);
  const save = useGame((s) => s.save);
  const { setSettings, toggleSettings } = useGame.getState();
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={() => toggleSettings(false)}>
      <div className="modal settings" onClick={(e) => e.stopPropagation()}>
        <h2 id="settings-title">設定</h2>
        <label className="row-setting">
          <span>音效</span>
          <input type="checkbox" checked={save.soundEnabled} onChange={(e) => setSettings({ soundEnabled: e.target.checked })} />
        </label>
        <label className="row-setting">
          <span>減少動態效果</span>
          <input type="checkbox" checked={save.reducedMotion} onChange={(e) => setSettings({ reducedMotion: e.target.checked })} />
        </label>
        <div className="row-setting">
          <span>畫質</span>
          <div className="seg" role="radiogroup" aria-label="畫質">
            {Q.map((q) => (
              <button
                key={q.id}
                role="radio"
                aria-checked={save.graphicsQuality === q.id}
                className={save.graphicsQuality === q.id ? 'on' : ''}
                onClick={() => setSettings({ graphicsQuality: q.id })}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>
        <p className="version">Web Demo v1.1 · 規則 {RULE_VERSION}</p>
        <div className="modal-actions">
          <button className="btn primary" onClick={() => toggleSettings(false)} autoFocus>
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
