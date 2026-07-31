import { useMemo, useState } from 'react';
import CameraPermission from './components/CameraPermission.jsx';
import LandingScreen from './components/LandingScreen.jsx';
import MirrorScreen from './components/MirrorScreen.jsx';
import PracticeScreen from './components/PracticeScreen.jsx';
import ResultScreen from './components/ResultScreen.jsx';
import RoutineScreen from './components/RoutineScreen.jsx';
import ThemeScreen from './components/ThemeScreen.jsx';
import { SCENE_IDS } from './data/scenes.js';
import { loadHabit, saveResult } from './utils/storage.js';

const SCREENS = {
  landing: 'landing',
  permission: 'permission',
  mirror: 'mirror',
  theme: 'theme',
  practice: 'practice',
  routine: 'routine',
  result: 'result',
};

export default function App() {
  const [screen, setScreen] = useState(SCREENS.landing);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [latestResult, setLatestResult] = useState(null);
  const [selectedScene, setSelectedScene] = useState(SCENE_IDS.whaleDream);
  const habit = useMemo(() => loadHabit(), [latestResult]);

  const startPermission = () => setScreen(SCREENS.permission);

  const handleCameraReady = (stream) => {
    setCameraStream(stream);
    setCameraError('');
    setIsDemoMode(false);
    setScreen(SCREENS.mirror);
  };

  const startDemoMode = () => {
    setCameraStream(null);
    setCameraError('');
    setIsDemoMode(true);
    setScreen(SCREENS.mirror);
  };

  const handleCameraError = (message) => {
    setCameraError(message);
    setCameraStream(null);
  };

  const beginThemeSelect = () => setScreen(SCREENS.theme);

  const selectTheme = (sceneId) => {
    setSelectedScene(sceneId);
    setScreen(SCREENS.practice);
  };

  const beginRoutine = () => setScreen(SCREENS.routine);

  const finishRoutine = (result) => {
    const saved = saveResult(result);
    setLatestResult({
      ...saved,
      snapshots: result.snapshots || [],
    });
    setScreen(SCREENS.result);
  };

  const restartRoutine = () => {
    setScreen(SCREENS.theme);
  };

  const resetToLanding = () => {
    setScreen(SCREENS.landing);
  };

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      {screen === SCREENS.landing && (
        <LandingScreen onStart={startPermission} habit={habit} />
      )}

      {screen === SCREENS.permission && (
        <CameraPermission
          cameraError={cameraError}
          onCameraReady={handleCameraReady}
          onCameraError={handleCameraError}
          onBack={resetToLanding}
        />
      )}

      {screen === SCREENS.mirror && (
        <MirrorScreen
          stream={cameraStream}
          isDemoMode={isDemoMode}
          onBegin={beginThemeSelect}
          onBack={startPermission}
        />
      )}

      {screen === SCREENS.theme && (
        <ThemeScreen
          selectedScene={selectedScene}
          onSelect={selectTheme}
          onBack={() => setScreen(SCREENS.mirror)}
        />
      )}

      {screen === SCREENS.practice && (
        <PracticeScreen
          selectedScene={selectedScene}
          stream={cameraStream}
          isDemoMode={isDemoMode}
          onBegin={beginRoutine}
          onBack={() => setScreen(SCREENS.theme)}
        />
      )}

      {screen === SCREENS.routine && (
        <RoutineScreen
          stream={cameraStream}
          isDemoMode={isDemoMode}
          selectedScene={selectedScene}
          onComplete={finishRoutine}
          onExit={() => setScreen(SCREENS.practice)}
        />
      )}

      {screen === SCREENS.result && (
        <ResultScreen
          result={latestResult}
          habit={habit}
          onRestart={restartRoutine}
        />
      )}
    </main>
  );
}
