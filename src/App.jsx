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
import { getActiveDebugSceneId } from './utils/debugScene.js';
import { getViverseAuthSnapshot, initializeViverseAuth } from './utils/viverseClient.js';
import {
  pauseSceneBackground,
  playSceneEffect,
  preloadAudioSources,
  preloadSceneAudio,
  resumeSceneBackground,
  startSceneBackground,
  stopSceneBackground,
  traceAudioLifecycle,
  unlockAudio,
} from './utils/audioManager.js';
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
const OVERALL_BACKGROUND = Object.freeze({
  id: 'overall-background',
  source: '/audio/Overall/Background.mp3',
  volume: 0.21,
  fadeInMs: 1000,
  fadeOutMs: 1000,
});
const WELCOME_START_EFFECT = Object.freeze({
  source: '/audio/Overall/Star-1.mp3',
  volume: 0.55,
});
const WELCOME_PAPER_FLIP_EFFECT = Object.freeze({
  source: '/audio/Overall/Flip-1.mp3',
  volume: 0.55,
});
const SESSION_COMPLETE_STAMP_EFFECT = Object.freeze({
  source: '/audio/Overall/Stamp.mp3',
  volume: 0.7,
});
const DAILY_COMPLETION_RESULT_DELAY_MS = 1240;

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
  const [newlyCompletedSceneId, setNewlyCompletedSceneId] = useState(null);
  const [selectedScene, setSelectedScene] = useState(debugSceneId || DEFAULT_SCENE_ID);
  const [routineReturnScreen, setRoutineReturnScreen] = useState(SCREENS.theme);
  const [autoStartCamera, setAutoStartCamera] = useState(Boolean(debugSceneId));
  const [guideOverlay, setGuideOverlay] = useState(null);
  const [screenTransition, setScreenTransition] = useState(null);
  const [viverseAuth, setViverseAuth] = useState(getViverseAuthSnapshot);
  const transitionTimerRef = useRef(null);
  const welcomeEffectTimerRef = useRef(null);
  const completionResultTimerRef = useRef(null);
  const sessionSnapshotsRef = useRef({ programDay: null, snapshots: [] });
  const habit = useMemo(() => loadHabitProgress(), [latestResult, progressRevision]);
  const isRoutineScreen = screen === SCREENS.routine;

  useEffect(() => () => {
    window.clearTimeout(transitionTimerRef.current);
    window.clearTimeout(welcomeEffectTimerRef.current);
    window.clearTimeout(completionResultTimerRef.current);
  }, []);

  useEffect(() => {
    preloadAudioSources([
      WELCOME_START_EFFECT.source,
      WELCOME_PAPER_FLIP_EFFECT.source,
    ]);
  }, []);

  useEffect(() => {
    if (isRoutineScreen) return undefined;

    startSceneBackground(OVERALL_BACKGROUND);
    return () => {
      stopSceneBackground(OVERALL_BACKGROUND, { fadeOutMs: OVERALL_BACKGROUND.fadeOutMs });
    };
  }, [isRoutineScreen]);

  useEffect(() => {
    if (!guideOverlay || isRoutineScreen) return undefined;

    pauseSceneBackground(OVERALL_BACKGROUND);
    return () => resumeSceneBackground(OVERALL_BACKGROUND);
  }, [guideOverlay, isRoutineScreen]);

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
    playSceneEffect(WELCOME_START_EFFECT);

    if (buildDailyPlanSummary(loadHabitProgress()).isComplete) {
      welcomeEffectTimerRef.current = window.setTimeout(() => {
        playSceneEffect(WELCOME_PAPER_FLIP_EFFECT);
      }, 140);
      openDailyResult();
      return;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setScreen(SCREENS.theme);
      return;
    }

    setScreenTransition('welcome-to-plan');
    welcomeEffectTimerRef.current = window.setTimeout(() => {
      playSceneEffect(WELCOME_PAPER_FLIP_EFFECT);
    }, 140);
    transitionTimerRef.current = window.setTimeout(() => {
      traceAudioLifecycle('Day 1 screen opened');
      setScreen(SCREENS.theme);
      setScreenTransition(null);
    }, WELCOME_TRANSITION_MS);
  };

  const startWelcomeBackground = () => {
    if (screen === SCREENS.landing) startSceneBackground(OVERALL_BACKGROUND);
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
    playSceneEffect(WELCOME_PAPER_FLIP_EFFECT);
    setSelectedScene(sceneId);
    navigate(SCREENS.practice, 'paper');

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
    setRoutineReturnScreen(SCREENS.theme);
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
    setProgressRevision((value) => value + 1);
    setNewlyCompletedSceneId(result.sceneId);
    playSceneEffect(SESSION_COMPLETE_STAMP_EFFECT);
    if (dailyPlan.isComplete) {
      playSceneEffect(WELCOME_START_EFFECT);
      navigate(SCREENS.theme, 'quiet');
      completionResultTimerRef.current = window.setTimeout(() => {
        navigate(SCREENS.result, 'paper');
      }, DAILY_COMPLETION_RESULT_DELAY_MS);
      return;
    }
    navigate(SCREENS.theme, 'quiet');
  };

  const openDailyResult = () => {
    const dailyPlan = buildDailyPlanSummary(loadHabitProgress());

    if (!dailyPlan.isComplete) return;

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

  const restartRoutine = () => {
    navigate(SCREENS.theme, 'slide-back');
  };

  const replayResultSession = (sceneId) => {
    traceAudioLifecycle('result session replay', { sceneId });
    preloadSceneAudio(getSceneById(sceneId).audio);
    unlockAudio();
    setSelectedScene(sceneId);
    setRoutineReturnScreen(SCREENS.result);
    navigate(SCREENS.routine, 'slide-fwd');
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
          onInteract={startWelcomeBackground}
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
          onViewReport={openDailyResult}
          onViewLeaderboard={() => navigate(SCREENS.leaderboard, 'slide-fwd')}
          habit={habit}
          isEntering={screenTransition === 'welcome-to-plan'}
          newlyCompletedSceneId={newlyCompletedSceneId}
          onCompletionStampAnimationEnd={() => setNewlyCompletedSceneId(null)}
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
          onExit={() => navigate(debugSceneId ? SCREENS.landing : routineReturnScreen, 'slide-back')}
        />
      )}

      {screen === SCREENS.result && (
        <ResultScreen
          result={latestResult}
          habit={habit}
          onRestart={replayResultSession}
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
          habit={habit}
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
