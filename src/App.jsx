import { useEffect, useMemo, useRef, useState } from 'react';
import CameraPermission from './components/CameraPermission.jsx';
import LandingScreen from './components/LandingScreen.jsx';
import LeaderboardScreen from './components/LeaderboardScreen.jsx';
import MirrorScreen from './components/MirrorScreen.jsx';
import PassportScreen from './components/PassportScreen.jsx';
import PracticeScreen from './components/PracticeScreen.jsx';
import ProgressDebugPanel from './components/ProgressDebugPanel.jsx';
import ResultScreen from './components/ResultScreen.jsx';
import RoutineScreen from './components/RoutineScreen.jsx';
import ThemeScreen from './components/ThemeScreen.jsx';
import { SCENE_IDS } from './data/scenes.js';
import { buildDailyPlanSummary } from './utils/dailyPlan.js';
import { getViverseAuthSnapshot, initializeViverseAuth } from './utils/viverseClient.js';
import {
  hasSeenGuide,
  initializeProgressSync,
  loadHabitProgress,
  markGuideSeen,
  saveSessionResult,
} from './utils/progressAdapter.js';

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
const isProgressDebug = new URLSearchParams(window.location.search).get('debug') === '1';
const isResultPreview = import.meta.env.DEV
  && new URLSearchParams(window.location.search).get('result') === '1';
const WELCOME_TRANSITION_MS = 1020;

const RESULT_PREVIEW = {
  type: 'daily-plan',
  completed: 3,
  total: 3,
  isComplete: true,
  score: 280,
  maxScore: 300,
  holdSeconds: 52,
  sceneTitle: 'FULL RESET COMPLETE',
  area: 'ALL 3 SESSIONS',
  programDay: 1,
  sceneResults: [
    { sceneId: SCENE_IDS.whaleDream, sceneTitle: 'Whale Mouth', score: 93, completed: true },
    { sceneId: SCENE_IDS.templeGarden, sceneTitle: 'Cloud Garden', score: 93, completed: true },
    { sceneId: SCENE_IDS.flowerCollector, sceneTitle: 'Flower Collector', score: 94, completed: true },
  ],
  radar: [
    { label: 'movement', value: 84 },
    { label: 'hold', value: 78 },
    { label: 'control', value: 86 },
    { label: 'smoothness', value: 81 },
    { label: 'relaxation', value: 76 },
  ],
};

export default function App() {
  const [screen, setScreen] = useState(
    isResultPreview ? SCREENS.result : (isDemoPreview ? SCREENS.theme : SCREENS.landing),
  );
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [isDemoMode, setIsDemoMode] = useState(isDemoPreview);
  const [latestResult, setLatestResult] = useState(isResultPreview ? RESULT_PREVIEW : null);
  const [progressRevision, setProgressRevision] = useState(0);
  const [selectedScene, setSelectedScene] = useState(SCENE_IDS.whaleDream);
  const [autoStartCamera, setAutoStartCamera] = useState(false);
  const [screenTransition, setScreenTransition] = useState(null);
  const [viverseAuth, setViverseAuth] = useState(getViverseAuthSnapshot);
  const transitionTimerRef = useRef(null);
  const habit = useMemo(() => loadHabitProgress(), [latestResult, progressRevision]);

  useEffect(() => () => window.clearTimeout(transitionTimerRef.current), []);

  useEffect(() => {
    let isMounted = true;
    void initializeProgressSync({
      onMerged: () => {
        if (isMounted) setProgressRevision((value) => value + 1);
      },
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    void initializeViverseAuth().then((snapshot) => {
      if (isMounted) setViverseAuth(snapshot);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const startTodayPlan = () => {
    if (screenTransition) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setScreen(SCREENS.theme);
      return;
    }

    setScreenTransition('welcome-to-plan');
    transitionTimerRef.current = window.setTimeout(() => {
      setScreen(SCREENS.theme);
      setScreenTransition(null);
    }, WELCOME_TRANSITION_MS);
  };

  const handleCameraReady = (stream) => {
    setCameraStream(stream);
    setCameraError('');
    setAutoStartCamera(false);
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
    setAutoStartCamera(false);
  };

  const beginSelectedScene = () => {
    if (hasSeenGuide(selectedScene)) {
      setScreen(SCREENS.routine);
      return;
    }

    setScreen(SCREENS.practice);
  };

  const selectTheme = (sceneId) => {
    setSelectedScene(sceneId);

    if (cameraStream || isDemoMode) {
      setScreen(SCREENS.mirror);
      return;
    }

    setAutoStartCamera(true);
    setScreen(SCREENS.permission);
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
    saveSessionResult(result, {
      onMerged: () => setProgressRevision((value) => value + 1),
    });
    const updatedHabit = loadHabitProgress();
    const dailyPlan = buildDailyPlanSummary(updatedHabit);

    if (dailyPlan.isComplete) {
      setLatestResult({
        ...dailyPlan,
        snapshots: result.snapshots || [],
      });
    } else {
      setLatestResult(null);
    }
    setProgressRevision((value) => value + 1);
    setScreen(SCREENS.theme);
  };

  const openDailyResult = () => {
    const dailyPlan = buildDailyPlanSummary(loadHabitProgress());

    if (!dailyPlan.isComplete) return;

    setLatestResult((current) => ({
      ...dailyPlan,
      snapshots: current?.snapshots || [],
    }));
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
        <LandingScreen
          onStart={startTodayPlan}
          habit={habit}
          isExiting={screenTransition === 'welcome-to-plan'}
        />
      )}

      {screen === SCREENS.permission && (
        <CameraPermission
          cameraError={cameraError}
          autoStart={autoStartCamera}
          onCameraReady={handleCameraReady}
          onCameraError={handleCameraError}
          onBack={() => {
            setAutoStartCamera(false);
            setScreen(SCREENS.theme);
          }}
        />
      )}

      {screen === SCREENS.mirror && (
        <MirrorScreen
          stream={cameraStream}
          isDemoMode={isDemoMode}
          onBegin={beginSelectedScene}
          onBack={() => setScreen(SCREENS.theme)}
        />
      )}

      {(screen === SCREENS.theme || screenTransition === 'welcome-to-plan') && (
        <ThemeScreen
          selectedScene={selectedScene}
          onSelect={selectTheme}
          onGuide={openGuide}
          onBack={resetToLanding}
          onContinue={openDailyResult}
          habit={habit}
          isEntering={screenTransition === 'welcome-to-plan'}
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
          onTodayPlan={() => setScreen(SCREENS.theme)}
          onPassport={() => setScreen(SCREENS.passport)}
          onLeaderboard={() => setScreen(SCREENS.leaderboard)}
          onProgressChanged={() => setProgressRevision((revision) => revision + 1)}
          shouldPromptForDisplayName={!isResultPreview}
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

      {isProgressDebug && (
        <ProgressDebugPanel onProgressChange={() => setProgressRevision((value) => value + 1)} />
      )}
    </main>
  );
}
