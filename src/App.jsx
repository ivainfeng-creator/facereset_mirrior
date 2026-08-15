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
import { DEFAULT_SCENE_ID, dailyScenes, getSceneById } from './data/scenes.js';
import { buildDailyPlanSummary } from './utils/dailyPlan.js';
import { isDebugHistoryEnabled, withDebugHistory } from './utils/debugHistory.js';
import { getActiveDebugSceneId } from './utils/debugScene.js';
import { getViverseAuthSnapshot, initializeViverseAuth } from './utils/viverseClient.js';
import { preloadSceneAudio, traceAudioLifecycle, unlockAudio } from './utils/audioManager.js';
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
const debugSceneId = getActiveDebugSceneId();
const WELCOME_TRANSITION_MS = 1020;
const NAVIGATION_TRANSITION_MS = 420;

const RESULT_PREVIEW = {
  type: 'daily-plan',
  completed: dailyScenes.length,
  total: dailyScenes.length,
  isComplete: true,
  score: dailyScenes.reduce((total, _scene, index) => total + Math.max(70, 94 - index), 0),
  maxScore: dailyScenes.length * 100,
  holdSeconds: 52,
  sceneTitle: 'FULL RESET COMPLETE',
  area: 'ALL 3 SESSIONS',
  programDay: 1,
  sceneResults: dailyScenes.map((scene, index) => ({
    sceneId: scene.id,
    sceneTitle: scene.title,
    score: Math.max(70, 94 - index),
    completed: true,
  })),
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
    debugSceneId ? SCREENS.permission : (isResultPreview ? SCREENS.result : (isDemoPreview ? SCREENS.theme : SCREENS.landing)),
  );
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [isDemoMode, setIsDemoMode] = useState(isDemoPreview);
  const [latestResult, setLatestResult] = useState(isResultPreview ? RESULT_PREVIEW : null);
  const [progressRevision, setProgressRevision] = useState(0);
  const [selectedScene, setSelectedScene] = useState(debugSceneId || DEFAULT_SCENE_ID);
  const [selectedProgramDay, setSelectedProgramDay] = useState(null);
  const [autoStartCamera, setAutoStartCamera] = useState(Boolean(debugSceneId));
  const [guideOverlay, setGuideOverlay] = useState(null);
  const [isCelebratingCompletion, setIsCelebratingCompletion] = useState(false);
  const [screenTransition, setScreenTransition] = useState(null);
  const [viverseAuth, setViverseAuth] = useState(getViverseAuthSnapshot);
  const transitionTimerRef = useRef(null);
  const sessionSnapshotsRef = useRef({ programDay: null, snapshots: [] });
  const habit = useMemo(() => loadHabitProgress(), [latestResult, progressRevision]);
  const challengeHabit = useMemo(() => withDebugHistory(habit), [habit]);
  const isDebugHistory = isDebugHistoryEnabled();

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

    traceAudioLifecycle('START pressed');
    unlockAudio();

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setScreen(SCREENS.theme);
      return;
    }

    setScreenTransition('welcome-to-plan');
    transitionTimerRef.current = window.setTimeout(() => {
      traceAudioLifecycle('Day 1 screen opened');
      setScreen(SCREENS.theme);
      setScreenTransition(null);
    }, WELCOME_TRANSITION_MS);
  };

  const navigate = (nextScreen, type = 'quiet') => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setScreen(nextScreen);
      return;
    }

    window.clearTimeout(transitionTimerRef.current);
    setScreen(nextScreen);
    setScreenTransition(type);
    transitionTimerRef.current = window.setTimeout(() => {
      setScreenTransition(null);
    }, NAVIGATION_TRANSITION_MS);
  };

  const handleCameraReady = (stream) => {
    setCameraStream(stream);
    setCameraError('');
    setAutoStartCamera(false);
    setIsDemoMode(false);
    if (guideOverlay === 'permission') {
      setGuideOverlay('scan');
      return;
    }
    setScreen(debugSceneId ? SCREENS.routine : SCREENS.mirror);
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
    traceAudioLifecycle('scene begin pressed', { sceneId: selectedScene });
    preloadSceneAudio(getSceneById(selectedScene).audio);
    unlockAudio();
    setGuideOverlay(null);
    if (hasSeenGuide(selectedScene)) {
      navigate(SCREENS.routine, 'slide-fwd');
      return;
    }

    setScreen(SCREENS.practice);
  };

  const selectTheme = (sceneId) => {
    traceAudioLifecycle('scene selected', { sceneId });
    preloadSceneAudio(getSceneById(sceneId).audio);
    unlockAudio();
    setSelectedScene(sceneId);
    navigate(SCREENS.practice, 'zoom-step');

    if (cameraStream || isDemoMode) {
      setGuideOverlay('scan');
      return;
    }

    setAutoStartCamera(true);
    setGuideOverlay('permission');
  };

  const openGuide = (sceneId) => {
    setSelectedScene(sceneId);
    setGuideOverlay(null);
    navigate(SCREENS.practice, 'slide-fwd');
  };

  const beginRoutine = () => {
    traceAudioLifecycle('routine begin pressed', { sceneId: selectedScene });
    preloadSceneAudio(getSceneById(selectedScene).audio);
    unlockAudio();
    setGuideOverlay(null);
    markGuideSeen(selectedScene);
    navigate(SCREENS.routine, 'slide-fwd');
  };

  const finishGuideScan = () => {
    setGuideOverlay(null);
  };

  const finishRoutine = (result) => {
    traceAudioLifecycle('scene completion transition begins', { sceneId: result.sceneId });
    if (debugSceneId) {
      setLatestResult(null);
      navigate(SCREENS.landing, 'slide-back');
      return;
    }

    const { snapshots: sceneSnapshots = [], ...persistableResult } = result;
    saveSessionResult(persistableResult, {
      onMerged: () => setProgressRevision((value) => value + 1),
    });
    const updatedHabit = loadHabitProgress();
    const dailyPlan = buildDailyPlanSummary(updatedHabit);
    const sessionSnapshots = mergeSessionSnapshots({
      current: sessionSnapshotsRef.current,
      incoming: sceneSnapshots,
      programDay: dailyPlan.programDay,
    });
    sessionSnapshotsRef.current = {
      programDay: dailyPlan.programDay,
      snapshots: sessionSnapshots,
    };

    if (dailyPlan.isComplete) {
      setLatestResult({
        ...dailyPlan,
        snapshots: sessionSnapshots,
      });
    } else {
      setLatestResult(null);
    }
    setIsCelebratingCompletion(dailyPlan.isComplete);
    setProgressRevision((value) => value + 1);
    navigate(SCREENS.theme, 'quiet');
  };

  const openDailyResult = () => {
    const dailyPlan = buildDailyPlanSummary(loadHabitProgress());

    if (!dailyPlan.isComplete) return;

    setSelectedProgramDay(null);
    setIsCelebratingCompletion(false);
    setLatestResult((current) => ({
      ...dailyPlan,
      snapshots: current?.programDay === dailyPlan.programDay
        ? current.snapshots || []
        : sessionSnapshotsRef.current.programDay === dailyPlan.programDay
          ? sessionSnapshotsRef.current.snapshots
          : [],
    }));
    navigate(SCREENS.result, 'paper');
  };

  useEffect(() => {
    if (!isCelebratingCompletion || screen !== SCREENS.theme) return undefined;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      openDailyResult();
      return undefined;
    }

    const timer = window.setTimeout(openDailyResult, 1240);
    return () => window.clearTimeout(timer);
  }, [isCelebratingCompletion, progressRevision, screen]);

  const restartRoutine = () => {
    navigate(SCREENS.theme, 'slide-back');
  };

  const resetToLanding = () => {
    navigate(SCREENS.landing, 'slide-back');
  };

  return (
    <main className={`app-shell ${screenTransition ? `screen-transition-${screenTransition}` : ''}`}>
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
          autoStart={autoStartCamera}
          isOverlay
          onCameraReady={handleCameraReady}
          onCameraError={handleCameraError}
          onBack={() => {
            setAutoStartCamera(false);
            navigate(SCREENS.theme, 'slide-back');
          }}
        />
      )}

      {screen === SCREENS.mirror && (
        <MirrorScreen
          stream={cameraStream}
          isDemoMode={isDemoMode}
          isOverlay
          onBegin={beginSelectedScene}
          onBack={() => navigate(SCREENS.theme, 'slide-back')}
        />
      )}

      {(screen === SCREENS.theme || screenTransition === 'welcome-to-plan') && (
        <ThemeScreen
          selectedScene={selectedScene}
          onSelect={selectTheme}
          onGuide={openGuide}
          onBack={resetToLanding}
          onContinue={openDailyResult}
          habit={challengeHabit}
          isEntering={screenTransition === 'welcome-to-plan'}
        />
      )}

      {screen === SCREENS.practice && (
        <PracticeScreen
          selectedScene={selectedScene}
          stream={cameraStream}
          isDemoMode={isDemoMode}
          onBegin={beginRoutine}
          onBack={() => navigate(SCREENS.theme, 'slide-back')}
        />
      )}

      {screen === SCREENS.practice && guideOverlay === 'permission' && (
        <CameraPermission
          cameraError={cameraError}
          autoStart={autoStartCamera}
          isOverlay
          onCameraReady={handleCameraReady}
          onCameraError={handleCameraError}
          onBack={() => {
            setAutoStartCamera(false);
            setGuideOverlay(null);
            navigate(SCREENS.theme, 'slide-back');
          }}
        />
      )}

      {screen === SCREENS.practice && guideOverlay === 'scan' && (
        <MirrorScreen
          stream={cameraStream}
          isDemoMode={isDemoMode}
          isOverlay
          onBegin={finishGuideScan}
          onBack={() => {
            setGuideOverlay(null);
            navigate(SCREENS.theme, 'slide-back');
          }}
        />
      )}

      {screen === SCREENS.routine && (
        <RoutineScreen
          stream={cameraStream}
          isDemoMode={isDemoMode}
          selectedScene={selectedScene}
          onComplete={finishRoutine}
          onExit={() => navigate(debugSceneId ? SCREENS.landing : SCREENS.theme, 'slide-back')}
        />
      )}

      {screen === SCREENS.result && (
        <ResultScreen
          result={isDebugHistory ? null : latestResult}
          habit={challengeHabit}
          selectedProgramDay={selectedProgramDay}
          onSelectedProgramDayChange={setSelectedProgramDay}
          onRestart={restartRoutine}
          onTodayPlan={() => navigate(SCREENS.theme, 'slide-back')}
          onPassport={() => navigate(SCREENS.passport, 'slide-fwd')}
          onLeaderboard={() => navigate(SCREENS.leaderboard, 'slide-fwd')}
          onProgressChanged={() => setProgressRevision((revision) => revision + 1)}
          shouldPromptForDisplayName={!isResultPreview}
        />
      )}

      {screen === SCREENS.passport && (
        <PassportScreen
          habit={habit}
          onBack={() => navigate(SCREENS.result, 'slide-back')}
          onLeaderboard={() => navigate(SCREENS.leaderboard, 'slide-fwd')}
          onRestart={restartRoutine}
        />
      )}

      {screen === SCREENS.leaderboard && (
        <LeaderboardScreen
          habit={challengeHabit}
          programDay={selectedProgramDay}
          onBack={() => navigate(SCREENS.result, 'slide-back')}
          onRestart={restartRoutine}
        />
      )}

      {isProgressDebug && (
        <ProgressDebugPanel onProgressChange={() => setProgressRevision((value) => value + 1)} />
      )}
    </main>
  );
}

function mergeSessionSnapshots({ current, incoming, programDay }) {
  const existing = current?.programDay === programDay ? current.snapshots || [] : [];
  const byScene = new Map(existing.map((snapshot) => [snapshot.sceneId, snapshot]));

  incoming.forEach((snapshot) => {
    if (!snapshot?.sceneId || !snapshot?.image) return;
    const previous = byScene.get(snapshot.sceneId);
    if (!previous || (snapshot.qualityScore || 0) >= (previous.qualityScore || 0)) {
      byScene.set(snapshot.sceneId, snapshot);
    }
  });

  return Array.from(byScene.values())
    .sort((a, b) => (a.capturedAt || 0) - (b.capturedAt || 0))
    .slice(-3);
}
