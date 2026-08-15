import { useEffect, useMemo, useRef, useState } from 'react';
import {
  clearSceneTuningOverrides,
  getSceneTuning,
  getSceneTuningExport,
  loadSceneTuningOverrides,
  saveSceneTuningValue,
} from '../data/interactionTuning.js';
import { STAGE_SECONDS, routineStages } from '../data/routine.js';
import { DEFAULT_SCENE_ID, getSceneById } from '../data/scenes.js';
import {
  cloudGardenBackgroundAsset,
  cloudGardenIslandAsset,
  fishBlueAsset,
  fishGreenAsset,
  fishPinkAsset,
  fishPurpleAsset,
  fishYellowAsset,
  flowerPink2Stage1,
  flowerPink2Stage2,
  flowerPink2Stage3,
  flowerPink2Stage4,
  flowerPinkStage1,
  flowerPinkStage2,
  flowerPinkStage3,
  flowerPinkStage4,
  flowerPurpleStage1,
  flowerPurpleStage2,
  flowerPurpleStage3,
  flowerYellowStage1,
  flowerYellowStage2,
  flowerYellowStage3,
  flowerYellowStage4,
  popcornCollectorBackgroundAsset,
  popcornCollectorBucketAsset,
  popcornCollectorForegroundAsset,
  popcornPiece01Asset,
  popcornPiece02Asset,
  popcornPiece03Asset,
  popcornPiece04Asset,
  popcornPiece05Asset,
  popcornPiece06Asset,
  whaleClosedAsset,
  whaleOpenAsset,
} from '../data/sceneAssets.js';
import { useFaceLandmarks } from '../hooks/useFaceLandmarks.js';
import { useHandTracking } from '../hooks/useHandTracking.js';
import { buildResult, getRoutineFeedback } from '../utils/mockDetection.js';
import {
  consumeTimedEvents,
  createInteractionSignalState,
  createSceneInteractionContract,
  updateInteractionSignal,
} from '../utils/interactionSignal.js';
import { RAW_SCENE_SCORE_MAX, toFinalSceneScore } from '../utils/scoring.js';
import { preloadSceneAssets, preloadUpcomingScenes } from '../utils/scenePreload.js';
import {
  getSceneBackgroundDiagnostics,
  pauseSceneBackground,
  playSceneEffect,
  resetSceneBackground,
  resumeSceneBackground,
  startSceneBackground,
  stopSceneBackground,
  stopSceneEffect,
  traceAudioLifecycle,
} from '../utils/audioManager.js';

const regularTotalSeconds = STAGE_SECONDS * routineStages.length;
const debugTotalSeconds = 5 * 60;
const MAX_SCENE_SCORE = RAW_SCENE_SCORE_MAX;
const POPCORN_SFX_COOLDOWN_MS = 280;
const POPCORN_FLIGHT_DURATION_MS = 760;
const ROUTINE_TOOLBAR_HOVER_EFFECT = Object.freeze({
  source: '/audio/Overall/Pops-1.m4a',
  volume: 0.55,
});
const ROUTINE_TOOLBAR_CLICK_EFFECT = Object.freeze({
  source: '/audio/Overall/Click-1.mp3',
  volume: 0.7,
});
const ROUTINE_GUIDE_CLOSE_EFFECT = Object.freeze({
  source: '/audio/Overall/Click-2.mp3',
  volume: 0.7,
});
let whaleAttemptSequence = 0;
let previousRoutineSceneIdForDiagnostics = null;
const WHALE_FISH_ASSETS = [
  fishBlueAsset,
  fishGreenAsset,
  fishPinkAsset,
  fishPurpleAsset,
  fishYellowAsset,
];

const POPCORN_PIECE_ASSETS = [
  popcornPiece01Asset,
  popcornPiece02Asset,
  popcornPiece03Asset,
  popcornPiece04Asset,
  popcornPiece05Asset,
  popcornPiece06Asset,
];

const POPCORN_SOURCE_COUNT = 46;
const POPCORN_CLUSTER_LIMIT = 220;
const POPCORN_VISUAL_SCALE = 1.5;
// These normalized zones sit in front of the tipped bucket on the visible tabletop spill.
// They deliberately avoid the bucket body, sofa line, and background so every launch reads
// as a piece lifting from the foreground table rather than emerging through the bucket.
const POPCORN_TABLETOP_SOURCE_ZONES = [
  { x: 59, y: 89, spreadX: 7, spreadY: 3, source: 'front-spill' },
  { x: 52, y: 91, spreadX: 8, spreadY: 3, source: 'front-spill' },
  { x: 45, y: 93, spreadX: 7, spreadY: 2.5, source: 'table-scatter' },
  { x: 66, y: 94, spreadX: 5, spreadY: 2, source: 'front-spill' },
  { x: 38, y: 94, spreadX: 5, spreadY: 2, source: 'table-scatter' },
];
const POPCORN_TABLETOP_ZONE_ORDER = [0, 1, 0, 2, 1, 3, 0, 1, 4, 2];
const POPCORN_RIM_PILE_ANGLES = [-2.55, -1.48, -0.35, 0.72, 1.88, 2.72];
const POPCORN_MOBILE_CAMERA_SCALE = 0.88;

const CLOUD_GARDEN_FLOWER_STAGES = {
  pink: [flowerPinkStage1, flowerPinkStage2, flowerPinkStage3, flowerPinkStage4],
  pink2: [flowerPink2Stage1, flowerPink2Stage2, flowerPink2Stage3, flowerPink2Stage4],
  purple: [flowerPurpleStage1, flowerPurpleStage2, flowerPurpleStage3],
  yellow: [flowerYellowStage1, flowerYellowStage2, flowerYellowStage3, flowerYellowStage4],
};

const CLOUD_GARDEN_FLOWER_SLOTS = [
  { id: 'center-main', x: '50%', root: '51%', scale: 1.05, tilt: '-3deg', offset: 0.04, duration: 0.2, type: 'pink', depth: 6 },
  { id: 'left-center', x: '39%', root: '49%', scale: 0.88, tilt: '5deg', offset: 0.18, duration: 0.19, type: 'pink2', depth: 5 },
  { id: 'right-center', x: '63%', root: '49%', scale: 0.78, tilt: '-5deg', offset: 0.27, duration: 0.19, type: 'yellow', depth: 5 },
  { id: 'left-front', x: '29%', root: '47%', scale: 0.66, tilt: '-8deg', offset: 0.39, duration: 0.17, type: 'purple', depth: 4 },
  { id: 'right-front', x: '75%', root: '47%', scale: 0.71, tilt: '7deg', offset: 0.48, duration: 0.17, type: 'pink2', depth: 4 },
  { id: 'left-side', x: '18%', root: '44%', scale: 0.5, tilt: '-11deg', offset: 0.58, duration: 0.15, type: 'yellow', depth: 3 },
  { id: 'right-side', x: '85%', root: '44%', scale: 0.54, tilt: '10deg', offset: 0.67, duration: 0.14, type: 'pink', depth: 3 },
  { id: 'center-detail', x: '55%', root: '50%', scale: 0.46, tilt: '4deg', offset: 0.75, duration: 0.08, type: 'purple', depth: 7 },
  { id: 'left-late-detail', x: '25%', root: '45%', scale: 0.42, tilt: '9deg', offset: 0.82, duration: 0.1, type: 'pink', depth: 5 },
  { id: 'right-late-detail', x: '79%', root: '45%', scale: 0.44, tilt: '-9deg', offset: 0.87, duration: 0.1, type: 'yellow', depth: 5 },
  { id: 'left-inner-late', x: '34%', root: '48%', scale: 0.36, tilt: '-5deg', offset: 0.91, duration: 0.08, type: 'purple', depth: 7 },
  { id: 'right-inner-late', x: '69%', root: '48%', scale: 0.38, tilt: '6deg', offset: 0.95, duration: 0.06, type: 'pink2', depth: 7 },
  { id: 'center-late-detail', x: '47%', root: '50%', scale: 0.32, tilt: '-2deg', offset: 0.98, duration: 0.02, type: 'yellow', depth: 8 },
];

const WHALE_FISH_TUNING = {
  ambientCount: 34,
  suctionCount: 30,
  compactAmbientCount: 21,
  compactSuctionCount: 18,
  narrowAmbientCount: 17,
  narrowSuctionCount: 14,
  ambientScaleMin: 0.38,
  ambientScaleStep: 0.09,
  suctionScaleMin: 0.34,
  suctionScaleStep: 0.13,
  ambientDurationBase: 8.6,
  suctionDurationBase: 1.8,
  compactBreakpoint: 620,
  narrowBreakpoint: 430,
  compactScaleMultiplier: 0.76,
  narrowScaleMultiplier: 0.62,
  leftSourceRatio: 0.62,
  nearbySourceRatio: 0.22,
  rightSourceRatio: 0.16,
  curveStrength: 1.24,
  suctionStrength: 1,
  motionVariance: 0.16,
  finalAcceleration: 1.14,
};

const WHALE_LAYOUT_TUNING = {
  desktopBreakpoint: 900,
  tabletBreakpoint: 600,
  desktopScale: 0.9,
  tabletScale: 0.87,
  mobileScale: 0.84,
};

function getWhaleFishLayout(viewportWidth) {
  if (viewportWidth <= WHALE_FISH_TUNING.narrowBreakpoint) {
    return {
      ambientCount: WHALE_FISH_TUNING.narrowAmbientCount,
      suctionCount: WHALE_FISH_TUNING.narrowSuctionCount,
      scaleMultiplier: WHALE_FISH_TUNING.narrowScaleMultiplier,
    };
  }

  if (viewportWidth <= WHALE_FISH_TUNING.compactBreakpoint) {
    return {
      ambientCount: WHALE_FISH_TUNING.compactAmbientCount,
      suctionCount: WHALE_FISH_TUNING.compactSuctionCount,
      scaleMultiplier: WHALE_FISH_TUNING.compactScaleMultiplier,
    };
  }

  return {
    ambientCount: WHALE_FISH_TUNING.ambientCount,
    suctionCount: WHALE_FISH_TUNING.suctionCount,
    scaleMultiplier: 1,
  };
}

function getWhaleLayout(viewportWidth) {
  if (viewportWidth >= WHALE_LAYOUT_TUNING.desktopBreakpoint) {
    return { scale: WHALE_LAYOUT_TUNING.desktopScale };
  }

  if (viewportWidth >= WHALE_LAYOUT_TUNING.tabletBreakpoint) {
    return { scale: WHALE_LAYOUT_TUNING.tabletScale };
  }

  return { scale: WHALE_LAYOUT_TUNING.mobileScale };
}

const INTERACTION_PROGRESS_FACTORIES = {
  mouthOpening: createMouthProgress,
  templePress: createTempleProgress,
  lemonSqueeze: createLemonProgress,
  noseSniff: createNoseProgress,
  cheekPuff: createBubbleProgress,
};

const INTERACTION_SCORERS = {
  templePress: ({ inputs, timestamp, progressState, stageProgress, tuning }) => scoreTemplePress({
    features: inputs.features,
    fingertips: inputs.fingertips,
    targets: inputs.templeTargets,
    timestamp,
    progressState,
    stageProgress,
    tuning,
  }),
  lemonSqueeze: ({ inputs, timestamp, progressState, stageProgress, tuning }) => scoreLemonSqueeze({
    features: inputs.features,
    fingertips: inputs.fingertips,
    targets: inputs.lemonTargets,
    timestamp,
    progressState,
    stageProgress,
    tuning,
  }),
  noseSniff: ({ inputs, timestamp, progressState, stageProgress, tuning }) => scoreNoseSniff({
    features: inputs.features,
    timestamp,
    progressState,
    stageProgress,
    tuning,
  }),
  cheekPuff: ({ inputs, timestamp, progressState, stageProgress, tuning }) => scoreCheekPuff({
    features: inputs.features,
    timestamp,
    progressState,
    stageProgress,
    tuning,
  }),
  mouthOpening: ({ inputs, timestamp, progressState, stageProgress, tuning }) => scoreMouthOpening({
    features: inputs.features,
    timestamp,
    progressState,
    stageProgress,
    tuning,
  }),
};

const SCENE_RENDERERS = {
  whaleDream: WhaleDreamScene,
  whaleDream2: WhaleDream2Scene,
  templeGarden: TempleGardenScene,
  popcornCollector: FlowerCollectorScene,
  bubbleGumBunny: BubbleGumBunnyScene,
  lemonSqueeze: LemonSqueezeScene,
};

export default function RoutineScreen({ selectedScene = DEFAULT_SCENE_ID, stream, isDemoMode, onComplete, onExit }) {
  const scene = getSceneById(selectedScene);
  const practiceGuide = scene.practice || {
    description: scene.subtitle,
    tips: ['Keep your face centered.', `Follow the ${scene.action.toLowerCase()} cue.`, 'Move gently and steadily.'],
  };
  const activeSceneId = scene.id;
  const whaleAttemptRef = useRef(null);
  const SceneRenderer = SCENE_RENDERERS[scene.renderer] || WhaleDreamScene;
  const videoRef = useRef(null);
  const previewVideoRef = useRef(null);
  const stageRef = useRef(null);
  const cameraTrack = stream?.getVideoTracks()[0];
  const isCameraUnavailable = (
    !stream
    || !stream.active
    || !cameraTrack
    || !cameraTrack.enabled
    || cameraTrack.readyState !== 'live'
  );
  const interactionProgressRefs = useRef(Object.fromEntries(
    Object.entries(INTERACTION_PROGRESS_FACTORIES).map(([key, createProgress]) => [key, createProgress()]),
  ));
  const latestInputsRef = useRef({
    features: null,
    fingertips: { left: null, right: null, all: [] },
    templeTargets: null,
    lemonTargets: null,
  });
  const snapshotCandidateRef = useRef(null);
  const snapshotTargetsRef = useRef([0.12, 0.3, 0.48, 0.66, 0.84]);
  const popcornSfxRef = useRef({ eventSequence: 0, lastPlayedAt: 0 });
  const gardenRainSfxRef = useRef(false);
  const routineFinishedRef = useRef(false);
  const backgroundFadeStartedRef = useRef(false);
  const [elapsed, setElapsed] = useState(0);
  const [interactionTick, setInteractionTick] = useState(0);
  const [stageScores, setStageScores] = useState({});
  const [interaction, setInteraction] = useState(() => createBaseInteraction(selectedScene));
  const [tuningRevision, setTuningRevision] = useState(0);
  const [isQuitOpen, setIsQuitOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const debugEnabled = isInteractionDebugEnabled();
  const activeTotalSeconds = debugEnabled ? debugTotalSeconds : regularTotalSeconds;
  const activeStageSeconds = activeTotalSeconds / routineStages.length;

  const traceWhaleAttempt = (event, details = {}) => {
    if (activeSceneId !== 'whaleDream' || !import.meta.env.DEV) return;

    console.info(`[Whale Attempt #${whaleAttemptRef.current ?? '?'}] ${event}`, {
      sceneId: activeSceneId,
      previousSceneId: details.previousSceneId ?? null,
      routineSessionId: whaleAttemptRef.current,
      selectedScene,
      completionGuard: routineFinishedRef.current,
      completionRefValue: routineFinishedRef.current,
      isFinished: routineFinishedRef.current,
      fadeStarted: backgroundFadeStartedRef.current,
      elapsed,
      activeTotalSeconds,
      ...details,
    });
  };

  useEffect(() => {
    if (activeSceneId !== 'whaleDream' || !import.meta.env.DEV) return undefined;

    const previousSceneId = previousRoutineSceneIdForDiagnostics;
    previousRoutineSceneIdForDiagnostics = activeSceneId;
    whaleAttemptSequence += 1;
    whaleAttemptRef.current = whaleAttemptSequence;
    traceWhaleAttempt('React component mounted', {
      sceneEnterDependencies: {
        activeSceneId,
        sceneAudioSource: scene.audio?.background?.source || null,
        sceneAudioConfigured: Boolean(scene.audio?.background),
      },
      previousSceneId,
      audio: getSceneBackgroundDiagnostics(scene.audio?.background?.source),
    });

    return () => {
      traceWhaleAttempt('React component unmounting', {
        audio: getSceneBackgroundDiagnostics(scene.audio?.background?.source),
      });
    };
  }, [activeSceneId]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
    if (previewVideoRef.current && stream) {
      previewVideoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    preloadSceneAssets(scene);
    const timer = window.setTimeout(() => preloadUpcomingScenes(activeSceneId, 2, {
      useDailyOrder: Number.isFinite(scene.dailyOrder),
    }), 0);
    return () => window.clearTimeout(timer);
  }, [activeSceneId, scene]);

  useEffect(() => {
    const background = scene.audio?.background;
    if (!background) return undefined;

    const backgroundConfig = { id: activeSceneId, ...background };
    traceWhaleAttempt('scene-enter effect fired', {
      sceneEnterDependencies: {
        activeSceneId,
        sceneAudioSource: background.source,
        sceneAudioVolume: background.volume,
        sceneAudioFadeInMs: background.fadeInMs,
      },
      audioBeforeStart: getSceneBackgroundDiagnostics(background.source),
    });
    traceAudioLifecycle('scene entered', { sceneId: activeSceneId });
    startSceneBackground(backgroundConfig);
    traceWhaleAttempt('BGM start function called', {
      audioAfterStartCall: getSceneBackgroundDiagnostics(background.source),
    });
    return () => {
      traceWhaleAttempt('scene-enter effect cleanup executing', {
        audioBeforeCleanup: getSceneBackgroundDiagnostics(background.source),
      });
      traceAudioLifecycle('scene audio cleanup', { sceneId: activeSceneId });
      stopSceneBackground(backgroundConfig, { fadeOutMs: background.fadeOutMs });
    };
  }, [activeSceneId, scene.audio]);

  useEffect(() => {
    const background = scene.audio?.background;
    if (!background) return;

    const backgroundConfig = { id: activeSceneId, ...background };
    if (isGuideOpen || isQuitOpen) {
      pauseSceneBackground(backgroundConfig);
      return;
    }

    resumeSceneBackground(backgroundConfig);
  }, [activeSceneId, isGuideOpen, isQuitOpen, scene.audio]);

  const { containerSize, detectorMode, displayRect, features, hasLandmarks } = useFaceLandmarks({
    videoRef,
    stageRef,
    stream,
    isDemoMode,
  });

  useEffect(() => {
    if (isGuideOpen || isQuitOpen) return undefined;
    const timer = window.setInterval(() => {
      setElapsed((current) => {
        const next = Math.min(activeTotalSeconds, current + 1);
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeTotalSeconds, isGuideOpen, isQuitOpen]);

  useEffect(() => {
    const timer = window.setInterval(() => setInteractionTick((current) => current + 1), 50);
    return () => window.clearInterval(timer);
  }, []);

  const stageIndex = Math.min(routineStages.length - 1, Math.floor(elapsed / activeStageSeconds));
  const stage = routineStages[stageIndex];
  const stageElapsed = elapsed - stageIndex * activeStageSeconds;
  const stageProgress = Math.min(1, stageElapsed / activeStageSeconds);
  const globalProgress = Math.min(1, elapsed / activeTotalSeconds);
  const secondsLeft = Math.max(0, activeTotalSeconds - elapsed);
  const feedback = useMemo(
    () => getRoutineFeedback(stageIndex, stageProgress, globalProgress),
    [stageIndex, stageProgress, globalProgress],
  );
  const templeTargets = useMemo(
    () => createTemplePressTargets(features, containerSize),
    [containerSize, features],
  );
  const templeTrajectories = useMemo(
    () => createTemplePressTrajectories(templeTargets, containerSize),
    [containerSize, templeTargets],
  );
  const lemonTargets = useMemo(
    () => createLemonPressTargets(features, containerSize),
    [containerSize, features],
  );
  const lemonTrajectories = useMemo(
    () => createLemonPressTrajectories(lemonTargets, containerSize),
    [containerSize, lemonTargets],
  );
  const { fingertips, handMode } = useHandTracking({
    videoRef,
    stream,
    isDemoMode,
    displayRect,
    trajectories: {
      temple: templeTrajectories,
      lemon: lemonTrajectories,
    }[scene.handTracking],
  });
  const sceneTuning = useMemo(() => getSceneTuning(activeSceneId), [activeSceneId, tuningRevision]);
  const tuningOverrides = useMemo(() => loadSceneTuningOverrides(activeSceneId), [activeSceneId, tuningRevision]);

  useEffect(() => {
    latestInputsRef.current = { features, fingertips, templeTargets, lemonTargets };
  }, [features, fingertips, lemonTargets, templeTargets]);

  useEffect(() => {
    const createProgress = INTERACTION_PROGRESS_FACTORIES[scene.interaction];
    if (createProgress) interactionProgressRefs.current[scene.interaction] = createProgress();
    setInteraction(createBaseInteraction(activeSceneId));
  }, [activeSceneId, scene.interaction, stage.id]);

  useEffect(() => {
    routineFinishedRef.current = false;
    backgroundFadeStartedRef.current = false;
    traceWhaleAttempt('completion refs initialized', {
      completionGuard: routineFinishedRef.current,
      fadeStarted: backgroundFadeStartedRef.current,
    });
  }, [activeSceneId]);

  useEffect(() => {
    snapshotCandidateRef.current = null;
    snapshotTargetsRef.current = [0.12, 0.3, 0.48, 0.66, 0.84];
  }, [activeSceneId]);

  useEffect(() => {
    const now = performance.now();
    const currentInputs = latestInputsRef.current;
    const tuning = sceneTuning;
    const scoreInteraction = INTERACTION_SCORERS[scene.interaction] || INTERACTION_SCORERS.mouthOpening;
    const nextInteraction = scoreInteraction({
      inputs: currentInputs,
      timestamp: now,
      progressState: interactionProgressRefs.current[scene.interaction],
      stageProgress,
      tuning,
    });

    const contract = createSceneInteractionContract({
      sceneId: activeSceneId,
      interaction: nextInteraction,
      tracking: {
        detectorMode,
        handMode,
        hasLandmarks,
        isDemoMode,
      },
      features: currentInputs.features,
      fingertips: currentInputs.fingertips,
    });

    setInteraction({
      ...nextInteraction,
      contract,
    });
  }, [activeSceneId, detectorMode, handMode, hasLandmarks, interactionTick, isDemoMode, scene.interaction, sceneTuning, stageProgress]);

  useEffect(() => {
    if (activeSceneId !== 'whaleDream') return;

    const mouthEffect = scene.audio?.effects?.mouthOpen;
    if (interaction.justActivated) playSceneEffect(mouthEffect);
    if (interaction.justReleased) stopSceneEffect(mouthEffect);
  }, [activeSceneId, interaction.justActivated, interaction.justReleased, scene.audio]);

  useEffect(() => {
    if (activeSceneId !== 'whaleDream') return undefined;

    const mouthEffect = scene.audio?.effects?.mouthOpen;
    return () => stopSceneEffect(mouthEffect);
  }, [activeSceneId, scene.audio]);

  useEffect(() => {
    if (activeSceneId !== 'flowerCollector') return;

    const eventSequence = interaction.suctionEventSequence || 0;
    const previousSequence = popcornSfxRef.current.eventSequence;
    popcornSfxRef.current.eventSequence = eventSequence;

    if (!interaction.isSniffing || eventSequence <= previousSequence) return;

    const now = performance.now();
    if (now - popcornSfxRef.current.lastPlayedAt < POPCORN_SFX_COOLDOWN_MS) return;

    popcornSfxRef.current.lastPlayedAt = now;
    playSceneEffect(scene.audio?.effects?.popcornGather);
  }, [activeSceneId, interaction.isSniffing, interaction.suctionEventSequence, scene.audio]);

  useEffect(() => {
    if (activeSceneId !== 'flowerCollector') return undefined;

    const popcornEffect = scene.audio?.effects?.popcornGather;
    return () => stopSceneEffect(popcornEffect);
  }, [activeSceneId, scene.audio]);

  useEffect(() => {
    if (activeSceneId !== 'templeGarden') return;

    const gardenEffect = scene.audio?.effects?.gardenRain;
    const isRaining = (interaction.rain || 0) > 0.06;

    if (isRaining && !gardenRainSfxRef.current) {
      gardenRainSfxRef.current = true;
      playSceneEffect(gardenEffect);
      return;
    }

    if (!isRaining && gardenRainSfxRef.current) {
      gardenRainSfxRef.current = false;
      stopSceneEffect(gardenEffect);
    }
  }, [activeSceneId, interaction.rain, scene.audio]);

  useEffect(() => {
    if (activeSceneId !== 'templeGarden') return undefined;

    gardenRainSfxRef.current = false;
    const gardenEffect = scene.audio?.effects?.gardenRain;
    return () => {
      gardenRainSfxRef.current = false;
      stopSceneEffect(gardenEffect);
    };
  }, [activeSceneId, scene.audio]);


  useEffect(() => {
    const nextTarget = snapshotTargetsRef.current[0];
    if (nextTarget === undefined || globalProgress < nextTarget) return;

    const snapshot = captureRoutineSnapshot({
      video: videoRef.current,
      isDemoMode,
      sceneId: activeSceneId,
      score: toFinalSceneScore(interaction.score),
      features,
      displayRect,
      interaction,
    });

    if (snapshot) {
      if (!snapshotCandidateRef.current || snapshot.qualityScore > snapshotCandidateRef.current.qualityScore) {
        snapshotCandidateRef.current = snapshot;
      }
      snapshotTargetsRef.current = snapshotTargetsRef.current.slice(1);
    }
  }, [activeSceneId, displayRect, features, globalProgress, interaction, isDemoMode]);

  useEffect(() => {
    setStageScores((current) => ({
      ...current,
      [activeSceneId]: Math.max(current[activeSceneId] || 0, interaction.score),
    }));
  }, [activeSceneId, interaction.score]);

  const rawDisplayScore = Math.max(stageScores[activeSceneId] || 0, interaction.score);
  const displayScore = toFinalSceneScore(rawDisplayScore);
  const finishRoutine = () => {
    traceWhaleAttempt('finishRoutine invoked', {
      completionGuardBefore: routineFinishedRef.current,
    });
    if (routineFinishedRef.current) {
      traceWhaleAttempt('finishRoutine skipped by completion guard');
      return;
    }
    routineFinishedRef.current = true;
    const background = scene.audio?.background;
    if (background) {
      traceWhaleAttempt('completion reset requested', {
        audioBeforeReset: getSceneBackgroundDiagnostics(background.source),
      });
      traceAudioLifecycle('level completion final BGM reset', { sceneId: activeSceneId });
      resetSceneBackground({ id: activeSceneId, ...background });
      traceWhaleAttempt('completion reset finished', {
        audioAfterReset: getSceneBackgroundDiagnostics(background.source),
      });
    }
    onComplete(buildResult(
      {
        ...stageScores,
        [activeSceneId]: rawDisplayScore,
      },
      snapshotCandidateRef.current ? [snapshotCandidateRef.current] : [],
      activeSceneId,
    ));
  };

  useEffect(() => {
    const background = scene.audio?.background;
    if (!background || backgroundFadeStartedRef.current) return;

    const fadeOutSeconds = Math.min(activeTotalSeconds, (background.fadeOutMs || 1000) / 1000);
    const fadeOutStartAt = Math.max(0, activeTotalSeconds - fadeOutSeconds);
    if (elapsed < fadeOutStartAt) return;

    backgroundFadeStartedRef.current = true;
    traceAudioLifecycle('pre-completion BGM fade-out starts', {
      sceneId: activeSceneId,
      elapsed,
      activeTotalSeconds,
      fadeOutStartAt,
    });
    traceWhaleAttempt('pre-completion fade-out requested', {
      fadeOutStartAt,
      audioBeforeFadeOut: getSceneBackgroundDiagnostics(background.source),
    });
    stopSceneBackground({ id: activeSceneId, ...background }, { fadeOutMs: background.fadeOutMs });
  }, [activeSceneId, activeTotalSeconds, elapsed, scene.audio]);

  useEffect(() => {
    if (elapsed >= activeTotalSeconds) {
      traceWhaleAttempt('level timer reached completion');
      traceAudioLifecycle('level timer reached completion', { sceneId: activeSceneId });
      finishRoutine();
    }
  }, [activeTotalSeconds, elapsed]);

  const handleExit = () => {
    const background = scene.audio?.background;
    if (background) {
      traceWhaleAttempt('close/exit fade-out requested', {
        audioBeforeExitFade: getSceneBackgroundDiagnostics(background.source),
      });
      traceAudioLifecycle('scene exit starts BGM fade-out', { sceneId: activeSceneId });
      stopSceneBackground({ id: activeSceneId, ...background }, { fadeOutMs: background.fadeOutMs });
    }
    onExit();
  };

  const handleTuningChange = (section, key, value) => {
    saveSceneTuningValue(activeSceneId, section, key, value);
    setTuningRevision((current) => current + 1);
  };

  const handleTuningReset = () => {
    clearSceneTuningOverrides(activeSceneId);
    setTuningRevision((current) => current + 1);
  };

  return (
    <section
      className={`screen routine-screen play-routine-screen ${scene.layout?.className || ''}`}
      data-scene-id={activeSceneId}
      data-scene-layout={scene.layout?.mode || 'portrait'}
    >
      <div className="routine-layout play-routine-layout">
        <div className="mirror-stage routine-mirror play-routine-mirror" ref={stageRef}>
          <SceneRenderer interaction={interaction} targets={templeTargets} />
          <TrackingVideo videoRef={videoRef} isDemoMode={isDemoMode} />

          <header className="play-hud play-hud-top">
            <CameraPreview
              detectorMode={detectorMode}
              handMode={scene.interaction === 'mouthOpening' ? interaction.isOpen ? 'good-flow' : 'mouth-ready' : handMode}
              isDemoMode={isDemoMode}
              isCameraUnavailable={isCameraUnavailable}
              previewVideoRef={previewVideoRef}
            />
            <div className="play-hud-actions">
              <div
                className={`play-timer ${secondsLeft <= 5 ? 'is-urgent' : ''}`}
                aria-label={`${formatTime(secondsLeft)} remaining`}
              >
                <span>{formatTime(secondsLeft)}</span>
              </div>
              <span className="play-toolbar-divider" aria-hidden="true" />
              <button
                className="play-guide-toggle"
                type="button"
                onMouseEnter={() => playSceneEffect(ROUTINE_TOOLBAR_HOVER_EFFECT)}
                onClick={() => {
                  playSceneEffect(ROUTINE_TOOLBAR_CLICK_EFFECT);
                  setIsGuideOpen((value) => !value);
                }}
                aria-expanded={isGuideOpen}
                aria-controls="routine-guide"
                aria-label="How to play"
                title="How to play"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 10v6" />
                  <path d="M12 7h.01" />
                </svg>
              </button>
              <button
                className="play-exit-button"
                type="button"
                onMouseEnter={() => playSceneEffect(ROUTINE_TOOLBAR_HOVER_EFFECT)}
                onClick={() => {
                  playSceneEffect(ROUTINE_TOOLBAR_CLICK_EFFECT);
                  setIsQuitOpen(true);
                }}
                aria-label="Quit routine"
                title="Exit"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M14 20H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h8" />
                  <path d="M16 16l4-4-4-4" />
                  <path d="M20 12h-9" />
                </svg>
              </button>
            </div>
          </header>

          <div className="play-action-prompt" aria-live="polite">
            {interaction.feedback || feedback.label}
          </div>

          <div
            className={`face-tracking-toast ${!isCameraUnavailable && !isDemoMode && !hasLandmarks ? 'is-visible' : ''}`}
            aria-hidden={isCameraUnavailable || isDemoMode || hasLandmarks}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7.6v5.2" />
              <path d="M12 16.6h.01" />
            </svg>
            Face not detected. Move back into view.
          </div>

          <footer className="play-hud play-hud-bottom">
            <div className="play-score">
              <strong>{displayScore}</strong>
              <span><small>POINTS</small>{scene.title}</span>
            </div>
          </footer>

          {isGuideOpen && (
            <div className="play-guide-backdrop" role="presentation">
              <section className="play-guide-modal" id="routine-guide" role="dialog" aria-modal="true" aria-labelledby="routine-guide-title">
                <h2 id="routine-guide-title">{scene.title}</h2>
                <p>{practiceGuide.description}</p>
                <div className="practice-steps play-guide-steps">
                  <ol>
                    {practiceGuide.tips.map((tip, index) => (
                      <li key={tip} className={`practice-tip practice-tip-${index + 1}`}>
                        <span className="practice-step-number" aria-hidden="true">Step {index + 1}</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    playSceneEffect(ROUTINE_GUIDE_CLOSE_EFFECT);
                    setIsGuideOpen(false);
                  }}
                >
                  Got it!
                </button>
              </section>
            </div>
          )}

          {isQuitOpen && (
            <div className="play-quit-backdrop" role="presentation">
              <section className="play-quit-modal" role="dialog" aria-modal="true" aria-labelledby="quit-routine-title">
                <h2 id="quit-routine-title">Leave &quot;{scene.title}&quot;?</h2>
                <span>Your progress won&apos;t be saved.</span>
                <div>
                  <button
                    className="play-quit-leave"
                    type="button"
                    onClick={() => {
                      playSceneEffect(ROUTINE_GUIDE_CLOSE_EFFECT);
                      handleExit();
                    }}
                  >
                    Leave
                  </button>
                  <button
                    className="play-quit-stay"
                    type="button"
                    onClick={() => {
                      playSceneEffect(ROUTINE_TOOLBAR_CLICK_EFFECT);
                      setIsQuitOpen(false);
                    }}
                  >
                    Stay
                  </button>
                </div>
              </section>
            </div>
          )}

          {debugEnabled ? (
            <InteractionDebugPanel
              contract={interaction.contract}
              onChange={handleTuningChange}
              onFinish={finishRoutine}
              onReset={handleTuningReset}
              overrides={tuningOverrides}
              tuning={sceneTuning}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

function createBaseInteraction(sceneId) {
  const interaction = {
    score: 0,
    completion: 0,
    feedback: getInitialFeedback(sceneId),
    isOnTrack: false,
    mouthOpen: 0,
    flow: 0,
    fishBurst: 0,
    fishCount: 0,
    isOpen: false,
    leftPress: 0,
    rightPress: 0,
    rain: 0,
    growth: 0,
    gardenCycle: 0,
    ripple: 0,
    isPressing: false,
    squeeze: 0,
    sodaLevel: 0.16,
    ingredientStage: 0,
    sip: 0,
    isSqueezing: false,
    sniff: 0,
    flowerCount: 0,
    isSniffing: false,
    puff: 0,
    bubbleSize: 0.07,
    bubbleStage: 0,
    bubblePops: 0,
    justPopped: false,
    combo: 0,
    isPuffing: false,
    sync: 0,
    clarity: 0,
    phase: 'idle',
  };

  return {
    ...interaction,
    contract: createSceneInteractionContract({ sceneId, interaction }),
  };
}

export function RoutineScenePreview({ selectedScene = DEFAULT_SCENE_ID }) {
  const scene = getSceneById(selectedScene);
  const SceneRenderer = SCENE_RENDERERS[scene.renderer] || WhaleDreamScene;
  const previewFrameRef = useRef(null);
  const [previewFrame, setPreviewFrame] = useState({ width: 0, height: 0 });
  const [sourceViewport, setSourceViewport] = useState(() => getPreviewSourceViewport());
  const previewDemo = usePracticePreviewDemo(scene.practice?.previewDemo);
  const interaction = useMemo(
    () => createPracticePreviewInteraction(scene, previewDemo),
    [scene, previewDemo],
  );
  const previewScale = previewFrame.width && previewFrame.height
    ? Math.min(previewFrame.width / sourceViewport.width, previewFrame.height / sourceViewport.height)
    : 0;

  useEffect(() => {
    const syncPreviewFrame = () => {
      const bounds = previewFrameRef.current?.getBoundingClientRect();
      if (!bounds) return;
      setPreviewFrame((current) => {
        const next = { width: Math.round(bounds.width), height: Math.round(bounds.height) };
        return current.width === next.width && current.height === next.height ? current : next;
      });
      setSourceViewport((current) => {
        const next = getPreviewSourceViewport();
        return current.width === next.width && current.height === next.height ? current : next;
      });
    };

    syncPreviewFrame();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(syncPreviewFrame);
    if (previewFrameRef.current) observer?.observe(previewFrameRef.current);
    window.addEventListener('resize', syncPreviewFrame);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', syncPreviewFrame);
    };
  }, []);

  return (
    <div ref={previewFrameRef} className="routine-scene-preview" aria-hidden="true">
      <PreviewSceneBackground scene={scene} />
      <div
        className={`routine-scene-preview-canvas ${scene.layout?.className || ''}`}
        style={{
          width: `${sourceViewport.width}px`,
          height: `${sourceViewport.height}px`,
          opacity: previewScale ? 1 : 0,
          transform: `translate(-50%, -50%) scale(${previewScale || 1})`,
        }}
      >
        <SceneRenderer interaction={interaction} previewForegroundOnly />
      </div>
    </div>
  );
}

function PreviewSceneBackground({ scene }) {
  if (scene.id === 'flowerCollector') {
    return (
      <div className="routine-scene-preview-background preview-popcorn-environment">
        <img className="preview-popcorn-background" src={popcornCollectorBackgroundAsset} alt="" />
        <img className="preview-popcorn-foreground" src={popcornCollectorForegroundAsset} alt="" />
        <img className="preview-popcorn-bucket" src={popcornCollectorBucketAsset} alt="" />
      </div>
    );
  }

  const backgroundAsset = scene.id === 'templeGarden' ? cloudGardenBackgroundAsset : null;

  return (
    <div
      className={`routine-scene-preview-background preview-background-${scene.renderer}`}
      style={backgroundAsset ? { backgroundImage: `url(${backgroundAsset})` } : undefined}
    />
  );
}

function getPreviewSourceViewport() {
  if (typeof window === 'undefined') return { width: 1280, height: 720 };
  return {
    width: Math.max(1, window.innerWidth),
    height: Math.max(1, window.innerHeight),
  };
}

function usePracticePreviewDemo(demoConfig) {
  const effect = demoConfig?.effect || null;
  const cycleMs = demoConfig?.cycleMs || 0;
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!effect || !cycleMs || typeof window === 'undefined') {
      setProgress(0);
      return undefined;
    }

    const startedAt = performance.now();
    let timer = null;
    const updateProgress = () => {
      setProgress(((performance.now() - startedAt) % cycleMs) / cycleMs);
      timer = window.setTimeout(updateProgress, 100);
    };

    updateProgress();
    return () => window.clearTimeout(timer);
  }, [cycleMs, effect]);

  return { effect, progress };
}

function createPracticePreviewInteraction(scene, previewDemo) {
  const interaction = {
    ...createBaseInteraction(scene.id),
    mouthOpen: scene.interaction === 'mouthOpening' ? 0.24 : 0,
    isOpen: scene.interaction === 'mouthOpening',
    fishCount: scene.interaction === 'mouthOpening' ? 6 : 0,
    leftRain: scene.interaction === 'templePress' ? 0.26 : 0,
    rightRain: scene.interaction === 'templePress' ? 0.26 : 0,
    growth: scene.interaction === 'templePress' ? 0.2 : 0,
    sniff: scene.interaction === 'noseSniff' ? 0.22 : 0,
    puff: scene.interaction === 'cheekPuff' ? 0.24 : 0,
    bubbleSize: scene.interaction === 'cheekPuff' ? 0.28 : 0.07,
    squeeze: scene.interaction === 'lemonSqueeze' ? 0.2 : 0,
  };

  if (!previewDemo.effect) return interaction;

  const activation = getPracticePreviewActivation(previewDemo.progress);
  const isActive = activation > 0.12;
  if (previewDemo.effect === 'mouthFlow') {
    return {
      ...interaction,
      mouthOpen: 0.05 + activation * 0.44,
      isOpen: isActive,
      flow: activation,
      fishCount: Math.round(activation * 14),
    };
  }

  if (previewDemo.effect === 'rainGrowth') {
    return {
      ...interaction,
      leftRain: activation,
      rightRain: activation * 0.92,
      rain: activation,
      growth: 0.04 + activation * 0.56,
      ripple: activation,
      isPressing: isActive,
    };
  }

  if (previewDemo.effect === 'popcornGather') {
    return {
      ...interaction,
      sniff: activation,
      isSniffing: isActive,
      flow: activation,
      flowerCount: Math.round(activation * 46),
    };
  }

  return interaction;
}

function getPracticePreviewActivation(progress) {
  const enter = clamp((progress - 0.16) / 0.16, 0, 1);
  const exit = clamp((0.84 - progress) / 0.16, 0, 1);
  const eased = Math.min(enter, exit);
  return eased * eased * (3 - 2 * eased);
}

function InteractionDebugPanel({ contract, onChange, onFinish, onReset, overrides, tuning }) {
  const [copyState, setCopyState] = useState('複製 JSON');
  const [isCollapsed, setIsCollapsed] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1100px)').matches,
  );

  if (!contract) return null;

  const contractRows = [
    ['action', formatActionType(contract.actionType)],
    ['phase', formatSignalPhase(contract.primary.phase)],
    ['value', toPercent(contract.primary.value)],
    ['active', formatDebugValue(contract.primary.active)],
    ['stable', formatDebugValue(contract.primary.stable)],
    ['hold', `${contract.primary.holdSeconds.toFixed(1)} 秒`],
    ['score', contract.game.score],
    ['combo', contract.game.combo],
    ['face', contract.tracking.faceReady ? formatDebugDetectorMode(contract.tracking.detectorMode) : '尚未就緒'],
    [
      'hand',
      contract.tracking.requiresHands
        ? contract.tracking.handReady
          ? formatDebugDetectorMode(contract.tracking.handMode)
          : '尚未就緒'
        : '不需要',
    ],
  ];
  const inputRows = getDebugRows(tuning?.input);
  const signalRows = getDebugRows(tuning?.signal);
  const scoringRows = getDebugRows(tuning?.scoring);
  const handleCopy = async () => {
    try {
      await window.navigator.clipboard.writeText(getSceneTuningExport(contract.sceneId));
      setCopyState('已複製');
    } catch {
      setCopyState('複製失敗');
    }
    window.setTimeout(() => setCopyState('複製 JSON'), 1400);
  };

  return (
    <aside
      className={`interaction-debug-panel ${isCollapsed ? 'is-collapsed' : ''}`}
      aria-label="場景調參面板"
    >
      <header>
        <span>場景調參</span>
        <strong>{getSceneDebugTitle(contract.sceneId)}</strong>
        <p>這裡只影響本機測試數值，不會直接改正式設定。</p>
        <div className="interaction-debug-actions">
          <button type="button" onClick={() => setIsCollapsed((current) => !current)}>
            {isCollapsed ? '展開' : '收合'}
          </button>
          <button className="debug-panel-secondary-action" type="button" onClick={onReset}>重設</button>
          <button className="debug-panel-secondary-action" type="button" onClick={onFinish}>結束測試</button>
          <button className="debug-panel-secondary-action" type="button" onClick={handleCopy}>{copyState}</button>
        </div>
      </header>
      <div className="interaction-debug-body">
        <DebugSection help="目前模型讀到的即時互動狀態，用來判斷動作是不是有被穩定抓到。" title="即時偵測" rows={contractRows} />
        {inputRows.length ? (
          <TuningSection
            help="把臉部偵測原始值轉成 0-100% 的互動強度。通常先調這區，會直接影響靈敏度。"
            onChange={onChange}
            overrides={overrides?.input}
            rows={inputRows}
            section="input"
            title="輸入映射"
          />
        ) : null}
        {signalRows.length ? (
          <TuningSection
            help="控制什麼時候算開始、什麼時候算放開，以及進入狀態要多快。"
            onChange={onChange}
            overrides={overrides?.signal}
            rows={signalRows}
            section="signal"
            title="觸發判斷"
          />
        ) : null}
        {scoringRows.length ? (
          <TuningSection
            help="控制分數、combo、特殊事件和畫面進度。它不影響偵測靈敏度，只影響回饋節奏。"
            onChange={onChange}
            overrides={overrides?.scoring}
            rows={scoringRows}
            section="scoring"
            title="分數與節奏"
          />
        ) : null}
      </div>
    </aside>
  );
}

function DebugSection({ title, help, rows }) {
  return (
    <section className="interaction-debug-section">
      <h2>{title}</h2>
      {help ? <p>{help}</p> : null}
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{getDebugLabel(label)}</dt>
            <dd>{formatDebugValue(value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function TuningSection({ title, help, rows, section, overrides = {}, onChange }) {
  return (
    <section className="interaction-debug-section tuning-section">
      <h2>{title}</h2>
      {help ? <p>{help}</p> : null}
      <div className="tuning-control-list">
        {rows.map(([key, value]) => {
          const bounds = getTuningBounds(key, value);
          const isOverridden = Object.prototype.hasOwnProperty.call(overrides, key);
          const hint = getTuningHint(key);

          return (
            <label className={`tuning-control ${isOverridden ? 'is-overridden' : ''}`} key={`${section}-${key}`}>
              <span>
                <b>{getTuningLabel(key)}</b>
                <em>{formatDebugValue(value)}</em>
                <small>{key}</small>
              </span>
              {hint ? <p>{hint}</p> : null}
              <input
                type="range"
                min={bounds.min}
                max={bounds.max}
                step={bounds.step}
                value={value}
                onChange={(event) => onChange(section, key, parseTuningValue(event.target.value, value))}
              />
              <input
                type="number"
                min={bounds.min}
                max={bounds.max}
                step={bounds.step}
                value={value}
                onChange={(event) => onChange(section, key, parseTuningValue(event.target.value, value))}
              />
            </label>
          );
        })}
      </div>
    </section>
  );
}

function getDebugRows(values = {}) {
  return Object.entries(values).filter(([, value]) => value !== undefined && value !== null);
}

function formatDebugValue(value) {
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '-';
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(value < 1 ? 2 : 1).replace(/\.0$/, '');
  }
  return value || '-';
}

function getSceneDebugTitle(sceneId) {
  const scene = getSceneById(sceneId);
  return scene ? `${scene.title} · ${scene.action}` : sceneId;
}

function formatActionType(actionType) {
  const labels = {
    mouth_open: '張嘴',
    dual_press: '雙側按壓',
    nose_sniff: '皺鼻 / 聞香',
    cheek_puff: '鼓嘴',
  };
  return labels[actionType] || actionType;
}

function formatSignalPhase(phase) {
  const labels = {
    idle: '等待動作',
    entering: '正在進入',
    holding: '穩定維持',
    releasing: '正在放開',
  };
  return labels[phase] || phase;
}

function formatDebugDetectorMode(mode) {
  if (mode === 'real-landmark') return '真實 landmarks';
  if (mode === 'mock-landmark') return '模擬 landmarks';
  if (mode === 'real-hand') return '真實手勢';
  if (mode === 'mock-hand') return '模擬手勢';
  if (mode === 'good-flow') return '狀態良好';
  if (mode === 'mouth-ready') return '等待張嘴';
  return 'Demo';
}

function getDebugLabel(key) {
  const labels = {
    action: '動作類型',
    phase: '目前階段',
    value: '互動強度',
    active: '是否觸發',
    stable: '是否穩定',
    hold: '維持時間',
    score: '目前分數',
    combo: '連續次數',
    fishCount: '吃進魚數',
    flowerCount: '收集花數',
    gardenCycle: '花園循環',
    bubblePops: '泡泡爆破次數',
    justPopped: '剛剛爆破',
    face: '臉部偵測',
    hand: '手勢偵測',
  };
  return labels[key] || key;
}

function getTuningLabel(key) {
  const labels = {
    baseline: '基準值',
    range: '有效幅度',
    wideThreshold: '大動作門檻',
    strongThreshold: '強動作門檻',
    enterThreshold: '開始觸發門檻',
    releaseThreshold: '放開門檻',
    activateMs: '觸發延遲',
    releaseMs: '放開延遲',
    missingToleranceMs: '短暫遺失容忍',
    attackSeconds: '進入速度',
    releaseSeconds: '回落速度',
    oneSideHintThreshold: '單側提示門檻',
    balanceHintThreshold: '平衡提示門檻',
    syncBonusThreshold: '同步獎勵門檻',
    completedHoldSeconds: '完成所需維持',
    flowBase: '基礎流動速度',
    flowByValue: '強度加速',
    flowByBalance: '平衡加速',
    decay: '回落速度',
    minimumFlow: '最低流動值',
    eventBase: '基礎事件量',
    eventByValue: '強度事件加成',
    eventByBalance: '平衡事件加成',
    stableEventBonus: '穩定事件加成',
    strongEventBonus: '強動作加成',
    holdScore: '維持加分',
    balancedHoldScore: '平衡維持加分',
    releaseHoldSeconds: '放開前需維持',
    releaseScore: '完成一次加分',
    comboReleaseScore: '連續完成加分',
    longHoldSeconds: '長維持秒數',
    longHoldScore: '長維持加分',
    longHoldBonusScore: '長維持額外分',
    syncBonusScore: '同步獎勵分',
    specialEvery: '特殊事件間隔',
    specialScore: '特殊事件分數',
    completionModulo: '進度循環長度',
    growthBase: '基礎成長',
    growthByCycle: '循環成長',
    growthByFlow: '流動成長',
    growthByValue: '強度成長',
    sodaBase: '汽水基礎上升',
    sodaBySqueeze: '擠壓上升',
    sodaByBalance: '平衡上升',
    minSodaLevel: '最低液面',
    maxSodaLevel: '最高液面',
    ingredientOffset: '配料起始點',
    ingredientMultiplier: '配料速度',
    ingredientScore: '配料加分',
    sipSeconds: '偷喝觸發時間',
    sipScore: '偷喝加分',
    sipDropBase: '偷喝下降量',
    sipDropStep: '偷喝下降增量',
    sipMinAfterDrop: '偷喝後最低液面',
    sipMaxAfterDrop: '偷喝後最高液面',
    sipBaseLevel: '偷喝起始液面',
    sipLevelStep: '偷喝液面增量',
    sipHintLevel: '偷喝提示液面',
    minBubbleSize: '泡泡最小值',
    maxBubbleSize: '泡泡最大值',
    holdBonusSeconds: '維持獎勵秒數',
    holdEventRate: '維持事件速度',
    holdEventScore: '維持事件加分',
    stageMultiplier: '階段倍率',
    stageScore: '階段加分',
    popThreshold: '爆破門檻',
    popHoldSeconds: '爆破維持秒數',
    resetSize: '重置大小',
    resetStage: '重置階段',
    popScore: '爆破分數',
    comboBonusScore: '連續獎勵分',
  };
  return labels[key] || key;
}

function getTuningHint(key) {
  const hints = {
    baseline: '原始偵測值低於這裡時，會被視為沒有動作。太高會變不敏感。',
    range: '從基準值到滿格需要多少變化量。越小越敏感，越大越穩但比較難觸發。',
    wideThreshold: '張嘴多大才算「張很開」，通常影響 special / 強回饋。',
    strongThreshold: '皺鼻或吸氣多強才算強動作。',
    enterThreshold: '互動強度超過這個值才開始算觸發。調低比較敏感，調高比較不誤觸。',
    releaseThreshold: '互動強度低於這個值才算放開。通常要比開始門檻低，避免一直抖動。',
    activateMs: '動作需要維持幾毫秒才正式觸發。越短越快，越長越穩。',
    releaseMs: '放開需要持續幾毫秒才正式結束。越長越不容易誤判放開。',
    attackSeconds: '畫面反應追上動作的速度。越小越即時。',
    releaseSeconds: '放開後畫面回落的速度。越小回得越快。',
    flowBase: '就算動作不強，畫面仍然推進的基礎速度。',
    flowByValue: '動作越強時，畫面推進加速多少。',
    decay: '動作停止後，畫面能量下降速度。',
    eventBase: '每秒基本產生多少事件，例如魚、花、泡泡。',
    eventByValue: '動作越強時，事件增加多少。',
    releaseScore: '完成一次動作循環時給的分數。',
    syncBonusThreshold: '左右動作同步度超過這裡才有 bonus。',
    syncBonusScore: '左右同步成功時加多少分。',
    completionModulo: '控制畫面進度循環速度；數字越大，進度看起來越慢。',
    growthByValue: '動作越強，泡泡或植物成長越快。',
  };
  return hints[key] || '這是該場景的調參值。調整後會即時影響本機測試，但不會直接寫入正式檔案。';
}

function getTuningBounds(key, value) {
  if (key.toLowerCase().includes('ms')) return { min: 0, max: 1000, step: 10 };
  if (key.toLowerCase().includes('seconds')) return { min: 0, max: 5, step: 0.05 };
  if (key.toLowerCase().includes('score')) return { min: 0, max: 20, step: 1 };
  if (key.toLowerCase().includes('every') || key.toLowerCase().includes('modulo')) {
    return { min: 1, max: 80, step: 1 };
  }
  if (key.toLowerCase().includes('multiplier')) return { min: 0, max: 12, step: 0.1 };
  if (value <= 1) return { min: 0, max: 1, step: 0.01 };
  return { min: 0, max: Math.max(10, Math.ceil(value * 2)), step: 0.1 };
}

function parseTuningValue(value, previousValue) {
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue)) return previousValue;
  return Number.isInteger(previousValue) ? Math.round(nextValue) : nextValue;
}

function TempleGardenScene({ interaction, previewForegroundOnly = false }) {
  const leftRain = clamp(interaction.leftRain || 0, 0, 1);
  const rightRain = clamp(interaction.rightRain || 0, 0, 1);
  const rain = Math.max(leftRain, rightRain);
  const growth = clamp(interaction.growth || 0, 0, 1);
  const gardenSlots = CLOUD_GARDEN_FLOWER_SLOTS.map((slot) => ({
    ...slot,
    growth: clamp((growth - slot.offset) / slot.duration, 0, 1),
    isActive: growth >= slot.offset ? 1 : 0,
  }));
  const drops = useMemo(
    () =>
      Array.from({ length: 38 }, (_, index) => {
        const isLeftSource = index % 2 === 0;
        const laneOffset = (index % 7) - 3;
        const cloudCenter = isLeftSource ? 34 : 66;
        return {
          id: index,
          source: isLeftSource ? 'left' : 'right',
          x: `${cloudCenter + laneOffset * 2.8}%`,
          y: `${38 + ((index * 11) % 10)}%`,
          drift: isLeftSource ? 38 + (index % 4) * 4 : -38 - (index % 4) * 4,
          delay: (index % 13) * 0.09,
          length: 15 + (index % 5) * 6,
          sparkle: index % 7 === 0,
        };
      }),
    [],
  );

  return (
    <div
      className={`temple-garden-scene ${rain > 0.06 ? 'is-pressing' : ''} ${previewForegroundOnly ? 'is-practice-preview' : ''}`}
      style={{
        '--rain': rain,
        '--left-rain': leftRain,
        '--right-rain': rightRain,
        '--growth': growth,
        '--ripple': interaction.ripple || 0,
      }}
      aria-hidden="true"
    >
      <img className="garden-art-background" src={cloudGardenBackgroundAsset} alt="" />
      <div className="garden-cloud garden-cloud-left">
        <span />
        <span />
        <span />
      </div>
      <div className="garden-cloud garden-cloud-right">
        <span />
        <span />
        <span />
      </div>

      <div className="garden-rain">
        {drops.map((drop) => (
          <span
            key={drop.id}
            className={`${drop.source} ${drop.sparkle ? 'is-nourishing' : ''}`}
            style={{
              '--drop-x': drop.x,
              '--drop-y': drop.y,
              '--drop-drift': `${drop.drift}px`,
              '--drop-delay': `${drop.delay}s`,
              '--drop-length': `${drop.length}px`,
            }}
          />
        ))}
      </div>

      <div className="garden-pond">
        <span className="pond-ripple one" />
        <span className="pond-ripple two" />
        <span className="pond-ripple three" />
      </div>

      <div className="garden-growth-zone">
        <span className="garden-impact one" />
        <span className="garden-impact two" />
        <span className="garden-impact three" />
        <span className="garden-impact four" />
        <span className="garden-nutrient one" />
        <span className="garden-nutrient two" />
        <span className="garden-nutrient three" />
        <img className="garden-island-art" src={cloudGardenIslandAsset} alt="" />
        {gardenSlots.map((slot) => (
          <div
            key={slot.id}
            className={`garden-plant-slot garden-asset-flower ${slot.id}`}
            style={{
              '--slot-x': slot.x,
              '--slot-growth': slot.growth,
              '--slot-active': slot.isActive,
              '--slot-scale': slot.scale,
              '--slot-tilt': slot.tilt,
              '--slot-root': slot.root,
              '--slot-depth': slot.depth,
            }}
          >
            {CLOUD_GARDEN_FLOWER_STAGES[slot.type].map((asset, stageIndex) => (
              <img
                key={asset}
                className="garden-flower-stage"
                src={asset}
                alt=""
                style={{
                  '--stage-opacity': clamp(
                    1 - Math.abs(slot.growth * (CLOUD_GARDEN_FLOWER_STAGES[slot.type].length - 1) - stageIndex),
                    0,
                    1,
                  ),
                }}
              />
            ))}
          </div>
        ))}
      </div>

    </div>
  );
}

function LemonSqueezeScene({ interaction }) {
  const squeeze = clamp(interaction.squeeze || 0, 0, 1);
  const sodaLevel = clamp(interaction.sodaLevel || 0.16, 0.1, 0.94);
  const ingredientStage = interaction.ingredientStage || 0;
  const bubbles = useMemo(
    () =>
      Array.from({ length: 28 }, (_, index) => ({
        id: index,
        x: 22 + ((index * 31) % 56),
        y: 19 + ((index * 43) % 70),
        size: 4 + (index % 5) * 2,
        delay: (index % 11) * 0.14,
        duration: 1.8 + (index % 6) * 0.22,
      })),
    [],
  );
  const fizz = useMemo(
    () =>
      Array.from({ length: 18 }, (_, index) => ({
        id: index,
        x: 7 + ((index * 29) % 86),
        y: 12 + ((index * 47) % 66),
        delay: (index % 9) * 0.11,
      })),
    [],
  );

  return (
    <div
      className={`lemon-squeeze-scene ${interaction.isSqueezing ? 'is-squeezing' : ''}`}
      style={{
        '--squeeze': squeeze,
        '--left-squeeze': clamp(interaction.leftPress || 0, 0, 1),
        '--right-squeeze': clamp(interaction.rightPress || 0, 0, 1),
        '--soda-level': sodaLevel,
        '--combo': interaction.combo || 0,
      }}
      aria-hidden="true"
    >
      <div className="lemon-sky-specks">
        {fizz.map((spark) => (
          <span
            key={spark.id}
            style={{
              '--fizz-x': `${spark.x}%`,
              '--fizz-y': `${spark.y}%`,
              '--fizz-delay': `${spark.delay}s`,
            }}
          />
        ))}
      </div>
      <div className="lemon-horizon" />
      <div className="lemon-shore" />
      <div className="lemon-press-board">
        <span className="lemon-board-grip left" />
        <LemonPressHalf side="left" />
        <LemonPressHalf side="right" />
        <span className="lemon-board-grip right" />
      </div>

      <LemonFriend position="far-left" />
      <LemonFriend position="left" />
      <LemonFriend position="right" />
      <LemonFriend position="far-right" />

      <div className="lemon-juice-fall">
        <span />
        <span />
        <span />
      </div>

      <div className="lemon-soda-glass">
        <div className="lemon-soda-liquid">
          <span className="lemon-soda-surface" />
          {bubbles.map((bubble) => (
            <span
              key={bubble.id}
              className="lemon-soda-bubble"
              style={{
                '--bubble-x': `${bubble.x}%`,
                '--bubble-y': `${bubble.y}%`,
                '--bubble-size': `${bubble.size}px`,
                '--bubble-delay': `${bubble.delay}s`,
                '--bubble-duration': `${bubble.duration}s`,
              }}
            />
          ))}
        </div>
        <span className={`lemon-soda-ice one ${ingredientStage >= 1 ? 'is-visible' : ''}`} />
        <span className={`lemon-soda-ice two ${ingredientStage >= 2 ? 'is-visible' : ''}`} />
        <span className={`lemon-soda-slice ${ingredientStage >= 3 ? 'is-visible' : ''}`} />
        <span className="lemon-soda-straw" />
      </div>
    </div>
  );
}

function LemonPressHalf({ side }) {
  return (
    <div className={`lemon-press-half ${side}`}>
      {Array.from({ length: 8 }, (_, index) => <span key={index} />)}
    </div>
  );
}

function LemonFriend({ position }) {
  return (
    <div className={`lemon-friend ${position}`}>
      <span className="lemon-leaf" />
      <span className="lemon-friend-eye left" />
      <span className="lemon-friend-eye right" />
      <span className="lemon-friend-leg left" />
      <span className="lemon-friend-leg right" />
    </div>
  );
}

function WhaleDreamScene({ interaction, previewForegroundOnly = false }) {
  const mouthOpen = clamp(interaction.mouthOpen || 0, 0, 1);
  const fishCount = interaction.fishCount || 0;
  const fishWave = fishCount % 18;
  const sceneRef = useRef(null);
  const mouthAnchorRef = useRef(null);
  const [mouthCenter, setMouthCenter] = useState({ x: 214, y: 492 });
  const [sceneSize, setSceneSize] = useState({ width: 375, height: 620 });
  const fishLayout = useMemo(() => getWhaleFishLayout(sceneSize.width), [sceneSize.width]);
  const whaleLayout = useMemo(() => getWhaleLayout(sceneSize.width), [sceneSize.width]);
  const suction = interaction.isOpen
    ? clamp(mouthOpen * 0.42 + (interaction.flow || 0) * 0.58, 0, 1)
    : 0;
  // Keep the calm seam completely separate from the open-mouth cavity.
  const mouthVisualOpen = interaction.isOpen ? mouthOpen : 0;
  const ambientFish = useMemo(
    () => {
      const swimLanes = [
        { side: 'from-left', x: -14, swimX: 118, midX: 48 },
        { side: 'from-left', x: 4, swimX: 106, midX: 43 },
        { side: 'from-right', x: 106, swimX: -122, midX: -54 },
        { side: 'from-right', x: 88, swimX: -98, midX: -42 },
        { side: 'from-left', x: 28, swimX: 82, midX: 31 },
        { side: 'from-right', x: 72, swimX: -78, midX: -27 },
      ];

      return Array.from({ length: fishLayout.ambientCount }, (_, index) => {
        const lane = swimLanes[index % swimLanes.length];
        return {
          id: index,
          side: lane.side,
          asset: WHALE_FISH_ASSETS[index % WHALE_FISH_ASSETS.length],
          x: `${lane.x + ((index * 13) % 14)}vw`,
          y: `${7 + ((index * 19) % 75)}vh`,
          swimX: `${lane.swimX + ((index % 5) - 2) * 4}vw`,
          midX: `${lane.midX + ((index % 5) - 2) * 2}vw`,
          bobY: -15 + (index % 6) * 6,
          delay: -((index * 0.53) % 8),
          duration: WHALE_FISH_TUNING.ambientDurationBase + (index % 8) * 0.68,
          size: (WHALE_FISH_TUNING.ambientScaleMin + (index % 6) * WHALE_FISH_TUNING.ambientScaleStep) * fishLayout.scaleMultiplier,
          opacity: 0.36 + (index % 5) * 0.1,
          special: index % 19 === 0,
        };
      });
    },
    [fishLayout],
  );
  const fish = useMemo(
    () => {
      const primarySources = [
          { side: 'from-left', x: -116, y: 0.22, curveX: 72 },
          { side: 'from-left', x: -88, y: 0.48, curveX: 58 },
          { side: 'from-left', x: -72, y: 0.72, curveX: 80 },
          { side: 'from-left', x: -44, y: 0.08, curveX: 60 },
        ];
      const nearbySources = [
        { side: 'from-left', x: sceneSize.width * 0.2, y: 0.35, curveX: 44 },
        { side: 'from-left', x: sceneSize.width * 0.31, y: 0.67, curveX: 52 },
      ];
      const rightSources = [
          { side: 'from-right', x: sceneSize.width + 100, y: 0.2, curveX: -82 },
          { side: 'from-right', x: sceneSize.width + 78, y: 0.58, curveX: -66 },
          { side: 'from-right', x: sceneSize.width + 118, y: 0.78, curveX: -92 },
          { side: 'from-right', x: sceneSize.width * 0.8, y: 0.43, curveX: -54 },
      ];
      const sourceRatioTotal = WHALE_FISH_TUNING.leftSourceRatio
        + WHALE_FISH_TUNING.nearbySourceRatio
        + WHALE_FISH_TUNING.rightSourceRatio;
      const primaryCount = Math.max(1, Math.round(
        fishLayout.suctionCount * WHALE_FISH_TUNING.leftSourceRatio / sourceRatioTotal,
      ));
      const nearbyCount = Math.max(1, Math.round(
        fishLayout.suctionCount * WHALE_FISH_TUNING.nearbySourceRatio / sourceRatioTotal,
      ));

      return Array.from({ length: fishLayout.suctionCount }, (_, index) => {
        const sourcePool = index < primaryCount
          ? primarySources
          : index < primaryCount + nearbyCount
            ? nearbySources
            : rightSources;
        const source = sourcePool[index % sourcePool.length];
        const sourceBand = index % 3;
        const startX = source.x + (source.side === 'from-left' ? -((index * 17) % 62) : (index * 17) % 62);
        const startY = sceneSize.height * source.y + ((index * 29) % 68) - 34;
        const mouthX = mouthCenter.x + ((index * 13) % 8) - 4;
        const mouthY = mouthCenter.y + ((index * 17) % 6) - 3;
        const curveY = sourceBand === 0
          ? 92 + (index % 4) * 16
          : sourceBand === 1
            ? -38 + (index % 5) * 14
            : -128 + (index % 4) * 18;
        const pullStrength = (0.72 + (index % 6) * 0.075) * WHALE_FISH_TUNING.suctionStrength;
        const motionVariance = 1 + ((index % 5) - 2) * WHALE_FISH_TUNING.motionVariance;

        return {
          id: index,
          asset: WHALE_FISH_ASSETS[index % WHALE_FISH_ASSETS.length],
          delay: -((index * 0.47) % 6.4),
          duration: (WHALE_FISH_TUNING.suctionDurationBase + (index % 7) * 0.16)
            / (pullStrength * WHALE_FISH_TUNING.finalAcceleration),
          size: (WHALE_FISH_TUNING.suctionScaleMin + (index % 6) * WHALE_FISH_TUNING.suctionScaleStep) * fishLayout.scaleMultiplier,
          x: startX,
          y: startY,
          driftX: mouthX - startX,
          driftY: mouthY - startY,
          curveX: (source.curveX + (index % 5) * (source.side === 'from-left' ? 11 : -11))
            * WHALE_FISH_TUNING.curveStrength * motionVariance,
          curveY: curveY * WHALE_FISH_TUNING.curveStrength * motionVariance,
          cruiseX: (source.side === 'from-left' ? 1 : -1) * (132 + ((index * 23) % 112)),
          cruiseY: -32 + (index % 7) * 11,
          side: source.side,
          opacity: 0.6 + (index % 4) * 0.1,
          special: index % 17 === 0,
        };
      });
    },
    [fishLayout, mouthCenter, sceneSize],
  );
  const stars = useMemo(
    () =>
      Array.from({ length: 28 }, (_, index) => ({
        id: index,
        x: 8 + ((index * 23) % 86),
        y: 4 + ((index * 37) % 62),
        size: 1 + (index % 4) * 0.5,
      })),
    [],
  );

  useEffect(() => {
    const syncMouthCenter = () => {
      const sceneBounds = sceneRef.current?.getBoundingClientRect();
      const anchorBounds = mouthAnchorRef.current?.getBoundingClientRect();
      if (!sceneBounds || !anchorBounds) return;

      const nextCenter = {
        x: Math.round(anchorBounds.left - sceneBounds.left + anchorBounds.width / 2),
        y: Math.round(anchorBounds.top - sceneBounds.top + anchorBounds.height / 2),
      };

      setMouthCenter((current) => (
        current.x === nextCenter.x && current.y === nextCenter.y ? current : nextCenter
      ));
      setSceneSize((current) => {
        const nextSize = {
          width: Math.round(sceneBounds.width),
          height: Math.round(sceneBounds.height),
        };
        return current.width === nextSize.width && current.height === nextSize.height ? current : nextSize;
      });
    };

    const frame = window.requestAnimationFrame(syncMouthCenter);
    window.addEventListener('resize', syncMouthCenter);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', syncMouthCenter);
    };
  }, [mouthOpen, mouthVisualOpen]);

  return (
    <div
      ref={sceneRef}
      className={`whale-dream-scene ${interaction.isOpen ? 'is-open' : ''} ${previewForegroundOnly ? 'is-practice-preview' : ''}`}
      style={{
        '--mouth-open': mouthVisualOpen,
        '--flow': interaction.flow || 0,
        '--suction': suction,
        '--particle-size': `${3 + suction * 4}px`,
        '--particle-duration': `${980 - suction * 320}ms`,
        '--fish-wave': fishWave,
        '--mouth-x': `${mouthCenter.x}px`,
        '--mouth-y': `${mouthCenter.y}px`,
        '--whale-layout-scale': whaleLayout.scale,
      }}
      aria-hidden="true"
    >
      <div className="whale-stars">
        {stars.map((star) => (
          <span
            key={star.id}
            style={{
              '--star-x': `${star.x}%`,
              '--star-y': `${star.y}%`,
              '--star-size': `${star.size}px`,
              '--star-delay': `${(star.id % 9) * 0.22}s`,
            }}
          />
        ))}
      </div>
      <div
        className={`whale-svg whale-art ${interaction.isOpen ? 'is-open' : ''}`}
        style={{ '--whale-scale': whaleLayout.scale }}
        role="img"
        aria-label="Dream whale"
      >
        <img className="whale-art-state whale-art-closed" src={whaleClosedAsset} alt="" />
        <img className="whale-art-state whale-art-open" src={whaleOpenAsset} alt="" />
        <span ref={mouthAnchorRef} className="whale-image-mouth-anchor" />
      </div>
      <div className="whale-seabed" aria-hidden="true">
        <svg viewBox="0 0 1200 180" preserveAspectRatio="none">
          <path className="seabed-hill" d="M 0 150 C 132 112 220 164 360 145 C 520 123 614 165 760 143 C 918 119 1060 157 1200 136 V 180 H 0 Z" />
          <g className="coral-art coral-left-art">
            <path d="M 0 144 C 6 113 8 88 4 64 C 1 49 11 43 18 54 C 25 70 22 94 21 116 C 29 92 35 78 46 72 C 58 65 63 76 55 88 C 45 104 42 124 40 145 Z" />
            <path d="M 25 144 C 28 119 29 96 23 78 C 19 63 29 58 35 72 C 42 89 40 112 39 144 Z" />
          </g>
          <g className="coral-art coral-right-art">
            <path d="M 0 148 C 5 120 2 102 -8 85 C -14 73 -4 65 6 79 C 17 95 19 112 18 132 C 25 111 35 91 48 83 C 61 76 67 89 56 100 C 43 115 41 131 41 148 Z" />
            <path d="M 25 148 C 30 126 34 107 29 91 C 25 79 35 74 41 88 C 48 105 45 128 43 148 Z" />
          </g>
          <g className="coral-art coral-small-art">
            <path d="M 0 151 C 1 129 -3 112 -8 101 C -12 91 -3 85 4 98 C 9 109 9 124 9 137 C 15 122 22 111 32 107 C 42 102 46 112 36 120 C 25 129 23 140 23 151 Z" />
          </g>
        </svg>
      </div>

      <div className="ambient-fish-layer">
        {ambientFish.map((item) => (
          <WhaleFishIllustration
            key={item.id}
            className={`ambient-fish ${item.side} ${item.special ? 'is-special' : ''}`}
            asset={item.asset}
            style={{
              '--ambient-x': item.x,
              '--ambient-y': item.y,
              '--ambient-swim-x': item.swimX,
              '--ambient-mid-x': item.midX,
              '--ambient-bob-y': `${item.bobY}px`,
              '--ambient-scale': item.size,
              '--ambient-delay': `${item.delay}s`,
              '--ambient-duration': `${item.duration}s`,
              '--fish-opacity': item.opacity,
            }}
          />
        ))}
      </div>
      <div className="fish-layer">
        {fish.map((item) => (
          <WhaleFishIllustration
            key={item.id}
            className={`dream-fish ${item.side} ${item.special ? 'is-special' : ''}`}
            asset={item.asset}
            style={{
              '--fish-x': `${item.x}px`,
              '--fish-y': `${item.y}px`,
              '--drift-x': `${item.driftX}px`,
              '--drift-y': `${item.driftY}px`,
              '--curve-x': `${item.curveX}px`,
              '--curve-y': `${item.curveY}px`,
              '--cruise-x': `${item.cruiseX}px`,
              '--cruise-y': `${item.cruiseY}px`,
              '--fish-scale': item.size,
              '--fish-delay': `${item.delay - fishWave * 0.055}s`,
              '--fish-duration': `${item.duration}s`,
              '--fish-opacity': item.opacity,
            }}
          />
        ))}
      </div>
      <div className="whale-suction-particles">
        {Array.from({ length: 18 }, (_, index) => (
          <span
            key={index}
            style={{
              '--particle-x': `${mouthCenter.x + ((index * 41) % 142) - 71}px`,
              '--particle-y': `${mouthCenter.y + ((index * 29) % 112) - 56}px`,
              '--particle-delay': `${(index % 7) * -0.19}s`,
            }}
          />
        ))}
      </div>
      {fishCount > 0 && (
        <div className="fish-eaten-burst" key={fishCount}>
          <span />
          <span />
          <span />
        </div>
      )}
    </div>
  );
}

function WhaleFishIllustration({ asset, className, style }) {
  return (
    <img
      className={className}
      style={style}
      src={asset}
      alt=""
      aria-hidden="true"
    />
  );
}

function WhaleDream2Scene({ interaction }) {
  const mouthOpen = clamp(interaction.mouthOpen || 0, 0, 1);
  const xrFrameRef = useRef(null);

  useEffect(() => {
    const sendMouthState = () => {
      xrFrameRef.current?.contentWindow?.postMessage(
        {
          type: 'face-reset-mouth',
          open: mouthOpen,
          isOpen: Boolean(interaction.isOpen),
          flow: interaction.flow || 0,
        },
        window.location.origin,
      );
    };

    sendMouthState();
    const syncTimer = window.setInterval(sendMouthState, 120);
    return () => window.clearInterval(syncTimer);
  }, [interaction.flow, interaction.isOpen, mouthOpen]);

  return (
    <div
      className={`whale-dream-2-scene ${interaction.isOpen ? 'is-open' : ''}`}
      style={{ '--mouth-open': mouthOpen, '--flow': interaction.flow || 0 }}
      aria-hidden="true"
    >
      <iframe
        ref={xrFrameRef}
        className="pufferfish-xr-frame"
        src="/assets/pufferfish-xr.html"
        title="Pufferfish XR"
        loading="eager"
        allow="camera; fullscreen; xr-spatial-tracking; accelerometer; gyroscope"
        sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-presentation"
      />
    </div>
  );
}

function FlowerCollectorScene({ interaction, previewForegroundOnly = false }) {
  const sniff = clamp(interaction.sniff || 0, 0, 1);
  const collectedCount = interaction.flowerCount || 0;
  const isSniffing = Boolean(interaction.isSniffing);
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === 'undefined' ? 1280 : window.innerWidth,
    height: typeof window === 'undefined' ? 720 : window.innerHeight,
  }));
  const [release, setRelease] = useState({ version: 0, total: 0, retained: 0, lost: 0 });
  const previousSniffingRef = useRef(isSniffing);
  const releaseTimerRef = useRef(null);
  const flightSequenceRef = useRef(0);
  const [flights, setFlights] = useState([]);
  const popcornPieces = useMemo(
    () =>
      Array.from({ length: POPCORN_SOURCE_COUNT }, (_, index) => {
        const sourceZone = POPCORN_TABLETOP_SOURCE_ZONES[
          POPCORN_TABLETOP_ZONE_ORDER[index % POPCORN_TABLETOP_ZONE_ORDER.length]
        ];
        const pathSeed = ((index * 73) % 101) / 101;
        const horizontalSeed = (((index * 29) % 101) / 100) * 2 - 1;
        const verticalSeed = (((index * 47) % 101) / 100) * 2 - 1;
        return {
          id: index,
          asset: POPCORN_PIECE_ASSETS[(index * 5 + 1) % POPCORN_PIECE_ASSETS.length],
          x: sourceZone.x + horizontalSeed * sourceZone.spreadX,
          y: sourceZone.y + verticalSeed * sourceZone.spreadY,
          size: POPCORN_VISUAL_SCALE * (0.72 + (index % 8) * 0.04),
          rotation: -26 + ((index * 29) % 54),
          driftX: -9 + ((index * 17) % 19),
          driftY: -7 + ((index * 13) % 15),
          phase: (index % 11) * 0.24,
          delay: (index % 9) * 0.12,
          pullBias: 0.66 + (index % 6) * 0.055,
          travelRate: 0.82 + (index % 7) * 0.055,
          targetAngle: -Math.PI + pathSeed * Math.PI * 2 + ((index % 5) - 2) * 0.07,
          arcX: -128 + ((index * 23) % 54),
          arcY: -124 + ((index * 31) % 68),
          sway: 9 + (index % 6) * 3.2,
          swayPhase: (index * 1.71) % (Math.PI * 2),
          source: sourceZone.source,
        };
      }),
    [],
  );
  const clusterPieces = useMemo(
    () =>
      Array.from({ length: POPCORN_CLUSTER_LIMIT }, (_, index) => {
        const isPilePiece = index % 4 !== 0;
        const pileAngle = POPCORN_RIM_PILE_ANGLES[index % POPCORN_RIM_PILE_ANGLES.length];
        const angle = isPilePiece
          ? pileAngle + ((((index * 37) % 101) / 100) - 0.5) * 0.78
          : index * 2.3999632297 + ((((index * 29) % 101) / 100) - 0.5) * 0.36;
        const baseRing = Math.floor(index / 11);
        const backfillLayers = isPilePiece && (index * 17) % 7 < 4
          ? 1 + ((index * 11) % 4 === 0 ? 1 : 0)
          : 0;
        const ring = Math.max(0, baseRing - backfillLayers) + (isPilePiece ? (index % 3) * 0.18 : 0);
        return {
          id: index,
          asset: POPCORN_PIECE_ASSETS[(index * 7 + 2) % POPCORN_PIECE_ASSETS.length],
          angle,
          ring,
          offset: -4 + ((index * 17) % 9),
          radialOffset: -1.3 + ((index * 23) % 25) / 10,
          protrusion: index % 23 === 0 ? 2.25 : 0,
          size: POPCORN_VISUAL_SCALE * (0.78 + (index % 6) * 0.035),
          rotation: -28 + ((index * 37) % 58),
          phase: (index % 8) * 0.16,
          dropX: -34 + ((index * 19) % 68),
          dropY: 88 + ((index * 17) % 92),
        };
      }),
    [],
  );
  const cameraLeft = clamp(viewport.width * 0.04, 28, 64);
  const cameraTop = clamp(viewport.height * 0.04, 26, 48);
  const isNarrowViewport = viewport.width <= 559;
  const cameraGroupScale = isNarrowViewport ? POPCORN_MOBILE_CAMERA_SCALE : 1;
  const cameraFrame = {
    left: cameraLeft,
    top: cameraTop,
    width: 102 * cameraGroupScale,
    height: 148 * cameraGroupScale,
  };
  const cameraRimPadding = 13 * cameraGroupScale;
  const accumulatedCount = Math.min(POPCORN_CLUSTER_LIMIT, Math.floor(collectedCount * 0.72));
  const availableCount = Math.max(0, accumulatedCount - release.lost);
  const retainedCount = isSniffing || release.total === 0
    ? availableCount
    : Math.min(availableCount, release.retained);

  useEffect(() => {
    const updateViewport = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useEffect(() => {
    if (releaseTimerRef.current) {
      window.clearInterval(releaseTimerRef.current);
      releaseTimerRef.current = null;
    }

    if (previousSniffingRef.current && !isSniffing && availableCount > 0) {
      const minimumCore = Math.max(8, Math.floor(availableCount * 0.54));
      const initialLoss = Math.min(2, Math.max(1, availableCount - minimumCore));
      setRelease((current) => ({
        version: current.version + 1,
        total: availableCount,
        retained: availableCount - initialLoss,
        lost: current.lost + initialLoss,
      }));

      releaseTimerRef.current = window.setInterval(() => {
        setRelease((current) => {
          const nextRetained = Math.max(minimumCore, current.retained - 1);
          if (nextRetained === current.retained && releaseTimerRef.current) {
            window.clearInterval(releaseTimerRef.current);
            releaseTimerRef.current = null;
          }
          return {
            ...current,
            retained: nextRetained,
            lost: current.lost + (current.retained === nextRetained ? 0 : 1),
          };
        });
      }, 900);
    }
    previousSniffingRef.current = isSniffing;

    return () => {
      if (releaseTimerRef.current) {
        window.clearInterval(releaseTimerRef.current);
        releaseTimerRef.current = null;
      }
    };
  }, [accumulatedCount, isSniffing]);

  const getCameraRimPoint = (angle, extraRing = 0) => {
    const radiusX = cameraFrame.width / 2 + cameraRimPadding + extraRing * 4.8 * cameraGroupScale;
    const radiusY = cameraFrame.height / 2 + cameraRimPadding + extraRing * 3.6 * cameraGroupScale;
    return {
      x: cameraFrame.left + cameraFrame.width / 2 + Math.cos(angle) * radiusX,
      y: cameraFrame.top + cameraFrame.height / 2 + Math.sin(angle) * radiusY,
    };
  };

  const getCurvePoint = (piece, travel) => {
    const start = { x: (piece.x / 100) * viewport.width, y: (piece.y / 100) * viewport.height };
    const target = getCameraRimPoint(piece.targetAngle);
    const control = {
      x: (start.x + target.x) / 2 + piece.arcX,
      y: (start.y + target.y) / 2 + piece.arcY,
    };
    const inverse = 1 - travel;
    const curveStrength = Math.sin(travel * Math.PI) * piece.sway;
    return {
      x: inverse * inverse * start.x + 2 * inverse * travel * control.x + travel * travel * target.x
        + Math.cos(piece.swayPhase + travel * 4.4) * curveStrength,
      y: inverse * inverse * start.y + 2 * inverse * travel * control.y + travel * travel * target.y
        + Math.sin(piece.swayPhase + travel * 3.1) * curveStrength,
    };
  };

  const getPieceMotion = (piece) => {
    const piecesPerWave = 3;
    const waveIndex = Math.floor(piece.id / piecesPerWave);
    const pieceIndexInWave = piece.id % piecesPerWave;
    const sequenceLength = Math.ceil(popcornPieces.length / piecesPerWave) * 2.1;
    const cycle = Math.floor(collectedCount / sequenceLength);
    const launchAt = cycle * sequenceLength + waveIndex * 2.1 + pieceIndexInWave * 0.26;
    const collected = clamp((collectedCount - launchAt) / 5.4, 0, 1);
    const liftProgress = clamp((collected - 0.04) / 0.22, 0, 1);
    const launchProgress = clamp((collected - 0.22) / 0.78, 0, 1);
    const easedLaunch = launchProgress * launchProgress * (3 - 2 * launchProgress);
    const travel = clamp(Math.pow(easedLaunch, piece.travelRate), 0, 0.985);
    return {
      collected,
      liftProgress,
      travel,
      isLifting: liftProgress > 0 && liftProgress < 1,
      isAirborne: travel > 0.012 && collected < 0.96,
      point: getCurvePoint(piece, travel),
    };
  };

  useEffect(() => {
    const eventCount = interaction.suctionEvents || 0;
    if (!isSniffing || eventCount <= 0) return undefined;

    const startedAt = performance.now();
    const nextFlights = Array.from({ length: eventCount }, (_, index) => {
      const piece = popcornPieces[(flightSequenceRef.current + index) % popcornPieces.length];
      flightSequenceRef.current += 1;
      return {
        id: `${interaction.suctionEventSequence}-${index}-${flightSequenceRef.current}`,
        piece,
        startedAt,
      };
    });

    setFlights((current) => [...current, ...nextFlights].slice(-18));
    const timer = window.setTimeout(() => {
      const completedIds = new Set(nextFlights.map((flight) => flight.id));
      setFlights((current) => current.filter((flight) => !completedIds.has(flight.id)));
    }, POPCORN_FLIGHT_DURATION_MS + 80);

    return () => window.clearTimeout(timer);
  }, [interaction.suctionEventSequence, interaction.suctionEvents, isSniffing, popcornPieces]);

  return (
    <div
      className={`popcorn-collector-scene ${isSniffing ? 'is-sniffing' : ''} ${previewForegroundOnly ? 'is-practice-preview' : ''}`}
      style={{
        '--sniff': sniff,
        '--popcorn-count': collectedCount,
      }}
      aria-hidden="true"
    >
      <img className="popcorn-background" src={popcornCollectorBackgroundAsset} alt="" />
      <div className="popcorn-warm-glow" />
      <div className="popcorn-field">
        {popcornPieces.map((piece) => {
          const { collected, travel, isAirborne, point } = getPieceMotion(piece);
          return (
            <div
              key={piece.id}
              className={`collector-popcorn is-source ${isAirborne ? 'is-airborne' : ''} source-${piece.source}`}
              style={{
                '--piece-size': piece.size,
                '--piece-rotation': `${piece.rotation}deg`,
                '--piece-drift-x': `${piece.driftX}px`,
                '--piece-drift-y': `${piece.driftY}px`,
                '--piece-phase': `${piece.phase}s`,
                '--piece-delay': `${piece.delay}s`,
                '--piece-pull': travel,
                '--piece-current-x': `${point.x}px`,
                '--piece-current-y': `${point.y}px`,
                opacity: isSniffing && isAirborne && collected < 0.96 ? 0.62 + sniff * 0.28 : 0,
              }}
            >
              <img src={piece.asset} alt="" />
            </div>
          );
        })}
        {flights.map(({ id, piece }) => {
          const start = {
            x: (piece.x / 100) * viewport.width,
            y: (piece.y / 100) * viewport.height,
          };
          const target = getCameraRimPoint(piece.targetAngle);
          const control = {
            x: (start.x + target.x) / 2 + piece.arcX,
            y: (start.y + target.y) / 2 + piece.arcY,
          };
          return (
            <div
              key={id}
              className="collector-popcorn is-event-flight"
              style={{
                '--piece-size': piece.size,
                '--piece-rotation': `${piece.rotation}deg`,
                '--piece-phase': `${piece.phase}s`,
                '--flight-start-x': `${start.x}px`,
                '--flight-start-y': `${start.y}px`,
                '--flight-control-x': `${control.x}px`,
                '--flight-control-y': `${control.y}px`,
                '--flight-target-x': `${target.x}px`,
                '--flight-target-y': `${target.y}px`,
                '--flight-duration': `${POPCORN_FLIGHT_DURATION_MS}ms`,
              }}
            >
              <img src={piece.asset} alt="" />
            </div>
          );
        })}
        {clusterPieces.map((piece) => {
          const isRetained = piece.id < retainedCount;
          const isDropping = !isSniffing && piece.id >= retainedCount && piece.id < release.total;
          if (!isRetained && !isDropping) return null;
          const clusterPoint = getCameraRimPoint(
            piece.angle,
            piece.ring + piece.radialOffset + piece.protrusion,
          );
          return (
            <div
              key={`${piece.id}-${isDropping ? release.version : 'cluster'}`}
              className={`collector-popcorn is-cluster ${isDropping ? 'is-dropping' : ''}`}
              style={{
                '--piece-size': piece.size * cameraGroupScale,
                '--piece-rotation': `${piece.rotation}deg`,
                '--piece-phase': `${piece.phase}s`,
                '--piece-current-x': `${clusterPoint.x + Math.cos(piece.angle * 2.7 + piece.phase) * piece.offset}px`,
                '--piece-current-y': `${clusterPoint.y + Math.sin(piece.angle * 1.9 + piece.phase) * piece.offset}px`,
                '--cluster-drop-x': `${piece.dropX}px`,
                '--cluster-drop-y': `${piece.dropY}px`,
              }}
            >
              <img src={piece.asset} alt="" />
            </div>
          );
        })}
        {!isSniffing && release.total > release.retained && popcornPieces.slice(0, 2).map((piece, index) => {
          const point = getCurvePoint(piece, 0.3 + (index % 4) * 0.09);
          return (
            <div
              key={`in-flight-drop-${release.version}-${piece.id}`}
              className="collector-popcorn is-release-drop"
              style={{
                '--piece-size': piece.size,
                '--piece-rotation': `${piece.rotation}deg`,
                '--piece-current-x': `${point.x}px`,
                '--piece-current-y': `${point.y}px`,
                '--cluster-drop-x': `${-28 + index * 7}px`,
                '--cluster-drop-y': `${110 + (index % 4) * 24}px`,
              }}
            >
              <img src={piece.asset} alt="" />
            </div>
          );
        })}
      </div>
      <img className="popcorn-bucket" src={popcornCollectorBucketAsset} alt="" />
      <img className="popcorn-foreground" src={popcornCollectorForegroundAsset} alt="" />
      <div className="popcorn-tabletop-seeds">
        {popcornPieces.map((piece) => {
          const { collected, liftProgress, travel, isLifting, point } = getPieceMotion(piece);
          const lift = Math.min(travel, 0.22) / 0.22;
          return (
            <div
              key={`tabletop-${piece.id}`}
              className={`tabletop-popcorn-seed ${isLifting ? 'is-lifting' : ''}`}
              style={{
                '--piece-size': piece.size,
                '--piece-rotation': `${piece.rotation}deg`,
                '--piece-phase': `${piece.phase}s`,
                '--piece-current-x': `${point.x}px`,
                '--piece-current-y': `${point.y}px`,
                '--lift-progress': liftProgress,
                opacity: collected > 0.96 ? 0 : clamp(1 - lift * 1.18, 0, 0.9),
              }}
            >
              <img src={piece.asset} alt="" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BubbleGumBunnyScene({ interaction }) {
  const puff = clamp(interaction.puff || 0, 0, 1);
  const bubbleSize = clamp(interaction.bubbleSize || 0.07, 0.05, 1);
  const bubblePops = interaction.bubblePops || 0;
  const [isBursting, setIsBursting] = useState(false);
  const lastBubblePopsRef = useRef(bubblePops);
  const sparkles = useMemo(
    () =>
      Array.from({ length: 18 }, (_, index) => ({
        id: index,
        x: 12 + ((index * 31) % 78),
        y: 14 + ((index * 47) % 68),
        delay: (index % 9) * 0.12,
        size: 2 + (index % 4),
      })),
    [],
  );
  const hearts = useMemo(
    () =>
      Array.from({ length: 8 }, (_, index) => ({
        id: index,
        x: 16 + ((index * 53) % 70),
        y: 24 + ((index * 41) % 58),
        delay: (index % 6) * 0.22,
      })),
    [],
  );

  useEffect(() => {
    if (bubblePops > lastBubblePopsRef.current) {
      setIsBursting(true);
      const timer = window.setTimeout(() => setIsBursting(false), 520);
      lastBubblePopsRef.current = bubblePops;
      return () => window.clearTimeout(timer);
    }
    lastBubblePopsRef.current = bubblePops;
    return undefined;
  }, [bubblePops]);

  return (
    <div
      className={`bubble-bunny-scene ${interaction.isPuffing ? 'is-puffing' : ''} ${interaction.justPopped ? 'is-popping' : ''} ${isBursting ? 'is-bursting' : ''}`}
      style={{
        '--puff': puff,
        '--bubble-size': bubbleSize,
        '--combo': interaction.combo || 0,
      }}
      aria-hidden="true"
    >
      <div className="bunny-sparkles">
        {sparkles.map((sparkle) => (
          <span
            key={sparkle.id}
            style={{
              '--sparkle-x': `${sparkle.x}%`,
              '--sparkle-y': `${sparkle.y}%`,
              '--sparkle-delay': `${sparkle.delay}s`,
              '--sparkle-size': `${sparkle.size}px`,
            }}
          />
        ))}
      </div>

      <div className="bunny-hearts">
        {hearts.map((heart) => (
          <span
            key={heart.id}
            style={{
              '--heart-x': `${heart.x}%`,
              '--heart-y': `${heart.y}%`,
              '--heart-delay': `${heart.delay}s`,
            }}
          />
        ))}
      </div>

      <div className="bunny-character">
        <span className="bunny-ear left" />
        <span className="bunny-ear right" />
        <span className="bunny-head" />
        <span className="bunny-cheek left" />
        <span className="bunny-cheek right" />
        <span className="bunny-eye left" />
        <span className="bunny-eye right" />
        <span className="bunny-mouth" />
        <span className="gum-bubble" />
      </div>
      {bubblePops > 0 && (
        <div className="bubble-pop-burst" key={bubblePops}>
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      )}

    </div>
  );
}

function getFlowerDockPoint(index, margin = 16) {
  const preview = {
    x: 30,
    y: 30,
    width: 102,
    height: 148,
    margin,
  };
  const side = index % 4;
  const t = ((index * 37) % 100) / 100;

  if (side === 0) {
    return {
      dockX: preview.x - preview.margin,
      dockY: preview.y + preview.height * t,
    };
  }
  if (side === 1) {
    return {
      dockX: preview.x + preview.width + preview.margin,
      dockY: preview.y + preview.height * t,
    };
  }
  if (side === 2) {
    return {
      dockX: preview.x + preview.width * t,
      dockY: preview.y - preview.margin,
    };
  }
  return {
    dockX: preview.x + preview.width * t,
    dockY: preview.y + preview.height + preview.margin,
  };
}

function TrackingVideo({ videoRef, isDemoMode }) {
  if (isDemoMode) {
    return <div className="tracking-video-placeholder" />;
  }

  return <video ref={videoRef} className="tracking-video" autoPlay playsInline muted />;
}

function CameraPreview({ detectorMode, handMode, isDemoMode, isCameraUnavailable, previewVideoRef }) {
  return (
    <div className="camera-preview" aria-label="Front camera preview">
      <div className="preview-header">
        <span className="preview-dot" />
        <span>Front camera</span>
      </div>
      <div className="preview-video-shell">
        {isCameraUnavailable ? (
          <span className="scene-camera-off" aria-hidden="true">
            <svg viewBox="0 -960 960 960" focusable="false">
              <path d="M400-480Zm240 320H467q13-18 22.5-38t16.5-42h134v-480H160v131q-22 6-42 15.5T80-551v-169q0-33 23.5-56.5T160-800h480q33 0 56.5 23.5T720-720v180l160-160v440L720-420v180q0 33-23.5 56.5T640-160ZM98.5-178.5Q40-237 40-320t58.5-141.5Q157-520 240-520t141.5 58.5Q440-403 440-320t-58.5 141.5Q323-120 240-120T98.5-178.5ZM240-200q8 0 14-6t6-14q0-8-6-14t-14-6q-8 0-14 6t-6 14q0 8 6 14t14 6Zm-20-80h40v-160h-40v160Z" />
            </svg>
          </span>
        ) : isDemoMode ? (
          <div className="demo-mirror" />
        ) : (
          <video ref={previewVideoRef} className="preview-video" autoPlay playsInline muted />
        )}
      </div>
      <div className="preview-status">
        {formatDetectorMode(detectorMode)} face · {formatDetectorMode(handMode)} hand
      </div>
    </div>
  );
}

function FingertipDot({ point, side, isOnTrack }) {
  return (
    <g className={`fingertip-dot ${side} ${isOnTrack ? 'on-track' : ''}`}>
      <line className="finger-control-line" x1={point.x} y1={point.y + 36} x2={point.x} y2={point.y} />
      <circle cx={point.x} cy={point.y} r="15" />
      <circle cx={point.x} cy={point.y} r="6" />
    </g>
  );
}

function formatTime(value) {
  const minutes = Math.floor(value / 60);
  const seconds = String(value % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function toPercent(value) {
  return `${Math.round((value || 0) * 100)}%`;
}

function formatDetectorMode(mode) {
  if (mode === 'real-landmark') return 'Real';
  if (mode === 'mock-landmark') return 'Mock';
  return 'Demo';
}

function isInteractionDebugEnabled() {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('debug') === '1';
}

function captureRoutineSnapshot(options) {
  try {
    return createRoutineSnapshot(options);
  } catch {
    // A photo is optional; a failed canvas capture must never interrupt gameplay.
    return null;
  }
}

function createRoutineSnapshot({ video, isDemoMode, sceneId, score, features, displayRect, interaction }) {
  if (isDemoMode || !video?.videoWidth || !video?.videoHeight || video.readyState < 2) {
    return null;
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const width = 360;
  const height = 440;
  canvas.width = width;
  canvas.height = height;

  const crop = getPortraitCrop({ video, features, displayRect, targetAspect: width / height });
  context.save();
  // The gameplay preview is mirrored, so keep the Result portrait in that same orientation.
  context.translate(width, 0);
  context.scale(-1, 1);
  context.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
  context.restore();

  const interactionStrength = getSnapshotInteractionStrength(interaction);
  const faceQuality = getSnapshotFaceQuality(features?.bounds, displayRect);
  const qualityScore = Math.round(
    Math.min(100, 28 + faceQuality * 0.42 + interactionStrength * 0.22 + Math.min(100, score) * 0.08),
  );

  return {
    id: `${sceneId}-${Date.now()}`,
    sceneId,
    image: canvas.toDataURL('image/webp', 0.82),
    capturedAt: Date.now(),
    qualityScore,
    score,
  };
}

function getPortraitCrop({ video, features, displayRect, targetAspect }) {
  const fallbackHeight = video.videoHeight;
  const fallbackWidth = Math.min(video.videoWidth, fallbackHeight * targetAspect);
  const fallback = {
    x: (video.videoWidth - fallbackWidth) / 2,
    y: Math.max(0, (video.videoHeight - fallbackWidth / targetAspect) / 2),
    width: fallbackWidth,
    height: fallbackWidth / targetAspect,
  };
  const bounds = features?.bounds;

  if (!bounds || !displayRect?.width || !displayRect?.height) return fallback;

  const displayWidth = Math.max(bounds.width * 1.62, bounds.height * targetAspect * 1.28);
  const displayHeight = displayWidth / targetAspect;
  const displayX = bounds.center.x - displayWidth / 2;
  const displayY = bounds.center.y - displayHeight * 0.45;
  const normalizedX = (displayX - displayRect.x) / displayRect.width;
  const normalizedY = (displayY - displayRect.y) / displayRect.height;
  const normalizedWidth = displayWidth / displayRect.width;
  const normalizedHeight = displayHeight / displayRect.height;
  const sourceWidth = Math.min(video.videoWidth, Math.max(1, normalizedWidth * video.videoWidth));
  const sourceHeight = Math.min(video.videoHeight, Math.max(1, normalizedHeight * video.videoHeight));

  // Face landmarks are mapped into the mirrored stage, while the video pixels are not.
  const sourceX = clampNumber(
    (1 - normalizedX - normalizedWidth) * video.videoWidth,
    0,
    Math.max(0, video.videoWidth - sourceWidth),
  );
  const sourceY = clampNumber(
    normalizedY * video.videoHeight,
    0,
    Math.max(0, video.videoHeight - sourceHeight),
  );

  return { x: sourceX, y: sourceY, width: sourceWidth, height: sourceHeight };
}

function getSnapshotInteractionStrength(interaction) {
  const values = [
    interaction?.flow,
    interaction?.mouthOpen,
    interaction?.leftPress,
    interaction?.rightPress,
    interaction?.sniffStrength,
    interaction?.puffStrength,
    interaction?.completion,
  ].filter(Number.isFinite);
  const strongest = values.length ? Math.max(...values) : 0;
  return Math.round(Math.min(1, Math.max(interaction?.isOnTrack ? 0.7 : 0, strongest)) * 100);
}

function getSnapshotFaceQuality(bounds, displayRect) {
  if (!bounds || !displayRect?.width || !displayRect?.height) return 34;
  const stageCenterX = displayRect.x + displayRect.width / 2;
  const stageCenterY = displayRect.y + displayRect.height / 2;
  const offset = Math.hypot(
    (bounds.center.x - stageCenterX) / displayRect.width,
    (bounds.center.y - stageCenterY) / displayRect.height,
  );
  const size = Math.min(1, (bounds.width * bounds.height) / (displayRect.width * displayRect.height * 0.14));
  return Math.round(Math.max(0, 100 - offset * 180) * 0.72 + size * 28);
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createTemplePressTargets(features, size) {
  const width = size.width || 375;
  const height = size.height || 812;
  if (!features?.leftEye?.outer || !features?.rightEye?.outer) {
    const fallbackY = height * 0.28;
    return {
      left: { x: width * 0.22, y: fallbackY, tolerance: Math.max(42, width * 0.13) },
      right: { x: width * 0.78, y: fallbackY, tolerance: Math.max(42, width * 0.13) },
    };
  }

  const eyes = [features.leftEye, features.rightEye].sort((a, b) => a.center.x - b.center.x);
  const faceScale = features.faceScale || Math.max(width * 0.46, 160);
  // Keep the zones around the temples generous enough for natural finger drift,
  // while still requiring each hand to remain on its own side of the face.
  const outward = clamp(faceScale * 0.105, 20, 48);
  const lift = clamp(faceScale * 0.02, 3, 12);
  const tolerance = clamp(faceScale * 0.3, 70, 126);

  return {
    left: {
      x: clamp(eyes[0].center.x - outward, 18, width - 18),
      y: clamp(eyes[0].center.y - lift, 28, height - 28),
      tolerance,
    },
    right: {
      x: clamp(eyes[1].center.x + outward, 18, width - 18),
      y: clamp(eyes[1].center.y - lift, 28, height - 28),
      tolerance,
    },
  };
}

function createTemplePressTrajectories(targets, size) {
  const width = size.width || 375;
  const height = size.height || 812;
  const leftTarget = targets?.left || { x: width * 0.22, y: height * 0.28, tolerance: 48 };
  const rightTarget = targets?.right || { x: width * 0.78, y: height * 0.28, tolerance: 48 };

  const left = createGesturePath({
    id: 'temple-left-press',
    start: { x: clamp(leftTarget.x - width * 0.14, 8, width - 8), y: leftTarget.y + height * 0.015 },
    control: { x: leftTarget.x - width * 0.06, y: leftTarget.y },
    end: leftTarget,
    tolerance: leftTarget.tolerance,
  });
  const right = createGesturePath({
    id: 'temple-right-press',
    start: { x: clamp(rightTarget.x + width * 0.14, 8, width - 8), y: rightTarget.y + height * 0.015 },
    control: { x: rightTarget.x + width * 0.06, y: rightTarget.y },
    end: rightTarget,
    tolerance: rightTarget.tolerance,
  });

  return { left, right, all: [left, right] };
}

function createLemonPressTargets(features, size) {
  const width = size.width || 375;
  const height = size.height || 812;
  const fallbackY = height * 0.3;

  if (!features?.face?.noseCenter || !features?.leftEye?.center || !features?.rightEye?.center) {
    return {
      left: { x: width * 0.42, y: fallbackY, tolerance: Math.max(34, width * 0.11) },
      right: { x: width * 0.58, y: fallbackY, tolerance: Math.max(34, width * 0.11) },
    };
  }

  const eyeDistance = Math.max(72, Math.abs(features.rightEye.center.x - features.leftEye.center.x));
  const faceScale = features.faceScale || Math.max(width * 0.42, 150);
  const sideOffset = clamp(eyeDistance * 0.22, 24, 52);
  const lift = clamp(faceScale * 0.08, 12, 34);
  const tolerance = clamp(faceScale * 0.14, 38, 72);
  const nose = features.face.noseCenter;

  return {
    left: {
      x: clamp(nose.x - sideOffset, 18, width - 18),
      y: clamp(nose.y - lift, 34, height - 34),
      tolerance,
    },
    right: {
      x: clamp(nose.x + sideOffset, 18, width - 18),
      y: clamp(nose.y - lift, 34, height - 34),
      tolerance,
    },
  };
}

function createLemonPressTrajectories(targets, size) {
  const width = size.width || 375;
  const height = size.height || 812;
  const leftTarget = targets?.left || { x: width * 0.42, y: height * 0.3, tolerance: 44 };
  const rightTarget = targets?.right || { x: width * 0.58, y: height * 0.3, tolerance: 44 };

  const left = createGesturePath({
    id: 'lemon-left-squeeze',
    start: { x: clamp(leftTarget.x - width * 0.12, 8, width - 8), y: leftTarget.y + height * 0.012 },
    control: { x: leftTarget.x - width * 0.04, y: leftTarget.y },
    end: leftTarget,
    tolerance: leftTarget.tolerance,
  });
  const right = createGesturePath({
    id: 'lemon-right-squeeze',
    start: { x: clamp(rightTarget.x + width * 0.12, 8, width - 8), y: rightTarget.y + height * 0.012 },
    control: { x: rightTarget.x + width * 0.04, y: rightTarget.y },
    end: rightTarget,
    tolerance: rightTarget.tolerance,
  });

  return { left, right, all: [left, right] };
}

function createGesturePath({ id, start, control, end, tolerance }) {
  return {
    id,
    start,
    control,
    end,
    tolerance,
    points: sampleQuadraticPoints(start, control, end, 34),
  };
}

function sampleQuadraticPoints(start, control, end, count) {
  return Array.from({ length: count }, (_, index) => {
    const t = count === 1 ? 0 : index / (count - 1);
    const inverse = 1 - t;
    return {
      x: inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x,
      y: inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * end.y,
    };
  });
}

function scoreTemplePress({ features, fingertips, targets, timestamp, progressState, stageProgress, tuning }) {
  const scoring = tuning.scoring;
  const leftRaw = scoreTempleSide({ point: fingertips.left, target: targets?.left });
  const rightRaw = scoreTempleSide({ point: fingertips.right, target: targets?.right });
  const left = updateInteractionSignal(leftRaw.available ? leftRaw.press : null, timestamp, progressState.leftSignal, tuning.signal);
  const right = updateInteractionSignal(rightRaw.available ? rightRaw.press : null, timestamp, progressState.rightSignal, tuning.signal);
  const bothPressing = left.active && right.active;
  const onePressing = left.active || right.active || left.value > scoring.oneSideHintThreshold || right.value > scoring.oneSideHintThreshold;
  const balanced = 1 - Math.min(1, Math.abs(left.value - right.value));
  const deltaSeconds = Math.max(left.deltaSeconds, right.deltaSeconds);

  if (bothPressing) {
    const holdQuality = clamp((left.value + right.value) / 2, 0, 1) * balanced;
    progressState.flow = clamp(progressState.flow + deltaSeconds * (scoring.flowBase + holdQuality * scoring.flowByBalance), 0, 1);
    progressState.gardenNourishment = clamp(
      (progressState.gardenNourishment || 0) + deltaSeconds * (scoring.growthBase + holdQuality * scoring.growthByFlow),
      0,
      1,
    );
    progressState.score += deltaSeconds * (scoring.holdBase + holdQuality * scoring.holdByQuality);

    const nourishmentEvents = consumeTimedEvents(progressState, 'gardenNourishment', scoring.nourishmentRate, deltaSeconds);
    progressState.score += nourishmentEvents * (balanced > scoring.syncBonusThreshold ? scoring.stableNourishmentBonus : scoring.nourishmentBonus);
    progressState.gardenCycle += nourishmentEvents;
  } else {
    progressState.flow = clamp(progressState.flow - deltaSeconds * scoring.decay, scoring.minimumFlow, 1);
  }

  const leftRain = clamp(left.value * (left.active ? 1 : 0.58), 0, 1);
  const rightRain = clamp(right.value * (right.active ? 1 : 0.58), 0, 1);
  const rain = bothPressing ? clamp((leftRain + rightRain) / 2, 0, 1) : Math.max(leftRain, rightRain) * 0.48;
  const growth = clamp(progressState.gardenNourishment || 0, 0, 1);
  progressState.score = Math.min(MAX_SCENE_SCORE, progressState.score);

  return {
    score: Math.round(progressState.score),
    completion: growth,
    feedback: getTemplePressFeedback({ features, fingertips, bothPressing, onePressing, balanced, growth, tuning }),
    isOnTrack: bothPressing,
    leftPress: left.value,
    rightPress: right.value,
    leftRain,
    rightRain,
    rain,
    growth,
    gardenCycle: progressState.gardenCycle,
    ripple: clamp(rain * 0.78 + growth * 0.28, 0, 1),
    flow: progressState.flow,
    isPressing: bothPressing,
    combo: progressState.combo,
    holdSeconds: Math.min(left.holdSeconds, right.holdSeconds),
    justActivated: left.justActivated || right.justActivated,
    justReleased: left.justReleased || right.justReleased,
    phase: bothPressing ? 'holding' : onePressing ? 'detecting' : 'idle',
  };
}

function scoreTempleSide({ point, target }) {
  if (!point || !target) {
    return { press: 0, distance: Infinity, available: false };
  }
  const distance = Math.hypot(point.x - target.x, point.y - target.y);
  const tolerance = target.tolerance || 54;
  const press = clamp(1 - distance / tolerance, 0, 1);
  return { press, distance, available: true };
}

function getTemplePressFeedback({ features, fingertips, bothPressing, onePressing, balanced, growth, tuning }) {
  if (!features) return 'Find your face';
  if (!fingertips?.left && !fingertips?.right) return 'Show both index fingers';
  if (!fingertips.left || !fingertips.right) return 'Use both hands on your temples';
  if (!onePressing) return 'Move both fingers to your temples';
  if (!bothPressing) return 'Press both sides at the same time';
  if (balanced < tuning.scoring.balanceHintThreshold) return 'Balance both sides gently';
  if (growth > 0.88) return 'Beautiful, your garden is in bloom';
  if (growth > 0.58) return 'Keep holding gently to help the garden bloom';
  return 'Hold both temples calmly to nourish the garden';
}

function scoreLemonSqueeze({ features, fingertips, targets, timestamp, progressState, stageProgress, tuning }) {
  const scoring = tuning.scoring;
  const leftRaw = scoreTempleSide({ point: fingertips.left, target: targets?.left });
  const rightRaw = scoreTempleSide({ point: fingertips.right, target: targets?.right });
  const left = updateInteractionSignal(leftRaw.available ? leftRaw.press : null, timestamp, progressState.leftSignal, tuning.signal);
  const right = updateInteractionSignal(rightRaw.available ? rightRaw.press : null, timestamp, progressState.rightSignal, tuning.signal);
  const bothPressing = left.active && right.active;
  const onePressing = left.active || right.active || left.value > scoring.oneSideHintThreshold || right.value > scoring.oneSideHintThreshold;
  const balanced = 1 - Math.min(1, Math.abs(left.value - right.value));
  const squeeze = clamp((left.value + right.value) / 2, 0, 1);
  const elapsedSeconds = Math.max(left.deltaSeconds, right.deltaSeconds);

  if (bothPressing) {
    progressState.sodaLevel = clamp(
      progressState.sodaLevel + (scoring.sodaBase + squeeze * scoring.sodaBySqueeze + balanced * scoring.sodaByBalance) * elapsedSeconds,
      scoring.minSodaLevel,
      scoring.maxSodaLevel,
    );
  }

  const ingredientStage = Math.min(4, Math.max(0, Math.floor((progressState.sodaLevel - scoring.ingredientOffset) * scoring.ingredientMultiplier)));
  if (ingredientStage > progressState.ingredientStage) {
    progressState.score += (ingredientStage - progressState.ingredientStage) * scoring.ingredientScore;
    progressState.ingredientStage = ingredientStage;
  }

  if (left.justReleased || right.justReleased) {
    const completedBoth = left.holdSeconds >= scoring.completedHoldSeconds && right.holdSeconds >= scoring.completedHoldSeconds;
    if (completedBoth) {
      progressState.combo = Math.min(12, progressState.combo + 1);
      progressState.score += scoring.releaseScore + (balanced > scoring.syncBonusThreshold ? scoring.syncBonusScore : 0);
    }
  }

  let sip = 0;
  if (progressState.sodaLevel > progressState.nextSipLevel) {
    progressState.sipCycle += elapsedSeconds;
    sip = Math.sin(Math.min(1, progressState.sipCycle / scoring.sipSeconds) * Math.PI);
    if (progressState.sipCycle > scoring.sipSeconds) {
      progressState.sodaLevel = clamp(progressState.sodaLevel - (scoring.sipDropBase + (progressState.sipCount % 3) * scoring.sipDropStep), scoring.sipMinAfterDrop, scoring.sipMaxAfterDrop);
      progressState.score += scoring.sipScore;
      progressState.sipCount += 1;
      progressState.sipCycle = 0;
      progressState.nextSipLevel = scoring.sipBaseLevel + (progressState.sipCount % 3) * scoring.sipLevelStep;
      progressState.ingredientStage = Math.min(4, Math.max(0, Math.floor((progressState.sodaLevel - scoring.ingredientOffset) * scoring.ingredientMultiplier)));
    }
  } else {
    progressState.sipCycle = Math.max(0, progressState.sipCycle - elapsedSeconds * 1.5);
  }

  progressState.score = Math.min(MAX_SCENE_SCORE, progressState.score);

  return {
    score: Math.round(progressState.score),
    completion: clamp(progressState.sodaLevel, 0, 1),
    feedback: getLemonSqueezeFeedback({ features, fingertips, bothPressing, onePressing, balanced, sodaLevel: progressState.sodaLevel, tuning }),
    isOnTrack: bothPressing && balanced > scoring.balanceHintThreshold,
    leftPress: left.value,
    rightPress: right.value,
    squeeze,
    sodaLevel: progressState.sodaLevel,
    ingredientStage: progressState.ingredientStage,
    sip,
    combo: progressState.combo,
    flow: progressState.sodaLevel,
    isSqueezing: bothPressing,
    holdSeconds: Math.min(left.holdSeconds, right.holdSeconds),
    justActivated: left.justActivated || right.justActivated,
    justReleased: left.justReleased || right.justReleased,
    phase: bothPressing ? 'holding' : onePressing ? 'detecting' : 'idle',
  };
}

function getLemonSqueezeFeedback({ features, fingertips, bothPressing, onePressing, balanced, sodaLevel, tuning }) {
  if (!features?.face?.noseCenter) return 'Find your face';
  if (!fingertips?.left && !fingertips?.right) return 'Show both index fingers';
  if (!fingertips.left || !fingertips.right) return 'Use both fingers beside your nose';
  if (!onePressing) return 'Move fingers beside your nose bridge';
  if (!bothPressing) return 'Squeeze both lemon halves together';
  if (balanced < tuning.scoring.balanceHintThreshold) return 'Balance left and right squeeze';
  if (sodaLevel > tuning.scoring.sipHintLevel) return 'Tiny friend is stealing a sip';
  return 'Fresh squeeze, bubbles rising';
}

function getInitialFeedback(sceneId) {
  return getSceneTuning(sceneId).feedbackInitial;
}

function scoreCheekPuff({ features, timestamp, progressState, stageProgress, tuning }) {
  const scoring = tuning.scoring;
  const ratio = features?.cheeks?.puffRatio;
  const rawPuff = Number.isFinite(ratio) ? clamp((ratio - tuning.input.baseline) / tuning.input.range, 0, 1) : null;
  const signal = updateInteractionSignal(rawPuff, timestamp, progressState.signal, tuning.signal);
  const puff = signal.value;
  const isPuffing = signal.active;
  const isStable = signal.phase === 'holding';
  const elapsedSeconds = signal.deltaSeconds;

  if (isPuffing) {
    progressState.bubbleSize = clamp(progressState.bubbleSize + (scoring.growthBase + puff * scoring.growthByValue) * elapsedSeconds, scoring.minBubbleSize, scoring.maxBubbleSize);
    const holdEvents = consumeTimedEvents(progressState, 'bubbleHold', signal.holdSeconds > scoring.holdBonusSeconds ? scoring.holdEventRate : 0, elapsedSeconds);
    progressState.score += holdEvents * scoring.holdEventScore;
  } else {
    progressState.bubbleSize = clamp(progressState.bubbleSize - scoring.decay * elapsedSeconds, scoring.minBubbleSize, scoring.maxBubbleSize);
  }

  const nextStage = Math.min(4, Math.floor(progressState.bubbleSize * scoring.stageMultiplier));
  if (nextStage > progressState.stage) {
    progressState.score += (nextStage - progressState.stage) * scoring.stageScore;
    progressState.stage = nextStage;
  }

  if (progressState.bubbleSize >= scoring.popThreshold) {
    progressState.maxHold += elapsedSeconds;
    if (progressState.maxHold >= scoring.popHoldSeconds) {
      progressState.bubbleSize = scoring.resetSize;
      progressState.stage = scoring.resetStage;
      progressState.maxHold = 0;
      progressState.bubblePops += 1;
      progressState.justPopped = true;
      progressState.combo = Math.min(12, progressState.combo + 1);
      progressState.score += scoring.popScore + (progressState.combo >= 3 ? scoring.comboBonusScore : 0);
    } else {
      progressState.justPopped = false;
    }
  } else {
    progressState.maxHold = 0;
    progressState.justPopped = false;
  }

  if (signal.justReleased && signal.holdSeconds >= scoring.releaseHoldSeconds) {
    progressState.combo = Math.min(12, progressState.combo + 1);
    progressState.score += scoring.releaseScore + (signal.holdSeconds >= scoring.longHoldSeconds ? scoring.longHoldBonusScore : 0);
  }
  progressState.score = Math.min(MAX_SCENE_SCORE, progressState.score);

  return {
    score: Math.round(progressState.score),
    completion: progressState.bubbleSize,
    feedback: getCheekPuffFeedback({ features, isPuffing, isStable, bubbleSize: progressState.bubbleSize, combo: progressState.combo || 0 }),
    isOnTrack: isPuffing && isStable,
    puff,
    bubbleSize: progressState.bubbleSize,
    bubbleStage: progressState.stage,
    bubblePops: progressState.bubblePops,
    justPopped: progressState.justPopped,
    combo: progressState.combo,
    isPuffing,
    holdSeconds: signal.holdSeconds,
    justActivated: signal.justActivated,
    justReleased: signal.justReleased,
    phase: signal.phase,
  };
}

function getCheekPuffFeedback({ features, isPuffing, isStable, bubbleSize, combo }) {
  if (!features?.cheeks) return 'Find your face';
  if (!isPuffing) return 'Puff your cheeks, then relax softly';
  if (!isStable) return 'Hold the bubble steady';
  if (combo >= 3) return 'Combo rhythm, bunny loves it';
  if (bubbleSize > 0.78) return 'Big bubble sparkle bonus';
  return 'Nice puff, keep the bubble growing';
}

function scoreNoseSniff({ features, timestamp, progressState, stageProgress, tuning }) {
  const scoring = tuning.scoring;
  const noseDiagnostics = features?.nose?.diagnostics || null;
  // Use MediaPipe expression blendshapes only. The 2D landmark fallback changes
  // with head pitch, so it must never start a Popcorn interaction on its own.
  const blendshapeSignal = noseDiagnostics?.blendshapeSignal;
  const rawSniff = Number.isFinite(blendshapeSignal) && blendshapeSignal > tuning.input.minimumBlendshapeSignal
    ? clamp((blendshapeSignal - tuning.input.baseline) / tuning.input.range, 0, 1)
    : 0;
  const signal = updateInteractionSignal(rawSniff, timestamp, progressState.signal, tuning.signal);
  const sniff = signal.value;
  const isSniffing = signal.active;
  const isStrong = sniff > tuning.input.strongThreshold;
  const isControlled = signal.phase === 'holding';
  const elapsedSeconds = signal.deltaSeconds;
  let collected = 0;

  if (isSniffing) {
    progressState.flow = clamp(progressState.flow + elapsedSeconds * (scoring.flowBase + sniff * scoring.flowByValue), 0, 1);
    collected = consumeTimedEvents(progressState, 'flower', scoring.eventBase + sniff * scoring.eventByValue + (isStrong ? scoring.strongEventBonus : 0), elapsedSeconds);
    if (collected > 0) {
      progressState.flowerCount += collected;
      progressState.suctionEventSequence += collected;
      const special = Math.floor(progressState.flowerCount / scoring.specialEvery) - progressState.specialFlowers;
      progressState.specialFlowers += Math.max(0, special);
      progressState.score += collected + Math.max(0, special) * scoring.specialScore;
    }
  } else {
    progressState.flow = clamp(progressState.flow - elapsedSeconds * scoring.decay, scoring.minimumFlow, 1);
  }

  if (signal.justReleased && signal.holdSeconds >= scoring.releaseHoldSeconds) {
    progressState.combo = Math.min(12, progressState.combo + 1);
    progressState.score += progressState.combo >= 3 ? scoring.comboReleaseScore : scoring.releaseScore;
  }
  progressState.score = Math.min(MAX_SCENE_SCORE, progressState.score);

  return {
    score: Math.round(progressState.score),
    completion: clamp((progressState.flowerCount % scoring.completionModulo) / scoring.completionModulo, 0, 1),
    feedback: getNoseSniffFeedback({ features, isSniffing, isStrong, isControlled }),
    isOnTrack: isSniffing && isControlled,
    sniff,
    rawNoseMetric: blendshapeSignal ?? null,
    noseDiagnostics,
    relativeNoseMetric: rawSniff,
    flowerCount: progressState.flowerCount,
    suctionEvents: collected || 0,
    suctionEventSequence: progressState.suctionEventSequence,
    flow: progressState.flow,
    isSniffing,
    combo: progressState.combo,
    holdSeconds: signal.holdSeconds,
    justActivated: signal.justActivated,
    justReleased: signal.justReleased,
    phase: signal.phase,
  };
}

function getNoseSniffFeedback({ features, isSniffing, isStrong, isControlled }) {
  if (!features?.nose) return 'Find your face';
  if (!isSniffing) return 'Wrinkle your nose to gather popcorn';
  if (!isControlled) return 'Hold the inhale gently';
  if (isStrong) return 'Lovely inhale, popcorn is gathering';
  return 'Good, scrunch a little stronger';
}

function scoreMouthOpening({ features, timestamp, progressState, stageProgress, tuning }) {
  const scoring = tuning.scoring;
  const ratio = features?.mouth?.openRatio;
  const rawOpen = Number.isFinite(ratio) ? clamp((ratio - tuning.input.baseline) / tuning.input.range, 0, 1) : null;
  const signal = updateInteractionSignal(rawOpen, timestamp, progressState.signal, tuning.signal);
  const mouthOpen = signal.value;
  const elapsedSeconds = signal.deltaSeconds;
  const isOpen = signal.active;
  const isWide = mouthOpen > tuning.input.wideThreshold;
  const isStable = signal.phase === 'holding';

  if (isOpen) {
    progressState.flow = clamp(progressState.flow + elapsedSeconds * (scoring.flowBase + mouthOpen * scoring.flowByValue), 0, 1);
    progressState.score += elapsedSeconds * (
      scoring.holdBase
      + mouthOpen * scoring.holdByValue
      + (isStable ? scoring.stableHoldBonus : 0)
    );
    const eaten = consumeTimedEvents(progressState, 'fish', scoring.eventBase + mouthOpen * scoring.eventByValue + (isStable ? scoring.stableEventBonus : 0), elapsedSeconds);
    if (eaten > 0) {
      progressState.fishCount += eaten;
      const special = Math.floor(progressState.fishCount / scoring.specialEvery) - progressState.specialFish;
      progressState.specialFish += Math.max(0, special);
      progressState.score += eaten * scoring.fishScore + Math.max(0, special) * scoring.specialScore;
    }
  } else {
    progressState.flow = clamp(progressState.flow - elapsedSeconds * scoring.decay, scoring.minimumFlow, 1);
  }

  if (signal.justReleased && signal.holdSeconds >= 0.45) progressState.combo = Math.min(12, progressState.combo + 1);
  progressState.score = Math.min(MAX_SCENE_SCORE, progressState.score);

  return {
    score: Math.round(progressState.score),
    completion: clamp((progressState.fishCount % scoring.completionModulo) / scoring.completionModulo, 0, 1),
    feedback: getMouthOpeningFeedback({ features, isOpen, isWide, isStable, mouthOpen }),
    isOnTrack: isOpen && isStable,
    mouthOpen,
    flow: progressState.flow,
    fishBurst: isOpen ? clamp(mouthOpen + progressState.flow * 0.25, 0, 1) : 0,
    fishCount: progressState.fishCount,
    combo: progressState.combo,
    isOpen,
    holdSeconds: signal.holdSeconds,
    justActivated: signal.justActivated,
    justReleased: signal.justReleased,
    phase: signal.phase,
  };
}

function getMouthOpeningFeedback({ features, isOpen, isWide, isStable, mouthOpen }) {
  if (!features?.mouth) return 'Find your face';
  if (!isOpen) return 'Open wide and invite the fish in';
  if (!isStable && mouthOpen > 0.45) return 'Hold the whale mouth steady';
  if (isWide) return 'Great flow, little fish are swimming in';
  return 'Nice, open a little wider';
}

function createMouthProgress() {
  return {
    score: 0,
    flow: 0.08,
    fishCount: 0,
    specialFish: 0,
    combo: 0,
    fishAccumulator: 0,
    signal: createInteractionSignalState(),
  };
}

function createTempleProgress() {
  return {
    score: 0,
    flow: 0,
    combo: 0,
    gardenCycle: 0,
    gardenNourishment: 0,
    gardenNourishmentAccumulator: 0,
    leftSignal: createInteractionSignalState(),
    rightSignal: createInteractionSignalState(),
  };
}

function createLemonProgress() {
  return {
    score: 0,
    sodaLevel: 0.16,
    ingredientStage: 0,
    sipCycle: 0,
    sipCount: 0,
    nextSipLevel: 0.82,
    combo: 0,
    leftSignal: createInteractionSignalState(),
    rightSignal: createInteractionSignalState(),
  };
}

function createNoseProgress() {
  return {
    score: 0,
    flow: 0.08,
    flowerCount: 0,
    specialFlowers: 0,
    combo: 0,
    flowerAccumulator: 0,
    suctionEventSequence: 0,
    signal: createInteractionSignalState(),
  };
}

function createBubbleProgress() {
  return {
    score: 0,
    bubbleSize: 0.07,
    bubblePops: 0,
    justPopped: false,
    combo: 0,
    stage: 0,
    maxHold: 0,
    bubbleHoldAccumulator: 0,
    signal: createInteractionSignalState(),
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value) {
  return Number(value.toFixed(2));
}
