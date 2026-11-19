import { useGame } from '../game/state/gameStore';
import { GameShell } from './GameShell';
import { HomeScreen } from '../game/ui/HomeScreen';
import { LevelSelect } from '../game/ui/LevelSelect';
import { SettingsPanel } from '../game/ui/SettingsPanel';

export function App() {
  const screen = useGame((s) => s.screen);
  return (
    <div className="app">
      <div className="bg" aria-hidden>
        <span className="cloud c1" />
        <span className="cloud c2" />
        <span className="hill" />
      </div>
      <div className="frame">
        {screen === 'home' && <HomeScreen />}
        {screen === 'select' && <LevelSelect />}
        {screen === 'playing' && <GameShell />}
      </div>
      <SettingsPanel />
    </div>
  );
}
