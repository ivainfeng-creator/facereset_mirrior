import { useMemo, useState } from 'react';
import CameraPermission from './components/CameraPermission.jsx';
import LandingScreen from './components/LandingScreen.jsx';
import MirrorScreen from './components/MirrorScreen.jsx';
import PracticeScreen from './components/PracticeScreen.jsx';
import ResultScreen from './components/ResultScreen.jsx';
import RoutineScreen from './components/RoutineScreen.jsx';
import { loadHabit, saveResult } from './utils/storage.js';

const SCREENS = {
  landing: 'landing',
  permission: 'permission',
  mirror: 'mirror',
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

  const beginPractice = () => setScreen(SCREENS.practice);

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
    setScreen(SCREENS.mirror);
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
          onBegin={beginPractice}
          onBack={startPermission}
        />
      )}

      {screen === SCREENS.practice && (
        <PracticeScreen
          stream={cameraStream}
          isDemoMode={isDemoMode}
          onBegin={beginRoutine}
          onBack={() => setScreen(SCREENS.mirror)}
        />
      )}

      {screen === SCREENS.routine && (
        <RoutineScreen
          stream={cameraStream}
          isDemoMode={isDemoMode}
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
