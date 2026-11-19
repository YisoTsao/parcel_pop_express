import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { useGame } from './game/state/gameStore';
import { useLayout } from './game/render3d/layoutStore';
import { LEVELS } from './game/data/levels';
import './styles/tokens.css';
import './styles/game.css';

// Note: no <StrictMode>; its dev-only double mount would dispose the imperative
// BoardView/GPU resources created in useMemo. Effects are written to be cleanup-safe.
createRoot(document.getElementById('root')!).render(<App />);

// Read-only debug/E2E hook (dev server or ?e2e=1). Exposes store snapshots, never rules.
if (import.meta.env.DEV || new URLSearchParams(location.search).has('e2e')) {
  (window as unknown as { __ppe: unknown }).__ppe = {
    state: () => useGame.getState(),
    rows: () => useLayout.getState().rows,
    levels: () => LEVELS,
  };
}
