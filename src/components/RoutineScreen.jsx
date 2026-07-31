import { useEffect, useMemo, useRef, useState } from 'react';
import { STAGE_SECONDS, routineStages } from '../data/routine.js';
import { SCENE_IDS } from '../data/scenes.js';
import { useFaceLandmarks } from '../hooks/useFaceLandmarks.js';
import { useHandTracking } from '../hooks/useHandTracking.js';
import { buildResult, getRoutineFeedback } from '../utils/mockDetection.js';
import {
  consumeTimedEvents,
  createInteractionSignalState,
  updateInteractionSignal,
} from '../utils/interactionSignal.js';
import { MirrorVideo } from './MirrorScreen.jsx';

const totalSeconds = STAGE_SECONDS * routineStages.length;

export default function RoutineScreen({ selectedScene = SCENE_IDS.whaleDream, stream, isDemoMode, onComplete, onExit }) {
  const videoRef = useRef(null);
  const previewVideoRef = useRef(null);
  const stageRef = useRef(null);
  const mouthProgressRef = useRef(createMouthProgress());
  const templeProgressRef = useRef(createTempleProgress());
  const lemonProgressRef = useRef(createLemonProgress());
  const noseProgressRef = useRef(createNoseProgress());
  const bubbleProgressRef = useRef(createBubbleProgress());
  const latestInputsRef = useRef({
    features: null,
    fingertips: { left: null, right: null, all: [] },
    templeTargets: null,
    lemonTargets: null,
  });
  const snapshotFramesRef = useRef([]);
  const snapshotTargetsRef = useRef([0.12, 0.3, 0.48, 0.66, 0.84]);
  const [elapsed, setElapsed] = useState(0);
  const [interactionTick, setInteractionTick] = useState(0);
  const [stageScores, setStageScores] = useState({});
  const [interaction, setInteraction] = useState({
    score: 0,
    completion: 0,
    feedback: 'Open wide and guide little fish in',
    isOnTrack: false,
    mouthOpen: 0,
    flow: 0,
    fishBurst: 0,
    isOpen: false,
    leftPress: 0,
    rightPress: 0,
    rain: 0,
    growth: 0,
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
    bubbleSize: 0.18,
    bubbleStage: 0,
    combo: 0,
    isPuffing: false,
    sync: 0,
    clarity: 0,
  });

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
    if (previewVideoRef.current && stream) {
      previewVideoRef.current.srcObject = stream;
    }
  }, [stream]);

  const { containerSize, detectorMode, displayRect, features, hasLandmarks } = useFaceLandmarks({
    videoRef,
    stageRef,
    stream,
    isDemoMode,
  });

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsed((current) => {
        const next = Math.min(totalSeconds, current + 1);
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setInteractionTick((current) => current + 1), 50);
    return () => window.clearInterval(timer);
  }, []);

  const stageIndex = Math.min(routineStages.length - 1, Math.floor(elapsed / STAGE_SECONDS));
  const stage = routineStages[stageIndex];
  const stageElapsed = elapsed - stageIndex * STAGE_SECONDS;
  const stageProgress = Math.min(1, stageElapsed / STAGE_SECONDS);
  const globalProgress = Math.min(1, elapsed / totalSeconds);
  const secondsLeft = Math.max(0, totalSeconds - elapsed);
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
    trajectories: selectedScene === SCENE_IDS.templeGarden
      ? templeTrajectories
      : selectedScene === SCENE_IDS.lemonSqueeze
        ? lemonTrajectories
        : undefined,
  });

  useEffect(() => {
    latestInputsRef.current = { features, fingertips, templeTargets, lemonTargets };
  }, [features, fingertips, lemonTargets, templeTargets]);

  useEffect(() => {
    mouthProgressRef.current = createMouthProgress();
    templeProgressRef.current = createTempleProgress();
    lemonProgressRef.current = createLemonProgress();
    noseProgressRef.current = createNoseProgress();
    bubbleProgressRef.current = createBubbleProgress();
    setInteraction({
      score: 0,
      completion: 0,
      feedback: getInitialFeedback(selectedScene),
      isOnTrack: false,
      mouthOpen: 0,
      flow: 0,
      fishBurst: 0,
      isOpen: false,
      leftPress: 0,
      rightPress: 0,
      rain: 0,
      growth: 0,
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
      bubbleSize: 0.18,
      bubbleStage: 0,
      combo: 0,
      isPuffing: false,
      sync: 0,
      clarity: 0,
    });
  }, [selectedScene, stage.id]);

  useEffect(() => {
    const now = performance.now();
    const currentInputs = latestInputsRef.current;
    let nextInteraction;

    if (selectedScene === SCENE_IDS.templeGarden) {
      nextInteraction = scoreTemplePress({
          features: currentInputs.features,
          fingertips: currentInputs.fingertips,
          targets: currentInputs.templeTargets,
          timestamp: now,
          progressState: templeProgressRef.current,
          stageProgress,
        });
    } else if (selectedScene === SCENE_IDS.lemonSqueeze) {
      nextInteraction = scoreLemonSqueeze({
        features: currentInputs.features,
        fingertips: currentInputs.fingertips,
        targets: currentInputs.lemonTargets,
        timestamp: now,
        progressState: lemonProgressRef.current,
        stageProgress,
      });
    } else if (selectedScene === SCENE_IDS.flowerCollector) {
      nextInteraction = scoreNoseSniff({
        features: currentInputs.features,
        timestamp: now,
        progressState: noseProgressRef.current,
        stageProgress,
      });
    } else if (selectedScene === SCENE_IDS.bubbleGumBunny) {
      nextInteraction = scoreCheekPuff({
        features: currentInputs.features,
        timestamp: now,
        progressState: bubbleProgressRef.current,
        stageProgress,
      });
    } else {
      nextInteraction = scoreMouthOpening({
          features: currentInputs.features,
          timestamp: now,
          progressState: mouthProgressRef.current,
          stageProgress,
        });
    }

    setInteraction(nextInteraction);
  }, [interactionTick, selectedScene, stageProgress]);

  useEffect(() => {
    const nextTarget = snapshotTargetsRef.current[0];
    if (nextTarget === undefined || globalProgress < nextTarget) return;

    const snapshot = captureRoutineSnapshot({
      video: videoRef.current,
      isDemoMode,
      progress: globalProgress,
      score: interaction.score,
    });

    if (snapshot) {
      snapshotFramesRef.current = [...snapshotFramesRef.current, snapshot].slice(-5);
      snapshotTargetsRef.current = snapshotTargetsRef.current.slice(1);
    }
  }, [globalProgress, interaction.score, isDemoMode]);

  useEffect(() => {
    setStageScores((current) => ({
      ...current,
      [selectedScene]: Math.max(current[selectedScene] || 0, interaction.score),
    }));
  }, [interaction.score, selectedScene]);

  useEffect(() => {
    if (elapsed >= totalSeconds) {
      onComplete(buildResult(stageScores, snapshotFramesRef.current, selectedScene));
    }
  }, [elapsed, onComplete, selectedScene, stageScores]);

  const displayScore = Math.max(stageScores[selectedScene] || 0, interaction.score);

  return (
    <section className="screen routine-screen play-routine-screen">
      <div className="routine-layout play-routine-layout">
        <div className="mirror-stage routine-mirror play-routine-mirror" ref={stageRef}>
          {selectedScene === SCENE_IDS.templeGarden ? (
            <TempleGardenScene interaction={interaction} targets={templeTargets} />
          ) : selectedScene === SCENE_IDS.lemonSqueeze ? (
            <LemonSqueezeScene interaction={interaction} />
          ) : selectedScene === SCENE_IDS.flowerCollector ? (
            <FlowerCollectorScene interaction={interaction} />
          ) : selectedScene === SCENE_IDS.bubbleGumBunny ? (
            <BubbleGumBunnyScene interaction={interaction} />
          ) : selectedScene === SCENE_IDS.whaleDream2 ? (
            <WhaleDream2Scene interaction={interaction} />
          ) : (
            <WhaleDreamScene interaction={interaction} />
          )}
          <TrackingVideo videoRef={videoRef} isDemoMode={isDemoMode} />
          <CameraPreview
            detectorMode={detectorMode}
            handMode={[SCENE_IDS.whaleDream, SCENE_IDS.whaleDream2].includes(selectedScene) ? interaction.isOpen ? 'good-flow' : 'mouth-ready' : handMode}
            isDemoMode={isDemoMode}
            previewVideoRef={previewVideoRef}
            stream={stream}
          />

          <button className="play-close-button" onClick={onExit} aria-label="Close routine" />

          <div className="play-score">
            <span>Score</span>
            <strong>{displayScore}</strong>
          </div>

          <div className="play-timer timer-ring" style={{ '--progress': `${globalProgress * 360}deg` }}>
            <span>{formatTime(secondsLeft)}</span>
            <small>~~~</small>
          </div>

          <div className="play-feedback">
            {interaction.feedback || feedback.label}
          </div>
        </div>
      </div>
    </section>
  );
}

function TempleGardenScene({ interaction }) {
  const rain = clamp(interaction.rain || 0, 0, 1);
  const growth = clamp(interaction.growth || 0, 0, 1);
  const leftPress = clamp(interaction.leftPress || 0, 0, 1);
  const rightPress = clamp(interaction.rightPress || 0, 0, 1);
  const drops = useMemo(
    () =>
      Array.from({ length: 36 }, (_, index) => ({
        id: index,
        side: index % 2 === 0 ? 'left' : 'right',
        x: 42 + ((index * 17) % 70),
        y: 178 + ((index * 31) % 172),
        delay: (index % 13) * 0.08,
        length: 14 + (index % 5) * 5,
      })),
    [],
  );
  const flowers = useMemo(
    () =>
      Array.from({ length: 18 }, (_, index) => ({
        id: index,
        x: 46 + ((index * 29) % 285),
        y: 468 + ((index * 19) % 78),
        scale: 0.72 + (index % 6) * 0.1,
        hue: index % 4,
      })),
    [],
  );

  return (
    <div
      className={`temple-garden-scene ${interaction.isPressing ? 'is-pressing' : ''}`}
      style={{
        '--left-press': leftPress,
        '--right-press': rightPress,
        '--left-rain': leftPress,
        '--right-rain': rightPress,
        '--rain': rain,
        '--growth': growth,
        '--ripple': interaction.ripple || 0,
      }}
      aria-hidden="true"
    >
      <div className="temple-copy">
        <h1>Cloud Garden</h1>
        <p>Press both temples and let the garden breathe</p>
      </div>

      <div className="garden-cloud left">
        <span />
        <span />
        <span />
      </div>
      <div className="garden-cloud right">
        <span />
        <span />
        <span />
      </div>

      <div className="garden-rain">
        {drops.map((drop) => (
          <span
            key={drop.id}
            className={drop.side}
            style={{
              '--drop-x': `${drop.x}px`,
              '--drop-y': `${drop.y}px`,
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

      <div className="garden-bed">
        {flowers.map((flower) => (
          <span
            key={flower.id}
            className={`garden-flower hue-${flower.hue}`}
            style={{
              '--flower-x': `${flower.x}px`,
              '--flower-y': `${flower.y}px`,
              '--flower-scale': flower.scale,
            }}
          />
        ))}
      </div>

      <div className="garden-status-chip">
        {interaction.isPressing ? '~~ Garden breathing' : 'Touch both temples'}
      </div>
    </div>
  );
}

function LemonSqueezeScene({ interaction }) {
  const squeeze = clamp(interaction.squeeze || 0, 0, 1);
  const sodaLevel = clamp(interaction.sodaLevel || 0.16, 0.1, 0.94);
  const sip = clamp(interaction.sip || 0, 0, 1);
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
        '--sip': sip,
        '--combo': interaction.combo || 0,
      }}
      aria-hidden="true"
    >
      <div className="lemon-copy">
        <h1>Lemon Squeeze</h1>
        <p>Press both sides and make a tiny summer soda</p>
      </div>

      <div className="lemon-sun" />
      <div className="lemon-arc one" />
      <div className="lemon-arc two" />

      <div className="lemon-half left">
        <span className="lemon-face" />
      </div>
      <div className="lemon-half right">
        <span className="lemon-face" />
      </div>

      <div className="juice-stream left">
        <span />
        <span />
        <span />
      </div>
      <div className="juice-stream right">
        <span />
        <span />
        <span />
      </div>

      <div className="soda-glass">
        <div className="soda-liquid">
          <span className="soda-surface" />
          {bubbles.map((bubble) => (
            <span
              key={bubble.id}
              className="soda-bubble"
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
        <span className={`soda-ice one ${ingredientStage >= 1 ? 'is-visible' : ''}`} />
        <span className={`soda-ice two ${ingredientStage >= 2 ? 'is-visible' : ''}`} />
        <span className={`soda-slice ${ingredientStage >= 3 ? 'is-visible' : ''}`} />
        <span className={`soda-mint ${ingredientStage >= 4 ? 'is-visible' : ''}`} />
        <span className="soda-straw" />
      </div>

      <div className="lemon-fizz-layer">
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

      <div className="soda-sipper">
        <span className="sipper-ear left" />
        <span className="sipper-ear right" />
        <span className="sipper-face" />
      </div>

      <div className="lemon-status-chip">
        {interaction.isSqueezing ? `Combo ${interaction.combo || 0}` : 'Press beside your nose'}
      </div>
    </div>
  );
}

function WhaleDreamScene({ interaction }) {
  const mouthOpen = clamp(interaction.mouthOpen || 0, 0, 1);
  const fish = useMemo(
    () =>
      Array.from({ length: 24 }, (_, index) => {
        const fromLeft = index % 2 === 0;
        const sideOffset = 48 + ((index * 31) % 112);
        const startX = fromLeft ? sideOffset : 375 - sideOffset;
        const startY = 264 + ((index * 43) % 230);
        const mouthX = 145 + ((index * 17) % 54);
        const mouthY = 365 + ((index * 19) % 82);

        return {
          id: index,
          delay: (index % 9) * 0.11,
          duration: 1.15 + (index % 7) * 0.14,
          size: 0.68 + (index % 5) * 0.12,
          x: startX,
          y: startY,
          driftX: mouthX - startX,
          driftY: mouthY - startY,
          side: fromLeft ? 'from-left' : 'from-right',
          special: index % 17 === 0,
        };
      }),
    [],
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

  const upperMouth = 355 - mouthOpen * 34;
  const lowerMouth = 404 + mouthOpen * 46;
  const mouthPath = [
    `M 92 ${upperMouth}`,
    `C 122 ${296 - mouthOpen * 28} 195 ${286 - mouthOpen * 24} 250 ${327 - mouthOpen * 8}`,
    `C 238 ${386 + mouthOpen * 48} 165 ${448 + mouthOpen * 38} 92 ${lowerMouth}`,
    `C 64 ${393 + mouthOpen * 22} 64 ${365 - mouthOpen * 8} 92 ${upperMouth}`,
    'Z',
  ].join(' ');

  return (
    <div
      className={`whale-dream-scene ${interaction.isOpen ? 'is-open' : ''}`}
      style={{ '--mouth-open': mouthOpen, '--flow': interaction.flow || 0 }}
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
      <div className="whale-copy">
        <h1>Whale Mouth</h1>
        <p>Open wide and guide little fish in</p>
      </div>
      <svg className="whale-svg" viewBox="0 0 375 620" role="img" aria-label="Dream whale">
        <defs>
          <radialGradient id="whaleGlow" cx="38%" cy="46%" r="65%">
            <stop offset="0%" stopColor="#8cb5ff" />
            <stop offset="58%" stopColor="#4267c7" />
            <stop offset="100%" stopColor="#22357f" />
          </radialGradient>
          <radialGradient id="mouthGlow" cx="54%" cy="50%" r="62%">
            <stop offset="0%" stopColor="#fff3a9" />
            <stop offset="44%" stopColor="#ffaed2" />
            <stop offset="100%" stopColor="#5d3a90" />
          </radialGradient>
          <linearGradient id="seaGlow" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#e7b9ff" stopOpacity="0.74" />
            <stop offset="100%" stopColor="#71e6ff" stopOpacity="0.18" />
          </linearGradient>
        </defs>

        <path className="whale-water" d="M 0 510 C 70 482 132 534 200 504 C 270 474 316 493 375 468 L 375 620 L 0 620 Z" />
        <path
          className="whale-body"
          d="M 101 335 C 111 210 207 161 284 227 C 350 283 344 431 286 495 C 220 568 119 518 89 430 C 59 412 52 372 101 335 Z"
        />
        <path className="whale-belly" d="M 103 368 C 135 328 200 320 248 350 C 231 427 174 470 102 424 C 78 409 76 384 103 368 Z" />
        <path className="whale-mouth-glow" d={mouthPath} />
        <path className="whale-mouth-line" d={`M 89 ${upperMouth + 7} C 128 318 196 304 256 336`} />
        <path className="whale-eye" d="M 262 323 C 268 344 291 344 297 323" />
        <circle className="whale-cheek" cx="300" cy="369" r="18" />
        <path className="whale-tail" d="M 314 432 C 360 407 354 354 371 342 C 389 383 378 439 337 462 C 366 470 377 501 364 531 C 336 512 313 486 314 432 Z" />
        <path className="whale-spray" d="M 167 217 C 152 180 142 158 125 132 M 182 215 C 184 174 200 153 219 130 M 192 223 C 228 190 250 170 272 148" />
      </svg>

      <div className="fish-layer">
        {fish.map((item) => (
          <span
            key={item.id}
            className={`dream-fish ${item.side} ${item.special ? 'is-special' : ''}`}
            style={{
              '--fish-x': `${item.x}px`,
              '--fish-y': `${item.y}px`,
              '--drift-x': `${item.driftX}px`,
              '--drift-y': `${item.driftY}px`,
              '--fish-scale': item.size,
              '--fish-delay': `${item.delay}s`,
              '--fish-duration': `${item.duration}s`,
            }}
          />
        ))}
      </div>
      <div className="whale-current left" />
      <div className="whale-current right" />
      <div className="flow-chip">{interaction.isOpen ? 'Fish are swimming in' : 'Open your mouth gently'}</div>
    </div>
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
      <div className="xr-scene-status">{interaction.isOpen ? '~~ Good flow' : 'Open your mouth gently'}</div>
    </div>
  );
}

function FlowerCollectorScene({ interaction }) {
  const sniff = clamp(interaction.sniff || 0, 0, 1);
  const gathered = clamp(interaction.completion || 0, 0, 1);
  const flowers = useMemo(
    () =>
      Array.from({ length: 40 }, (_, index) => ({
        ...getFlowerDockPoint(index),
        id: index,
        x: 24 + ((index * 43) % 330),
        y: 146 + ((index * 67) % 494),
        size: 0.52 + (index % 7) * 0.1,
        delay: (index % 13) * 0.07,
        hue: index % 5,
        drift: 0.74 + (index % 8) * 0.05,
        settle: 0.76 + (index % 6) * 0.04,
      })),
    [],
  );
  const fallingFlowers = useMemo(
    () =>
      Array.from({ length: 22 }, (_, index) => ({
        id: index,
        x: -8 + ((index * 37) % 112),
        delay: (index % 12) * 0.18,
        duration: 4.2 + (index % 7) * 0.36,
        size: 0.42 + (index % 5) * 0.1,
        hue: index % 5,
      })),
    [],
  );
  const suctionFlowers = useMemo(
    () =>
      Array.from({ length: 36 }, (_, index) => ({
        ...getFlowerDockPoint(index + 11),
        id: index,
        x: 38 + ((index * 61) % 310),
        y: 248 + ((index * 73) % 420),
        size: 0.42 + (index % 6) * 0.1,
        delay: (index % 18) * 0.055,
        duration: 0.86 + (index % 8) * 0.055,
        hue: index % 5,
        curveX: -18 + (index % 7) * 6,
      })),
    [],
  );
  const groundFlowers = useMemo(
    () =>
      Array.from({ length: 34 }, (_, index) => ({
        id: index,
        x: -5 + ((index * 23) % 112),
        y: 74 + ((index * 19) % 28),
        size: 0.5 + (index % 8) * 0.09,
        hue: index % 5,
      })),
    [],
  );
  const sparkles = useMemo(
    () =>
      Array.from({ length: 18 }, (_, index) => ({
        id: index,
        x: 4 + ((index * 29) % 92),
        y: 12 + ((index * 41) % 78),
        delay: (index % 8) * 0.16,
      })),
    [],
  );

  return (
    <div
      className={`flower-collector-scene ${interaction.isSniffing ? 'is-sniffing' : ''}`}
      style={{
        '--sniff': sniff,
        '--gathered': gathered,
      }}
      aria-hidden="true"
    >
      <div className="flower-sky-glow" />
      <div className="flower-copy">
        <h1>Flower Collector</h1>
        <p>Inhale and gather the blossoms</p>
      </div>

      <div className="scent-bottle">
        <span className="bottle-neck" />
        <span className="bottle-face" />
        <span className="bottle-bloom one" />
        <span className="bottle-bloom two" />
        <span className="bottle-bloom three" />
      </div>

      <div className="scent-streams">
        <span className="stream one" />
        <span className="stream two" />
        <span className="stream three" />
      </div>

      <div className="flower-field">
        {flowers.map((flower) => (
          <span
            key={flower.id}
            className={`collector-flower hue-${flower.hue}`}
            style={{
              '--flower-x': `${flower.x}px`,
              '--flower-y': `${flower.y}px`,
              '--flower-size': flower.size,
              '--flower-delay': `${flower.delay}s`,
              '--flower-drift': flower.drift,
              opacity: 0.38 + sniff * 0.62,
              transform: `translate(${(flower.dockX - flower.x) * sniff * flower.drift}px, ${(flower.dockY - flower.y) * sniff * flower.drift}px) scale(${flower.size * (0.72 + sniff * 0.36) * flower.settle})`,
            }}
          />
        ))}
      </div>

      <div className="falling-flower-layer">
        {fallingFlowers.map((flower) => (
          <span
            key={flower.id}
            className={`falling-flower hue-${flower.hue}`}
            style={{
              '--fall-x': `${flower.x}%`,
              '--fall-delay': `${flower.delay}s`,
              '--fall-duration': `${flower.duration}s`,
              '--fall-size': flower.size,
              opacity: 0.24 + sniff * 0.56,
            }}
          />
        ))}
      </div>

      <div className="suction-flower-layer">
        {suctionFlowers.map((flower) => (
          <span
            key={flower.id}
            className={`suction-flower hue-${flower.hue}`}
            style={{
              '--suction-start-x': `${flower.x}px`,
              '--suction-start-y': `${flower.y}px`,
              '--suction-end-x': `${flower.dockX}px`,
              '--suction-end-y': `${flower.dockY}px`,
              '--suction-mid-x': `${(flower.x + flower.dockX) / 2 + flower.curveX}px`,
              '--suction-mid-y': `${(flower.y + flower.dockY) / 2 - 38}px`,
              '--suction-curve-x': `${flower.curveX}px`,
              '--suction-delay': `${flower.delay}s`,
              '--suction-duration': `${flower.duration}s`,
              '--suction-size': flower.size,
            }}
          />
        ))}
      </div>

      <div className="flower-ground">
        {groundFlowers.map((flower) => (
          <span
            key={flower.id}
            className={`ground-flower hue-${flower.hue}`}
            style={{
              '--ground-x': `${flower.x}%`,
              '--ground-y': `${flower.y}%`,
              '--ground-size': flower.size,
            }}
          />
        ))}
      </div>

      <div className="flower-sparkles">
        {sparkles.map((sparkle) => (
          <span
            key={sparkle.id}
            style={{
              '--sparkle-x': `${sparkle.x}%`,
              '--sparkle-y': `${sparkle.y}%`,
              '--sparkle-delay': `${sparkle.delay}s`,
            }}
          />
        ))}
      </div>

      <div className="flower-status-chip">
        {interaction.isSniffing ? `Collected ${interaction.flowerCount || 0} blossoms` : 'Scrunch your nose to inhale'}
      </div>
    </div>
  );
}

function BubbleGumBunnyScene({ interaction }) {
  const puff = clamp(interaction.puff || 0, 0, 1);
  const bubbleSize = clamp(interaction.bubbleSize || 0.18, 0.12, 1);
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

  return (
    <div
      className={`bubble-bunny-scene ${interaction.isPuffing ? 'is-puffing' : ''}`}
      style={{
        '--puff': puff,
        '--bubble-size': bubbleSize,
        '--combo': interaction.combo || 0,
      }}
      aria-hidden="true"
    >
      <div className="bunny-copy">
        <h1>Bubble Gum Bunny</h1>
        <p>Puff, relax, and grow the bubble</p>
      </div>

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

      <div className="bubble-stage-chip">
        {interaction.isPuffing ? `Combo ${interaction.combo || 0}` : 'Puff your cheeks'}
      </div>
    </div>
  );
}

function getFlowerDockPoint(index) {
  const preview = {
    x: 30,
    y: 30,
    width: 102,
    height: 148,
    margin: 10,
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

function CameraPreview({ detectorMode, handMode, isDemoMode, previewVideoRef, stream }) {
  return (
    <div className="camera-preview" aria-label="Front camera preview">
      <div className="preview-header">
        <span className="preview-dot" />
        <span>Front camera</span>
      </div>
      <div className="preview-video-shell">
        {isDemoMode || !stream ? (
          <MirrorVideo videoRef={previewVideoRef} isDemoMode />
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

function captureRoutineSnapshot({ video, isDemoMode, progress, score }) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const width = 360;
  const height = 480;
  canvas.width = width;
  canvas.height = height;

  if (!isDemoMode && video?.videoWidth && video?.videoHeight && video.readyState >= 2) {
    const sourceAspect = video.videoWidth / video.videoHeight;
    const targetAspect = width / height;
    let sourceWidth = video.videoWidth;
    let sourceHeight = video.videoHeight;
    let sourceX = 0;
    let sourceY = 0;

    if (sourceAspect > targetAspect) {
      sourceWidth = video.videoHeight * targetAspect;
      sourceX = (video.videoWidth - sourceWidth) / 2;
    } else {
      sourceHeight = video.videoWidth / targetAspect;
      sourceY = (video.videoHeight - sourceHeight) / 2;
    }

    context.save();
    context.translate(width, 0);
    context.scale(-1, 1);
    context.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
    context.restore();
  } else {
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#dff4f0');
    gradient.addColorStop(1, '#f7dce8');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    context.fillStyle = 'rgba(255,255,255,0.74)';
    context.beginPath();
    context.arc(width / 2, height * 0.42, 86, 0, Math.PI * 2);
    context.fill();
  }

  context.fillStyle = 'rgba(7, 20, 24, 0.28)';
  context.fillRect(0, 0, width, height);
  context.fillStyle = 'rgba(215, 255, 248, 0.92)';
  context.beginPath();
  context.arc(width * (0.18 + progress * 0.64), height * 0.92, 7, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = 'rgba(255,255,255,0.86)';
  context.font = '700 22px Inter, sans-serif';
  context.fillText(String(score), 22, 42);

  return {
    id: `${Date.now()}-${Math.round(progress * 1000)}`,
    image: canvas.toDataURL('image/jpeg', 0.72),
    progress,
    score,
  };
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
  const outward = clamp(faceScale * 0.16, 26, 62);
  const lift = clamp(faceScale * 0.05, 8, 22);
  const tolerance = clamp(faceScale * 0.16, 42, 84);

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

function scoreTemplePress({ features, fingertips, targets, timestamp, progressState, stageProgress }) {
  const leftRaw = scoreTempleSide({ point: fingertips.left, target: targets?.left });
  const rightRaw = scoreTempleSide({ point: fingertips.right, target: targets?.right });
  const left = updateInteractionSignal(leftRaw.available ? leftRaw.press : null, timestamp, progressState.leftSignal, PRESS_SIGNAL_OPTIONS);
  const right = updateInteractionSignal(rightRaw.available ? rightRaw.press : null, timestamp, progressState.rightSignal, PRESS_SIGNAL_OPTIONS);
  const bothPressing = left.active && right.active;
  const onePressing = left.active || right.active || left.value > 0.3 || right.value > 0.3;
  const balanced = 1 - Math.min(1, Math.abs(left.value - right.value));
  const deltaSeconds = Math.max(left.deltaSeconds, right.deltaSeconds);

  if (bothPressing) {
    progressState.flow = clamp(progressState.flow + deltaSeconds * (0.12 + balanced * 0.08), 0, 1);
    const holdEvents = consumeTimedEvents(progressState, 'rainHold', 0.7 + balanced * 0.35, deltaSeconds);
    progressState.score += holdEvents * (balanced > 0.7 ? 3 : 2);
  } else {
    progressState.flow = clamp(progressState.flow - deltaSeconds * 0.09, 0.12, 1);
  }

  if (left.justReleased || right.justReleased) {
    const completedBoth = left.holdSeconds >= 0.35 && right.holdSeconds >= 0.35;
    if (completedBoth) {
      progressState.combo = Math.min(12, progressState.combo + 1);
      progressState.score += 5 + (balanced > 0.72 ? 3 : 0);
      progressState.gardenCycle += 1;
    }
  }

  const rain = clamp((left.value + right.value) / 2, 0, 1);
  const gardenPulse = (progressState.gardenCycle % 4) / 4;
  const growth = clamp(0.18 + gardenPulse * 0.52 + progressState.flow * 0.3, 0, 1);
  progressState.score = Math.min(100, progressState.score);

  return {
    score: Math.round(progressState.score),
    completion: growth,
    feedback: getTemplePressFeedback({ features, fingertips, bothPressing, onePressing, balanced, growth }),
    isOnTrack: bothPressing,
    leftPress: left.value,
    rightPress: right.value,
    rain,
    growth,
    ripple: onePressing ? clamp(rain * 0.7 + growth * 0.3, 0, 1) : growth * 0.4,
    flow: growth,
    isPressing: bothPressing,
    combo: progressState.combo,
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

function getTemplePressFeedback({ features, fingertips, bothPressing, onePressing, balanced, growth }) {
  if (!features) return 'Find your face';
  if (!fingertips?.left && !fingertips?.right) return 'Show both index fingers';
  if (!fingertips.left || !fingertips.right) return 'Use both hands on your temples';
  if (!onePressing) return 'Move both fingers to your temples';
  if (!bothPressing) return 'Press both sides at the same time';
  if (balanced < 0.58) return 'Balance both sides gently';
  if (growth > 0.78) return 'Great, the garden is breathing';
  return 'Good pulse, press and release slowly';
}

function scoreLemonSqueeze({ features, fingertips, targets, timestamp, progressState, stageProgress }) {
  const leftRaw = scoreTempleSide({ point: fingertips.left, target: targets?.left });
  const rightRaw = scoreTempleSide({ point: fingertips.right, target: targets?.right });
  const left = updateInteractionSignal(leftRaw.available ? leftRaw.press : null, timestamp, progressState.leftSignal, PRESS_SIGNAL_OPTIONS);
  const right = updateInteractionSignal(rightRaw.available ? rightRaw.press : null, timestamp, progressState.rightSignal, PRESS_SIGNAL_OPTIONS);
  const bothPressing = left.active && right.active;
  const onePressing = left.active || right.active || left.value > 0.28 || right.value > 0.28;
  const balanced = 1 - Math.min(1, Math.abs(left.value - right.value));
  const squeeze = clamp((left.value + right.value) / 2, 0, 1);
  const elapsedSeconds = Math.max(left.deltaSeconds, right.deltaSeconds);

  if (bothPressing) {
    progressState.sodaLevel = clamp(
      progressState.sodaLevel + (0.055 + squeeze * 0.06 + balanced * 0.025) * elapsedSeconds,
      0.12,
      0.94,
    );
  }

  const ingredientStage = Math.min(4, Math.max(0, Math.floor((progressState.sodaLevel - 0.14) * 5.4)));
  if (ingredientStage > progressState.ingredientStage) {
    progressState.score += (ingredientStage - progressState.ingredientStage) * 4;
    progressState.ingredientStage = ingredientStage;
  }

  if (left.justReleased || right.justReleased) {
    const completedBoth = left.holdSeconds >= 0.3 && right.holdSeconds >= 0.3;
    if (completedBoth) {
      progressState.combo = Math.min(12, progressState.combo + 1);
      progressState.score += 5 + (balanced > 0.72 ? 3 : 0);
    }
  }

  let sip = 0;
  if (progressState.sodaLevel > progressState.nextSipLevel) {
    progressState.sipCycle += elapsedSeconds;
    sip = Math.sin(Math.min(1, progressState.sipCycle / 1.2) * Math.PI);
    if (progressState.sipCycle > 1.2) {
      progressState.sodaLevel = clamp(progressState.sodaLevel - (0.2 + (progressState.sipCount % 3) * 0.035), 0.38, 0.74);
      progressState.score += 8;
      progressState.sipCount += 1;
      progressState.sipCycle = 0;
      progressState.nextSipLevel = 0.8 + (progressState.sipCount % 3) * 0.035;
      progressState.ingredientStage = Math.min(4, Math.max(0, Math.floor((progressState.sodaLevel - 0.14) * 5.4)));
    }
  } else {
    progressState.sipCycle = Math.max(0, progressState.sipCycle - elapsedSeconds * 1.5);
  }

  progressState.score = Math.min(100, progressState.score);

  return {
    score: Math.round(progressState.score),
    completion: clamp(progressState.sodaLevel, 0, 1),
    feedback: getLemonSqueezeFeedback({ features, fingertips, bothPressing, onePressing, balanced, sodaLevel: progressState.sodaLevel }),
    isOnTrack: bothPressing && balanced > 0.54,
    leftPress: left.value,
    rightPress: right.value,
    squeeze,
    sodaLevel: progressState.sodaLevel,
    ingredientStage: progressState.ingredientStage,
    sip,
    combo: progressState.combo,
    flow: progressState.sodaLevel,
    isSqueezing: bothPressing,
  };
}

function getLemonSqueezeFeedback({ features, fingertips, bothPressing, onePressing, balanced, sodaLevel }) {
  if (!features?.face?.noseCenter) return 'Find your face';
  if (!fingertips?.left && !fingertips?.right) return 'Show both index fingers';
  if (!fingertips.left || !fingertips.right) return 'Use both fingers beside your nose';
  if (!onePressing) return 'Move fingers beside your nose bridge';
  if (!bothPressing) return 'Squeeze both lemon halves together';
  if (balanced < 0.54) return 'Balance left and right squeeze';
  if (sodaLevel > 0.8) return 'Tiny friend is stealing a sip';
  return 'Fresh squeeze, bubbles rising';
}

function getInitialFeedback(sceneId) {
  if (sceneId === SCENE_IDS.templeGarden) return 'Press both temples gently';
  if (sceneId === SCENE_IDS.lemonSqueeze) return 'Press both sides of your nose';
  if (sceneId === SCENE_IDS.flowerCollector) return 'Scrunch your nose to inhale blossoms';
  if (sceneId === SCENE_IDS.bubbleGumBunny) return 'Puff your cheeks to grow the bubble';
  return 'Open wide and guide little fish in';
}

function scoreCheekPuff({ features, timestamp, progressState, stageProgress }) {
  const ratio = features?.cheeks?.puffRatio;
  const rawPuff = Number.isFinite(ratio) ? clamp((ratio - 0.12) / 0.6, 0, 1) : null;
  const signal = updateInteractionSignal(rawPuff, timestamp, progressState.signal, {
    enterThreshold: 0.32,
    releaseThreshold: 0.2,
    activateMs: 130,
    releaseMs: 220,
    attackSeconds: 0.13,
    releaseSeconds: 0.28,
  });
  const puff = signal.value;
  const isPuffing = signal.active;
  const isStable = signal.phase === 'holding';
  const elapsedSeconds = signal.deltaSeconds;

  if (isPuffing) {
    progressState.bubbleSize = clamp(progressState.bubbleSize + (0.07 + puff * 0.12) * elapsedSeconds, 0.18, 1);
    const holdEvents = consumeTimedEvents(progressState, 'bubbleHold', signal.holdSeconds > 1.1 ? 0.55 : 0, elapsedSeconds);
    progressState.score += holdEvents * 3;
  } else {
    progressState.bubbleSize = clamp(progressState.bubbleSize - 0.045 * elapsedSeconds, 0.18, 1);
  }

  const nextStage = Math.min(4, Math.floor(progressState.bubbleSize * 4.2));
  if (nextStage > progressState.stage) {
    progressState.score += (nextStage - progressState.stage) * 4;
    progressState.stage = nextStage;
  }

  if (progressState.bubbleSize >= 0.985) {
    progressState.maxHold += elapsedSeconds;
    if (progressState.maxHold >= 0.8) {
      progressState.bubbleSize = 0.56;
      progressState.stage = 2;
      progressState.maxHold = 0;
      progressState.combo = Math.min(12, progressState.combo + 1);
      progressState.score += 10 + (progressState.combo >= 3 ? 4 : 0);
    }
  } else {
    progressState.maxHold = 0;
  }

  if (signal.justReleased && signal.holdSeconds >= 0.6) {
    progressState.combo = Math.min(12, progressState.combo + 1);
    progressState.score += 5 + (signal.holdSeconds >= 1.8 ? 3 : 0);
  }
  progressState.score = Math.min(100, progressState.score);

  return {
    score: Math.round(progressState.score),
    completion: progressState.bubbleSize,
    feedback: getCheekPuffFeedback({ features, isPuffing, isStable, bubbleSize: progressState.bubbleSize, combo: progressState.combo || 0 }),
    isOnTrack: isPuffing && isStable,
    puff,
    bubbleSize: progressState.bubbleSize,
    bubbleStage: progressState.stage,
    combo: progressState.combo,
    isPuffing,
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

function scoreNoseSniff({ features, timestamp, progressState, stageProgress }) {
  const ratio = features?.nose?.sniffRatio;
  const rawSniff = Number.isFinite(ratio) ? clamp((ratio - 0.12) / 0.58, 0, 1) : null;
  const signal = updateInteractionSignal(rawSniff, timestamp, progressState.signal, {
    enterThreshold: 0.28,
    releaseThreshold: 0.17,
    activateMs: 100,
    releaseMs: 210,
    attackSeconds: 0.1,
    releaseSeconds: 0.26,
  });
  const sniff = signal.value;
  const isSniffing = signal.active;
  const isStrong = sniff > 0.58;
  const isControlled = signal.phase === 'holding';
  const elapsedSeconds = signal.deltaSeconds;

  if (isSniffing) {
    progressState.flow = clamp(progressState.flow + elapsedSeconds * (0.16 + sniff * 0.18), 0, 1);
    const collected = consumeTimedEvents(progressState, 'flower', 1 + sniff * 2.5 + (isStrong ? 0.7 : 0), elapsedSeconds);
    if (collected > 0) {
      progressState.flowerCount += collected;
      const special = Math.floor(progressState.flowerCount / 25) - progressState.specialFlowers;
      progressState.specialFlowers += Math.max(0, special);
      progressState.score += collected + Math.max(0, special) * 3;
    }
  } else {
    progressState.flow = clamp(progressState.flow - elapsedSeconds * 0.12, 0.08, 1);
  }

  if (signal.justReleased && signal.holdSeconds >= 0.55) {
    progressState.combo = Math.min(12, progressState.combo + 1);
    progressState.score += progressState.combo >= 3 ? 3 : 1;
  }
  progressState.score = Math.min(100, progressState.score);

  return {
    score: Math.round(progressState.score),
    completion: clamp((progressState.flowerCount % 24) / 24, 0, 1),
    feedback: getNoseSniffFeedback({ features, isSniffing, isStrong, isControlled }),
    isOnTrack: isSniffing && isControlled,
    sniff,
    flowerCount: progressState.flowerCount,
    flow: progressState.flow,
    isSniffing,
    combo: progressState.combo,
    phase: signal.phase,
  };
}

function getNoseSniffFeedback({ features, isSniffing, isStrong, isControlled }) {
  if (!features?.nose) return 'Find your face';
  if (!isSniffing) return 'Wrinkle your nose like smelling a flower';
  if (!isControlled) return 'Hold the scent gently';
  if (isStrong) return 'Lovely inhale, blossoms are gathering';
  return 'Good, scrunch a little stronger';
}

function scoreMouthOpening({ features, timestamp, progressState, stageProgress }) {
  const ratio = features?.mouth?.openRatio;
  const rawOpen = Number.isFinite(ratio) ? clamp((ratio - 0.07) / 0.22, 0, 1) : null;
  const signal = updateInteractionSignal(rawOpen, timestamp, progressState.signal, {
    enterThreshold: 0.36,
    releaseThreshold: 0.2,
    activateMs: 90,
    releaseMs: 190,
    attackSeconds: 0.09,
    releaseSeconds: 0.22,
  });
  const mouthOpen = signal.value;
  const elapsedSeconds = signal.deltaSeconds;
  const isOpen = signal.active;
  const isWide = mouthOpen > 0.65;
  const isStable = signal.phase === 'holding';

  if (isOpen) {
    progressState.flow = clamp(progressState.flow + elapsedSeconds * (0.13 + mouthOpen * 0.18), 0, 1);
    const eaten = consumeTimedEvents(progressState, 'fish', 1 + mouthOpen * 2.4 + (isStable ? 0.5 : 0), elapsedSeconds);
    if (eaten > 0) {
      progressState.fishCount += eaten;
      const special = Math.floor(progressState.fishCount / 25) - progressState.specialFish;
      progressState.specialFish += Math.max(0, special);
      progressState.score += eaten + Math.max(0, special) * 4;
    }
  } else {
    progressState.flow = clamp(progressState.flow - elapsedSeconds * 0.1, 0.08, 1);
  }

  if (signal.justReleased && signal.holdSeconds >= 0.45) {
    progressState.combo = Math.min(12, progressState.combo + 1);
    progressState.score += signal.holdSeconds >= 1.2 ? 5 : 2;
  }
  progressState.score = Math.min(100, progressState.score);

  return {
    score: Math.round(progressState.score),
    completion: clamp((progressState.fishCount % 18) / 18, 0, 1),
    feedback: getMouthOpeningFeedback({ features, isOpen, isWide, isStable, mouthOpen }),
    isOnTrack: isOpen && isStable,
    mouthOpen,
    flow: progressState.flow,
    fishBurst: isOpen ? clamp(mouthOpen + progressState.flow * 0.25, 0, 1) : 0,
    fishCount: progressState.fishCount,
    combo: progressState.combo,
    isOpen,
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

const PRESS_SIGNAL_OPTIONS = {
  enterThreshold: 0.46,
  releaseThreshold: 0.25,
  activateMs: 110,
  releaseMs: 210,
  missingToleranceMs: 280,
  attackSeconds: 0.1,
  releaseSeconds: 0.24,
};

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
    flow: 0.12,
    combo: 0,
    gardenCycle: 0,
    rainHoldAccumulator: 0,
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
    signal: createInteractionSignalState(),
  };
}

function createBubbleProgress() {
  return {
    score: 0,
    bubbleSize: 0.18,
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
