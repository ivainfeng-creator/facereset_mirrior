import { useEffect, useMemo, useRef, useState } from 'react';
import CameraPermission from './components/CameraPermission.jsx';
import ChallengeScreen from './components/ChallengeScreen.jsx';
import LandingScreen from './components/LandingScreen.jsx';
import LeaderboardScreen from './components/LeaderboardScreen.jsx';
import MirrorScreen from './components/MirrorScreen.jsx';
import PassportScreen from './components/PassportScreen.jsx';
import PracticeScreen from './components/PracticeScreen.jsx';
import ProgressDebugPanel from './components/ProgressDebugPanel.jsx';
import RoutineScreen from './components/RoutineScreen.jsx';
import { DEFAULT_SCENE_ID, dailyScenes, getSceneById } from './data/scenes.js';
import { buildDailyPlanSummary } from './utils/dailyPlan.js';
import { getActiveDebugSceneId } from './utils/debugScene.js';
import { getViverseAuthSnapshot, initializeViverseAuth } from './utils/viverseClient.js';
import {
  playSceneEffect,
  preloadAudioSources,
  preloadSceneAudio,
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
  challenge: 'challenge',
  practice: 'practice',
  routine: 'routine',
  passport: 'passport',
  leaderboard: 'leaderboard',
};

const isDemoPreview = new URLSearchParams(window.location.search).get('demo') === '1';
const isProgressDebug = new URLSearchParams(window.location.search).get('debug') === '1';
const debugSceneId = getActiveDebugSceneId();
const SKIP_FACE_SCAN_STORAGE_KEY = 'face-reset-mirror-skip-face-scan';
const WELCOME_TRANSITION_MS = 1020;
const NAVIGATION_TRANSITION_MS = 420;
const WELCOME_START_EFFECT = Object.freeze({
  source: '/audio/Overall/Star-1.mp3',
  volume: 0.55,
});
const WELCOME_PAPER_FLIP_EFFECT = Object.freeze({
  source: '/audio/Overall/Flip-1.mp3',
  volume: 0.55,
});
const BUTTON_HOVER_EFFECT = Object.freeze({
  source: '/audio/Overall/Pops-1.m4a',
  volume: 0.55,
});
const SESSION_COMPLETE_STAMP_EFFECT = Object.freeze({
  source: '/audio/Overall/Stamp.mp3',
  volume: 0.7,
});
const DAILY_COMPLETION_RESULT_DELAY_MS = 1240;

export default function App() {
  const [screen, setScreen] = useState(
    debugSceneId ? SCREENS.permission : (isDemoPreview ? SCREENS.challenge : SCREENS.landing),
  );
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [isDemoMode, setIsDemoMode] = useState(isDemoPreview);
  const [latestResult, setLatestResult] = useState(null);
  const [progressRevision, setProgressRevision] = useState(0);
  const [newlyCompletedSceneId, setNewlyCompletedSceneId] = useState(null);
  const [canViewCompletedHistory, setCanViewCompletedHistory] = useState(false);
  const [selectedScene, setSelectedScene] = useState(debugSceneId || DEFAULT_SCENE_ID);
  const [sessionDate, setSessionDate] = useState(null);
  const [selectedChallengeDate, setSelectedChallengeDate] = useState(null);
  const [skipFaceScan, setSkipFaceScan] = useState(loadSkipFaceScanPreference);
  const [challengeView, setChallengeView] = useState('plan');
  const [routineReturnView, setRoutineReturnView] = useState('plan');
  const [shouldAnimateResultCards, setShouldAnimateResultCards] = useState(false);
  const [shouldAnimateCompletionFlow, setShouldAnimateCompletionFlow] = useState(false);
  const [resultAnimationKey, setResultAnimationKey] = useState(0);
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
    const handleButtonHover = (event) => {
      if (event.pointerType === 'touch' || !(event.target instanceof Element)) return;

      const button = event.target.closest('button');
      if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') return;
      if (button.contains(event.relatedTarget)) return;
      const isCloseButton = [...button.classList].some((className) => className.includes('close'))
        || button.getAttribute('aria-label')?.toLowerCase().includes('close');
      const isModalButton = button.closest(
        '.guide-flow-overlay, .play-guide-modal, .play-quit-modal, .result-name-entry-modal, .leaderboard-name-modal, [role="dialog"]',
      );
      const isDaySelector = button.classList.contains('challenge-v3-day');
      if (isCloseButton || isModalButton || isDaySelector) return;

      playSceneEffect(BUTTON_HOVER_EFFECT);
    };

    window.addEventListener('pointerover', handleButtonHover);
    return () => window.removeEventListener('pointerover', handleButtonHover);
  }, []);

  useEffect(() => {
    if (skipFaceScan) setGuideOverlay(null);
  }, [skipFaceScan]);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key !== SKIP_FACE_SCAN_STORAGE_KEY) return;
      setSkipFaceScan(event.newValue === 'true');
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const updateSkipFaceScan = (enabled) => {
    const nextValue = Boolean(enabled);
    setSkipFaceScan(nextValue);
    try {
      window.localStorage.setItem(SKIP_FACE_SCAN_STORAGE_KEY, String(nextValue));
    } catch {
      // The current page still uses the selected setting when storage is unavailable.
    }
  };

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

    setSelectedChallengeDate(null);
    setShouldAnimateResultCards(false);
    setShouldAnimateCompletionFlow(false);
    setCanViewCompletedHistory(buildDailyPlanSummary(loadHabitProgress()).isComplete);
    traceAudioLifecycle('START pressed');
    unlockAudio();
    playSceneEffect(WELCOME_START_EFFECT);

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setChallengeView('plan');
      setScreen(SCREENS.challenge);
      return;
    }

    setScreenTransition('welcome-to-plan');
    welcomeEffectTimerRef.current = window.setTimeout(() => {
      playSceneEffect(WELCOME_PAPER_FLIP_EFFECT);
    }, 140);
    transitionTimerRef.current = window.setTimeout(() => {
      traceAudioLifecycle('Day 1 screen opened');
      setChallengeView('plan');
      setScreen(SCREENS.challenge);
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

  const navigateChallenge = (view, type = 'quiet', { animateResultCards = false } = {}) => {
    setChallengeView(view);
    setShouldAnimateResultCards(view === 'result' && animateResultCards);
    if (screen === SCREENS.challenge && challengeView === view) return;
    navigate(SCREENS.challenge, type);
  };

  const handleCameraReady = (stream) => {
    setCameraStream(stream);
    setCameraError('');
    setAutoStartCamera(false);
    setIsDemoMode(false);
    if (guideOverlay === 'permission') {
      setGuideOverlay(skipFaceScan ? null : 'scan');
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

  const selectTheme = (sceneId, selectedDate = null) => {
    traceAudioLifecycle('scene selected', { sceneId });
    preloadSceneAudio(getSceneById(sceneId).audio);
    unlockAudio();
    setSelectedScene(sceneId);
    setSessionDate(selectedDate);

    const isCompletedSession = buildDailyPlanSummary(habit, selectedDate ? { date: selectedDate } : undefined).sceneResults
      .some((result) => result.sceneId === sceneId && result.completed);
    if (isCompletedSession) {
      setRoutineReturnView('plan');
      navigate(SCREENS.routine, 'slide-fwd');
      return;
    }

    playSceneEffect(WELCOME_PAPER_FLIP_EFFECT);
    navigate(SCREENS.practice, 'paper');

    if (skipFaceScan) {
      setAutoStartCamera(false);
      setIsDemoMode(true);
      setGuideOverlay(null);
      return;
    }

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
    setRoutineReturnView('plan');
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
    const { saved } = saveSessionResult(persistableResult, {
      onMerged: () => setProgressRevision((value) => value + 1),
    });
    const updatedHabit = loadHabitProgress();
    const dailyPlan = buildDailyPlanSummary(updatedHabit, { date: saved.date });
    setSelectedChallengeDate(saved.date);
    const sessionSnapshots = mergeSessionSnapshots({
      current: sessionSnapshotsRef.current,
      incoming: sceneSnapshots,
      programDay: saved.programDay,
    });
    sessionSnapshotsRef.current = {
      programDay: saved.programDay,
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
    setCanViewCompletedHistory(false);
    playSceneEffect(SESSION_COMPLETE_STAMP_EFFECT);
    if (dailyPlan.isComplete) {
      playSceneEffect(WELCOME_START_EFFECT);
      setCanViewCompletedHistory(true);
      setShouldAnimateCompletionFlow(true);
      navigateChallenge('plan', 'quiet');
      completionResultTimerRef.current = window.setTimeout(() => {
        setResultAnimationKey((key) => key + 1);
        setShouldAnimateResultCards(true);
        completionResultTimerRef.current = window.setTimeout(() => {
          setShouldAnimateResultCards(false);
          setShouldAnimateCompletionFlow(false);
        }, 800);
      }, DAILY_COMPLETION_RESULT_DELAY_MS);
      return;
    }
    navigateChallenge('plan', 'quiet');
  };

  const openDailyResult = (plan) => {
    const dailyPlan = plan || buildDailyPlanSummary(loadHabitProgress());

    if (!dailyPlan.isComplete) return;

    setSelectedChallengeDate(dailyPlan.date);
    setLatestResult((current) => ({
      ...dailyPlan,
      snapshots: current?.programDay === dailyPlan.programDay
        ? current.snapshots || []
        : sessionSnapshotsRef.current.programDay === dailyPlan.programDay
          ? sessionSnapshotsRef.current.snapshots
          : [],
    }));
            setCanViewCompletedHistory(true);
            navigateChallenge('plan');
  };

  const openDailyResultWithAnimation = () => {
    const dailyPlan = buildDailyPlanSummary(loadHabitProgress());

    if (!dailyPlan.isComplete) return;

    setSelectedChallengeDate(dailyPlan.date);
    setCanViewCompletedHistory(false);
    setLatestResult((current) => ({
      ...dailyPlan,
      snapshots: current?.programDay === dailyPlan.programDay
        ? current.snapshots || []
        : sessionSnapshotsRef.current.programDay === dailyPlan.programDay
          ? sessionSnapshotsRef.current.snapshots
          : [],
    }));
    playSceneEffect(WELCOME_START_EFFECT);
    setCanViewCompletedHistory(true);
    setShouldAnimateCompletionFlow(true);
    navigateChallenge('plan', 'quiet');
    completionResultTimerRef.current = window.setTimeout(() => {
      setResultAnimationKey((key) => key + 1);
      setShouldAnimateResultCards(true);
      completionResultTimerRef.current = window.setTimeout(() => {
        setShouldAnimateResultCards(false);
        setShouldAnimateCompletionFlow(false);
      }, 800);
    }, DAILY_COMPLETION_RESULT_DELAY_MS);
  };

  const restartRoutine = () => {
    setSelectedChallengeDate(null);
    navigateChallenge('plan', 'slide-back');
  };

  const selectChallengeDay = (plan) => {
    setSelectedChallengeDate(plan.date);
    if (plan.isComplete) {
      openDailyResult(plan);
      return;
    }
    navigateChallenge('plan');
  };

  const replayResultSession = (sceneId) => {
    traceAudioLifecycle('result session replay', { sceneId });
    preloadSceneAudio(getSceneById(sceneId).audio);
    unlockAudio();
    setSelectedScene(sceneId);
    setSessionDate(latestResult?.date || null);
    setRoutineReturnView('result');
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
            navigateChallenge('plan', 'slide-back');
          }}
        />
      )}

      {screen === SCREENS.mirror && (
        <MirrorScreen
          stream={cameraStream}
          isDemoMode={isDemoMode}
          isOverlay
          onBegin={beginSelectedScene}
          onBack={() => navigateChallenge('plan', 'slide-back')}
        />
      )}

      {(screen === SCREENS.challenge || screenTransition === 'welcome-to-plan') && (
        <ChallengeScreen
          view={screenTransition === 'welcome-to-plan' ? 'plan' : challengeView}
          selectedScene={selectedScene}
          onSelect={selectTheme}
          selectedDate={selectedChallengeDate}
          onSelectDay={selectChallengeDay}
          habit={habit}
          isEntering={screenTransition === 'welcome-to-plan'}
          newlyCompletedSceneId={newlyCompletedSceneId}
          onCompletionStampAnimationEnd={() => setNewlyCompletedSceneId(null)}
          result={latestResult}
          onRestart={replayResultSession}
          onViewHistory={openDailyResult}
          canViewHistory={canViewCompletedHistory}
          onTodayPlan={() => {
            setSelectedChallengeDate(null);
            setCanViewCompletedHistory(false);
            navigateChallenge('plan', 'slide-back');
          }}
          onPassport={() => navigate(SCREENS.passport, 'slide-fwd')}
          onLeaderboard={() => navigate(SCREENS.leaderboard, 'slide-fwd')}
          onProgressChanged={() => setProgressRevision((revision) => revision + 1)}
          shouldPromptForDisplayName
          shouldAnimateResultCards={shouldAnimateResultCards}
          shouldAnimateCompletionFlow={shouldAnimateCompletionFlow}
          resultAnimationKey={resultAnimationKey}
        />
      )}

      {screen === SCREENS.practice && (
        <PracticeScreen
          selectedScene={selectedScene}
          stream={cameraStream}
          isDemoMode={isDemoMode}
          skipFaceScan={skipFaceScan}
          onBegin={beginRoutine}
          onBack={() => navigateChallenge('plan', 'slide-back')}
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
            navigateChallenge('plan', 'slide-back');
          }}
        />
      )}

      {screen === SCREENS.practice && guideOverlay === 'scan' && !skipFaceScan && (
        <MirrorScreen
          stream={cameraStream}
          isDemoMode={isDemoMode}
          isOverlay
          onBegin={finishGuideScan}
          onBack={() => {
            setGuideOverlay(null);
            navigateChallenge('plan', 'slide-back');
          }}
        />
      )}

      {screen === SCREENS.routine && (
        <RoutineScreen
          stream={cameraStream}
          isDemoMode={isDemoMode}
          skipFaceScan={skipFaceScan}
          selectedScene={selectedScene}
          sessionDate={sessionDate}
          onComplete={finishRoutine}
          onExit={() => {
            if (debugSceneId) {
              navigate(SCREENS.landing, 'slide-back');
              return;
            }
            navigateChallenge(routineReturnView, 'slide-back');
          }}
        />
      )}

      {screen === SCREENS.passport && (
        <PassportScreen
          habit={habit}
          onBack={() => navigateChallenge('result', 'slide-back')}
          onLeaderboard={() => navigate(SCREENS.leaderboard, 'slide-fwd')}
          onRestart={restartRoutine}
        />
      )}

      {screen === SCREENS.leaderboard && (
        <LeaderboardScreen
          habit={habit}
          onBack={() => navigateChallenge('result', 'slide-back')}
          onRestart={restartRoutine}
        />
      )}

      {isProgressDebug && (
        <ProgressDebugPanel
          onProgressChange={() => setProgressRevision((value) => value + 1)}
          onDayOneComplete={openDailyResultWithAnimation}
          skipFaceScan={skipFaceScan}
          onSkipFaceScanChange={updateSkipFaceScan}
        />
      )}
    </main>
  );
}

function loadSkipFaceScanPreference() {
  try {
    return window.localStorage.getItem(SKIP_FACE_SCAN_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
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
