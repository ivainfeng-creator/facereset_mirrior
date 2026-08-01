import { useMemo, useState } from 'react';
import CameraPermission from './components/CameraPermission.jsx';
import LandingScreen from './components/LandingScreen.jsx';
import LeaderboardScreen from './components/LeaderboardScreen.jsx';
import MirrorScreen from './components/MirrorScreen.jsx';
import PassportScreen from './components/PassportScreen.jsx';
import PracticeScreen from './components/PracticeScreen.jsx';
import ResultScreen from './components/ResultScreen.jsx';
import RoutineScreen from './components/RoutineScreen.jsx';
import ThemeScreen from './components/ThemeScreen.jsx';
import { SCENE_IDS } from './data/scenes.js';
import { hasSeenGuide, loadHabitProgress, markGuideSeen, saveSessionResult } from './utils/progressAdapter.js';

const SCREENS = {
  landing: 'landing',
  permission: 'permission',
  mirror: 'mirror',
  theme: 'theme',
  practice: 'practice',
  routine: 'routine',
  result: 'result',
  passport: 'passport',
  leaderboard: 'leaderboard',
};

const isDemoPreview = new URLSearchParams(window.location.search).get('demo') === '1';

export default function App() {
  const [screen, setScreen] = useState(isDemoPreview ? SCREENS.theme : SCREENS.landing);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [isDemoMode, setIsDemoMode] = useState(isDemoPreview);
  const [latestResult, setLatestResult] = useState(null);
  const [selectedScene, setSelectedScene] = useState(SCENE_IDS.whaleDream);
  const habit = useMemo(() => loadHabitProgress(), [latestResult]);

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
    if (hasSeenGuide(sceneId)) {
      setScreen(SCREENS.routine);
      return;
    }
    setScreen(SCREENS.practice);
  };

  const openGuide = (sceneId) => {
    setSelectedScene(sceneId);
    setScreen(SCREENS.practice);
  };

  const beginRoutine = () => {
    markGuideSeen(selectedScene);
    setScreen(SCREENS.routine);
  };

  const finishRoutine = (result) => {
    const { saved } = saveSessionResult(result);
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
          onGuide={openGuide}
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
          onExit={() => setScreen(SCREENS.theme)}
        />
      )}

      {screen === SCREENS.result && (
        <ResultScreen
          result={latestResult}
          habit={habit}
          onRestart={restartRoutine}
          onPassport={() => setScreen(SCREENS.passport)}
          onLeaderboard={() => setScreen(SCREENS.leaderboard)}
        />
      )}

      {screen === SCREENS.passport && (
        <PassportScreen
          habit={habit}
          onBack={() => setScreen(SCREENS.result)}
          onLeaderboard={() => setScreen(SCREENS.leaderboard)}
          onRestart={restartRoutine}
        />
      )}

      {screen === SCREENS.leaderboard && (
        <LeaderboardScreen
          habit={habit}
          onBack={() => setScreen(SCREENS.result)}
          onRestart={restartRoutine}
        />
      )}
    </main>
  );
}
