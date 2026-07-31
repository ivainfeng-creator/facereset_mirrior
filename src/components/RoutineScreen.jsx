import { useEffect, useMemo, useRef, useState } from 'react';
import { STAGE_SECONDS, routineStages } from '../data/routine.js';
import { SCENE_IDS } from '../data/scenes.js';
import { useFaceLandmarks } from '../hooks/useFaceLandmarks.js';
import { useHandTracking } from '../hooks/useHandTracking.js';
import { buildResult, getRoutineFeedback } from '../utils/mockDetection.js';
import { generateUnderEyeMassagePaths } from '../utils/overlayPaths.js';
import { MirrorVideo } from './MirrorScreen.jsx';

const totalSeconds = STAGE_SECONDS * routineStages.length;

export default function RoutineScreen({ selectedScene = SCENE_IDS.whaleDream, stream, isDemoMode, onComplete, onExit }) {
  const videoRef = useRef(null);
  const previewVideoRef = useRef(null);
  const stageRef = useRef(null);
  const mouthProgressRef = useRef({ score: 0, flow: 0, lastRatio: 0, lastTimestamp: 0, openFrames: 0 });
  const templeProgressRef = useRef({ score: 0, flow: 0, lastTimestamp: 0, pressFrames: 0 });
  const previousFingersRef = useRef({ left: null, right: null });
  const massageProgressRef = useRef({
    left: { maxProgress: 0, lastProgress: 0, lastSweep: 0 },
    right: { maxProgress: 0, lastProgress: 0, lastSweep: 0 },
  });
  const snapshotFramesRef = useRef([]);
  const snapshotTargetsRef = useRef([0.12, 0.3, 0.48, 0.66, 0.84]);
  const [elapsed, setElapsed] = useState(0);
  const [stageScores, setStageScores] = useState({});
  const [interaction, setInteraction] = useState({
    score: 0,
    completion: 0,
    feedback: 'Open wide and let little fish drift out',
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
  const gestureTrajectories = useMemo(
    () => createUnderEyeGestureTrajectories(features, containerSize),
    [containerSize, features],
  );
  const templeTargets = useMemo(
    () => createTemplePressTargets(features, containerSize),
    [containerSize, features],
  );
  const templeTrajectories = useMemo(
    () => createTemplePressTrajectories(templeTargets, containerSize),
    [containerSize, templeTargets],
  );
  const { fingertips, handMode } = useHandTracking({
    videoRef,
    stream,
    isDemoMode,
    displayRect,
    trajectories: selectedScene === SCENE_IDS.templeGarden ? templeTrajectories : gestureTrajectories,
  });

  useEffect(() => {
    mouthProgressRef.current = { score: 0, flow: 0, lastRatio: 0, lastTimestamp: 0, openFrames: 0 };
    templeProgressRef.current = { score: 0, flow: 0, lastTimestamp: 0, pressFrames: 0 };
    previousFingersRef.current = { left: null, right: null };
    massageProgressRef.current = {
      left: { maxProgress: 0, lastProgress: 0, lastSweep: 0 },
      right: { maxProgress: 0, lastProgress: 0, lastSweep: 0 },
    };
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
    });
  }, [selectedScene, stage.id]);

  useEffect(() => {
    const now = performance.now();
    let nextInteraction;

    if (selectedScene === SCENE_IDS.templeGarden) {
      nextInteraction = scoreTemplePress({
          features,
          fingertips,
          targets: templeTargets,
          timestamp: now,
          progressState: templeProgressRef.current,
          stageProgress,
        });
    } else if (selectedScene === SCENE_IDS.rainWiper) {
      const previous = previousFingersRef.current;
      nextInteraction = scoreUnderEyeMassageGesture({
        fingertips,
        previousFingertips: previous,
        timestamp: now,
        containerSize,
        progressRef: massageProgressRef,
        trajectories: gestureTrajectories,
      });
      previousFingersRef.current = {
        left: fingertips.left ? { point: fingertips.left, timestamp: now } : null,
        right: fingertips.right ? { point: fingertips.right, timestamp: now } : null,
      };
    } else {
      nextInteraction = scoreMouthOpening({
          features,
          timestamp: now,
          progressState: mouthProgressRef.current,
          stageProgress,
        });
    }

    setInteraction(nextInteraction);
  }, [containerSize, features, fingertips, gestureTrajectories, selectedScene, stageProgress, templeTargets]);

  useEffect(() => {
    const nextTarget = snapshotTargetsRef.current[0];
    if (nextTarget === undefined || globalProgress < nextTarget) return;

    const snapshot = captureRoutineSnapshot({
      video: videoRef.current,
      isDemoMode,
      progress: globalProgress,
      score: interaction.score || feedback.score,
    });

    if (snapshot) {
      snapshotFramesRef.current = [...snapshotFramesRef.current, snapshot].slice(-5);
      snapshotTargetsRef.current = snapshotTargetsRef.current.slice(1);
    }
  }, [feedback.score, globalProgress, interaction.score, isDemoMode]);

  useEffect(() => {
    setStageScores((current) => ({
      ...current,
      [stage.id]: Math.max(current[stage.id] || 0, interaction.score || feedback.localScore),
    }));
  }, [feedback.localScore, interaction.score, stage.id]);

  useEffect(() => {
    if (elapsed >= totalSeconds) {
      onComplete(buildResult(stageScores, snapshotFramesRef.current));
    }
  }, [elapsed, onComplete, stageScores]);

  const displayScore = Math.max(stageScores[stage.id] || 0, interaction.score || feedback.score);

  return (
    <section className="screen routine-screen play-routine-screen">
      <div className="routine-layout play-routine-layout">
        <div className="mirror-stage routine-mirror play-routine-mirror" ref={stageRef}>
          {selectedScene === SCENE_IDS.templeGarden ? (
            <TempleGardenScene interaction={interaction} targets={templeTargets} />
          ) : selectedScene === SCENE_IDS.rainWiper ? (
            <>
              <RainScene interaction={interaction} trajectories={gestureTrajectories} />
              <WindshieldWiperOverlay
                fingertips={fingertips}
                height={containerSize.height}
                interaction={interaction}
                trajectories={gestureTrajectories}
                width={containerSize.width}
              />
            </>
          ) : (
            <WhaleDreamScene interaction={interaction} />
          )}
          <TrackingVideo videoRef={videoRef} isDemoMode={isDemoMode} />
          <CameraPreview
            detectorMode={detectorMode}
            handMode={selectedScene === SCENE_IDS.whaleDream ? interaction.isOpen ? 'good-flow' : 'mouth-ready' : handMode}
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
      Array.from({ length: 52 }, (_, index) => ({
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
      Array.from({ length: 22 }, (_, index) => ({
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

function WhaleDreamScene({ interaction }) {
  const mouthOpen = clamp(interaction.mouthOpen || 0, 0, 1);
  const fish = useMemo(
    () =>
      Array.from({ length: 22 }, (_, index) => ({
        id: index,
        delay: (index % 7) * 0.15,
        size: 0.72 + (index % 5) * 0.13,
        x: 42 + ((index * 37) % 148),
        y: 315 + ((index * 29) % 115),
        driftX: -92 + ((index * 41) % 184),
        driftY: -54 - ((index * 31) % 110),
      })),
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
        <h1>Whale Dream</h1>
        <p>Open wide and let little fish drift out</p>
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
            className="dream-fish"
            style={{
              '--fish-x': `${item.x}px`,
              '--fish-y': `${item.y}px`,
              '--drift-x': `${item.driftX}px`,
              '--drift-y': `${item.driftY}px`,
              '--fish-scale': item.size,
              '--fish-delay': `${item.delay}s`,
            }}
          />
        ))}
      </div>
      <div className="flow-chip">{interaction.isOpen ? '~~ Good flow' : 'Open your mouth gently'}</div>
    </div>
  );
}

function RainScene({ interaction, trajectories }) {
  const cleared = Math.round((interaction.completion || 0) * 100);
  const canvasRef = useRef(null);
  const interactionRef = useRef(interaction);
  const trajectoriesRef = useRef(trajectories);

  useEffect(() => {
    interactionRef.current = interaction;
  }, [interaction]);

  useEffect(() => {
    trajectoriesRef.current = trajectories;
  }, [trajectories]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    let animationFrame = 0;
    let width = 0;
    let height = 0;
    let droplets = [];
    let impacts = [];
    const storm = {
      nextBurstAt: 0,
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      const context = canvas.getContext('2d');
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      droplets = createRainDroplets(width, height);
      impacts = createRainImpacts(width, height);
      storm.nextBurstAt = 0;
    };

    const draw = (time) => {
      const context = canvas.getContext('2d');
      if (!width || !height) resize();
      drawBlurredRoad(context, width, height, time);
      drawGlassWater(context, width, height, time, droplets, impacts, interactionRef.current, storm, trajectoriesRef.current);
      drawMiniCleanedSweeps(context, interactionRef.current, trajectoriesRef.current);
      animationFrame = requestAnimationFrame(draw);
    };

    resize();
    animationFrame = requestAnimationFrame(draw);
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="rain-scene" aria-hidden="true">
      <canvas ref={canvasRef} className="rain-canvas" />
      <div className="cleared-meter" style={{ '--cleared': `${cleared}%` }}>
        <span />
      </div>
    </div>
  );
}

function createRainDroplets(width, height) {
  const count = Math.round(Math.min(190, Math.max(82, (width * height) / 5200)));
  return Array.from({ length: count }, (_, index) => {
    const sizeBias = Math.random() ** 1.8;
    return {
      id: index,
      x: Math.random() * width,
      y: Math.random() * height,
      radius: 1.4 + sizeBias * 12,
      stretch: 0.7 + Math.random() * 1.8,
      speed: 0.03 + Math.random() * 0.42,
      opacity: 0.22 + Math.random() * 0.48,
      trail: Math.random() > 0.68 ? 16 + Math.random() * 80 : 0,
      wobble: Math.random() * Math.PI * 2,
    };
  });
}

function createRainImpacts(width, height) {
  return Array.from({ length: 64 }, (_, index) => ({
    id: index,
    active: false,
    x: Math.random() * width,
    y: Math.random() * height,
    startedAt: 0,
    duration: 900,
    size: 8,
    trail: 32,
    drift: 0,
    opacity: 1,
    seed: Math.random() * Math.PI * 2,
  }));
}

function drawBlurredRoad(context, width, height, time) {
  const drift = Math.sin(time / 6000) * width * 0.012;
  const sky = context.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#dcebea');
  sky.addColorStop(0.34, '#b6cbca');
  sky.addColorStop(0.58, '#879d9e');
  sky.addColorStop(1, '#2e3d42');
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);

  context.save();
  context.filter = `blur(${Math.max(10, width * 0.018)}px) saturate(0.92)`;
  context.translate(drift, 0);

  const horizon = height * 0.52;
  context.fillStyle = 'rgba(66, 91, 88, 0.34)';
  context.fillRect(-width * 0.12, horizon - height * 0.07, width * 1.24, height * 0.18);

  const road = context.createLinearGradient(0, horizon, 0, height);
  road.addColorStop(0, 'rgba(148, 163, 157, 0.48)');
  road.addColorStop(0.52, 'rgba(82, 95, 93, 0.62)');
  road.addColorStop(1, 'rgba(20, 30, 31, 0.86)');
  context.fillStyle = road;
  context.beginPath();
  context.moveTo(-width * 0.2, height);
  context.lineTo(width * 0.36, horizon);
  context.lineTo(width * 0.64, horizon);
  context.lineTo(width * 1.2, height);
  context.closePath();
  context.fill();

  context.strokeStyle = 'rgba(241, 236, 187, 0.42)';
  context.lineWidth = Math.max(7, width * 0.018);
  context.beginPath();
  context.moveTo(width * 0.42, height);
  context.lineTo(width * 0.5, horizon + height * 0.05);
  context.moveTo(width * 0.58, height);
  context.lineTo(width * 0.52, horizon + height * 0.05);
  context.stroke();

  drawBlurredVehicle(context, width * 0.18, horizon - height * 0.03, width * 0.24, height * 0.11, '#e7eeea');
  drawBlurredVehicle(context, width * 0.74, horizon - height * 0.02, width * 0.22, height * 0.12, '#45585a');
  drawBokeh(context, width * 0.23, horizon + height * 0.02, width * 0.035, '#d02028', 0.85);
  drawBokeh(context, width * 0.88, horizon - height * 0.01, width * 0.052, '#ff9c22', 0.95);
  drawBokeh(context, width * 0.62, horizon + height * 0.015, width * 0.025, '#e91d2e', 0.72);
  drawBokeh(context, width * 0.45, horizon - height * 0.22, width * 0.06, '#f4f5de', 0.28);

  context.restore();

  context.fillStyle = 'rgba(218, 239, 238, 0.12)';
  context.fillRect(0, 0, width, height);
}

function drawBlurredVehicle(context, x, y, width, height, color) {
  context.fillStyle = color;
  context.beginPath();
  context.roundRect(x, y, width, height, Math.min(18, height * 0.22));
  context.fill();
}

function drawBokeh(context, x, y, radius, color, alpha) {
  const glow = context.createRadialGradient(x, y, 0, x, y, radius);
  glow.addColorStop(0, color);
  glow.addColorStop(0.42, color);
  glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.globalAlpha = alpha;
  context.fillStyle = glow;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;
}

function drawGlassWater(context, width, height, time, droplets, impacts, interaction, storm, trajectories) {
  context.save();
  context.fillStyle = 'rgba(236, 255, 255, 0.16)';
  context.fillRect(0, 0, width, height);
  context.restore();

  spawnRainBursts(impacts, width, height, time, storm);

  droplets.forEach((drop) => {
    drop.y += drop.speed;
    drop.x += Math.sin(time / 1700 + drop.wobble) * 0.014;
    if (drop.y - drop.radius > height + 90) {
      drop.x = Math.random() * width;
      drop.y = -drop.radius - Math.random() * height * 0.18;
    }

    const fade = getWiperFade(drop, trajectories, interaction);
    if (fade < 0.08) return;
    drawDroplet(context, drop, fade);
  });

  impacts.forEach((impact) => {
    if (!impact.active || time < impact.startedAt) return;

    const progress = (time - impact.startedAt) / impact.duration;
    if (progress > 1) {
      impact.active = false;
      return;
    }

    const fade = getWiperFade(impact, trajectories, interaction);
    if (fade < 0.08) return;
    drawRainImpact(context, impact, progress, fade);
  });
}

function spawnRainBursts(impacts, width, height, time, storm) {
  if (!storm.nextBurstAt) {
    storm.nextBurstAt = time + 160;
  }
  if (time < storm.nextBurstAt) return;

  const mood = Math.random();
  const count =
    mood > 0.9 ? 10 + Math.floor(Math.random() * 10) : mood > 0.58 ? 3 + Math.floor(Math.random() * 5) : 1;
  const bandBias = Math.random();
  const baseY = bandBias > 0.72 ? height * (0.18 + Math.random() * 0.28) : height * (0.05 + Math.random() * 0.76);

  for (let index = 0; index < count; index += 1) {
    const slot = impacts.find((impact) => !impact.active);
    if (!slot) break;

    const sizeBias = Math.random() ** 1.35;
    const size = 4 + sizeBias * 24;
    Object.assign(slot, {
      active: true,
      x: clamp(Math.random() * width + (Math.random() - 0.5) * width * 0.1, 0, width),
      y: clamp(baseY + (Math.random() - 0.5) * height * 0.18, height * 0.04, height * 0.88),
      startedAt: time + Math.random() * 220,
      duration: 680 + Math.random() * 1080,
      size,
      trail: 18 + Math.random() * (size > 17 ? 128 : 70),
      drift: (Math.random() - 0.5) * 18,
      opacity: 0.58 + Math.random() * 0.42,
      seed: Math.random() * Math.PI * 2,
    });
  }

  storm.nextBurstAt = time + 90 + Math.random() * (mood > 0.9 ? 220 : 540);
}

function drawDroplet(context, drop, fade) {
  const rx = drop.radius * drop.stretch;
  const ry = drop.radius;
  context.save();
  context.globalAlpha = drop.opacity * fade;
  context.translate(drop.x, drop.y);

  if (drop.trail) {
    const trail = context.createLinearGradient(0, -drop.trail * 0.1, 0, drop.trail);
    trail.addColorStop(0, 'rgba(255,255,255,0.34)');
    trail.addColorStop(0.42, 'rgba(220,246,246,0.14)');
    trail.addColorStop(1, 'rgba(220,246,246,0)');
    context.fillStyle = trail;
    context.beginPath();
    context.ellipse(0, drop.trail * 0.38, Math.max(1.3, rx * 0.22), drop.trail * 0.58, 0, 0, Math.PI * 2);
    context.fill();
  }

  const rim = context.createRadialGradient(-rx * 0.28, -ry * 0.32, 0, 0, 0, Math.max(rx, ry) * 1.2);
  rim.addColorStop(0, 'rgba(255,255,255,0.9)');
  rim.addColorStop(0.18, 'rgba(255,255,255,0.34)');
  rim.addColorStop(0.48, 'rgba(84,105,103,0.12)');
  rim.addColorStop(0.72, 'rgba(20,38,39,0.34)');
  rim.addColorStop(1, 'rgba(255,255,255,0.24)');
  context.fillStyle = rim;
  context.beginPath();
  context.ellipse(0, 0, rx, ry, drop.wobble * 0.08, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = 'rgba(245,255,255,0.62)';
  context.lineWidth = Math.max(0.8, drop.radius * 0.16);
  context.beginPath();
  context.ellipse(0, 0, rx, ry, drop.wobble * 0.08, -Math.PI * 0.82, Math.PI * 0.22);
  context.stroke();

  context.fillStyle = 'rgba(255,255,255,0.86)';
  context.beginPath();
  context.arc(-rx * 0.34, -ry * 0.34, Math.max(0.8, drop.radius * 0.13), 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawRainImpact(context, impact, progress, fade) {
  const appear = clamp(progress / 0.16, 0, 1);
  const fadeOut = 1 - clamp((progress - 0.36) / 0.64, 0, 1);
  const splash = Math.sin(clamp(progress / 0.58, 0, 1) * Math.PI);
  const alpha = impact.opacity * fade * fadeOut;
  const x = impact.x + impact.drift * progress;
  const y = impact.y + impact.trail * Math.max(0, progress - 0.26) * 0.42;
  const radius = impact.size * (0.48 + progress * 0.72);

  context.save();

  if (progress > 0.22) {
    const trailProgress = clamp((progress - 0.22) / 0.78, 0, 1);
    const trailLength = impact.trail * trailProgress;
    const trailGradient = context.createLinearGradient(x, y - impact.size * 0.2, x, y + trailLength);
    trailGradient.addColorStop(0, `rgba(255,255,255,${0.4 * alpha})`);
    trailGradient.addColorStop(0.3, `rgba(208,244,247,${0.26 * alpha})`);
    trailGradient.addColorStop(1, 'rgba(208,244,247,0)');
    context.strokeStyle = trailGradient;
    context.lineWidth = Math.max(1.2, impact.size * 0.22);
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(x, y);
    context.bezierCurveTo(
      x + Math.sin(impact.seed) * impact.size * 0.34,
      y + trailLength * 0.24,
      x - Math.cos(impact.seed) * impact.size * 0.28,
      y + trailLength * 0.62,
      x + impact.drift * 0.24,
      y + trailLength,
    );
    context.stroke();
  }

  const glow = context.createRadialGradient(x - impact.size * 0.22, y - impact.size * 0.24, 0, x, y, radius * 1.65);
  glow.addColorStop(0, `rgba(255,255,255,${0.92 * alpha * appear})`);
  glow.addColorStop(0.2, `rgba(235,252,255,${0.46 * alpha})`);
  glow.addColorStop(0.58, `rgba(28,49,51,${0.16 * alpha})`);
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = glow;
  context.beginPath();
  context.ellipse(x, y, radius * 0.86, radius * 0.62, impact.seed * 0.08, 0, Math.PI * 2);
  context.fill();

  context.globalAlpha = alpha * splash * 0.75;
  context.strokeStyle = 'rgba(243, 255, 255, 0.78)';
  context.lineWidth = Math.max(0.8, impact.size * 0.08);
  context.beginPath();
  context.ellipse(x, y, radius * 1.12, radius * 0.78, impact.seed * 0.08, 0, Math.PI * 2);
  context.stroke();

  for (let index = 0; index < 4; index += 1) {
    const angle = impact.seed + index * 1.62;
    const distance = impact.size * (0.4 + progress * 1.15);
    const dotX = x + Math.cos(angle) * distance;
    const dotY = y + Math.sin(angle) * distance * 0.58;
    context.globalAlpha = alpha * splash * (0.42 - index * 0.05);
    context.fillStyle = 'rgba(248, 255, 255, 0.9)';
    context.beginPath();
    context.arc(dotX, dotY, Math.max(0.7, impact.size * 0.07), 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}

function drawMiniCleanedSweeps(context, interaction, trajectories) {
  const paths = getMiniWiperPaths(trajectories);
  if (!paths.length) return;
  context.save();
  context.globalAlpha = 0.46;
  context.strokeStyle = 'rgba(236, 255, 255, 0.52)';
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.filter = 'blur(1px)';
  paths.forEach(({ path, side }) => {
    const progress = side === 'left' ? interaction.leftCompletion || 0 : interaction.rightCompletion || 0;
    drawPartialPointPath(context, path.points, progress, Math.max(18, (path.trackWidth || path.tolerance || 26) * 1.45));
  });
  context.restore();
}

function getWiperFade(drop, trajectories, interaction) {
  const paths = getMiniWiperPaths(trajectories);
  const cleared = paths.some(({ path, side }) => {
    const progress = side === 'left' ? interaction.leftCompletion || 0 : interaction.rightCompletion || 0;
    return isNearClearedPath(drop, path, progress);
  });
  return cleared ? 0.18 : 1;
}

function drawPartialPointPath(context, points = [], progress = 0, lineWidth = 24) {
  const maxIndex = Math.max(1, Math.floor(clamp(progress, 0, 1) * (points.length - 1)));
  if (points.length < 2 || maxIndex < 1) return;
  context.lineWidth = lineWidth;
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let index = 1; index <= maxIndex; index += 1) {
    context.lineTo(points[index].x, points[index].y);
  }
  context.stroke();
}

function isNearClearedPath(point, path, progress) {
  if (!path?.points?.length || progress <= 0.02) return false;
  const maxIndex = Math.max(1, Math.floor(clamp(progress, 0, 1) * (path.points.length - 1)));
  const tolerance = Math.max(18, (path.trackWidth || path.tolerance || 26) * 1.35);
  for (let index = 0; index <= maxIndex; index += 1) {
    const pathPoint = path.points[index];
    if (Math.hypot(point.x - pathPoint.x, point.y - pathPoint.y) <= tolerance) return true;
  }
  return false;
}

function getWiperGeometry(width, height) {
  const bladeLength = Math.min(width * 0.36, height * 0.58);

  return {
    leftPivot: { x: width * 0.28, y: height * 0.68 },
    rightPivot: { x: width * 0.72, y: height * 0.68 },
    bladeLength,
    radius: bladeLength * 0.92,
    leftStart: -48,
    leftRange: 82,
    rightStart: -34,
    rightRange: 82,
  };
}

function getMiniWiperPaths(trajectories) {
  if (!trajectories) return [];
  if (trajectories.left || trajectories.right) {
    return [
      trajectories.left && { path: trajectories.left, side: 'left' },
      trajectories.right && { path: trajectories.right, side: 'right' },
    ].filter(Boolean);
  }
  if (Array.isArray(trajectories.all)) {
    return trajectories.all.map((path, index) => ({
      path,
      side: index === 0 ? 'left' : 'right',
    }));
  }
  if (Array.isArray(trajectories)) {
    return trajectories.map((path, index) => ({
      path,
      side: index === 0 ? 'left' : 'right',
    }));
  }
  return [];
}

function samplePathPoint(points = [], progress = 0) {
  if (!points.length) return { x: 0, y: 0 };
  const scaled = clamp(progress, 0, 1) * (points.length - 1);
  const index = Math.floor(scaled);
  const nextIndex = Math.min(points.length - 1, index + 1);
  const t = scaled - index;
  const current = points[index];
  const next = points[nextIndex];
  return {
    x: current.x + (next.x - current.x) * t,
    y: current.y + (next.y - current.y) * t,
  };
}

function quadraticPath(start, control, end) {
  if (!start || !control || !end) return '';
  return `M ${round(start.x)} ${round(start.y)} Q ${round(control.x)} ${round(control.y)} ${round(end.x)} ${round(end.y)}`;
}

function isNearSweptArc(point, pivot, radius, start, end) {
  const dx = point.x - pivot.x;
  const dy = point.y - pivot.y;
  const distanceFromArc = Math.abs(Math.hypot(dx, dy) - radius);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
  const minAngle = Math.min(start, end) - 8;
  const maxAngle = Math.max(start, end) + 8;
  return distanceFromArc < radius * 0.13 && angle >= minAngle && angle <= maxAngle;
}

function degreesToRadians(degrees) {
  return (degrees * Math.PI) / 180;
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

function WindshieldWiperOverlay({ fingertips, height, interaction, trajectories, width }) {
  if (!width || !height) return null;

  const miniPaths = getMiniWiperPaths(trajectories);

  return (
    <svg className="landmark-overlay wiper-overlay" viewBox={`0 0 ${width} ${height}`}>
      {miniPaths.map(({ path, side }) => (
        <MiniUnderEyeWiper
          key={path.id || side}
          path={path}
          progress={side === 'left' ? interaction.leftCompletion || 0 : interaction.rightCompletion || 0}
          side={side}
        />
      ))}
      {fingertips?.left && <FingertipDot point={fingertips.left} side="left" isOnTrack={interaction.leftOnTrack} />}
      {fingertips?.right && <FingertipDot point={fingertips.right} side="right" isOnTrack={interaction.rightOnTrack} />}
    </svg>
  );
}

function MiniUnderEyeWiper({ path, progress, side }) {
  const clamped = clamp(progress, 0, 1);
  const point = samplePathPoint(path.points, clamped);
  const nextPoint = samplePathPoint(path.points, Math.min(1, clamped + 0.04));
  const angle = Math.atan2(nextPoint.y - point.y, nextPoint.x - point.x) * (180 / Math.PI);
  const length = clamp((path.trackWidth || path.tolerance || 28) * 1.42, 28, 56);
  const pathD = path.d || quadraticPath(path.start, path.control, path.end);

  return (
    <g className={`mini-wiper-group ${side}`}>
      {path.highlight && <path className="mini-under-eye-highlight" d={path.highlight} />}
      <path className="mini-under-eye-track" d={pathD} pathLength="100" />
      <path
        className="mini-under-eye-progress"
        d={pathD}
        pathLength="100"
        style={{ strokeDasharray: `${Math.max(6, Math.round(clamped * 100))} 100` }}
      />
      <g className="mini-wiper-blade" transform={`translate(${point.x} ${point.y}) rotate(${angle + 88})`}>
        <line className="mini-wiper-shadow" x1="0" y1={-length / 2} x2="0" y2={length / 2} />
        <line className="mini-wiper-rubber" x1="0" y1={-length / 2} x2="0" y2={length / 2} />
        <circle className="mini-wiper-hinge" cx="0" cy="0" r="7" />
        <circle className="mini-wiper-hinge-core" cx="0" cy="0" r="3" />
      </g>
    </g>
  );
}

function WiperBlade({ pivot, length, angle }) {
  return (
    <g className="wiper-blade" transform={`translate(${pivot.x} ${pivot.y}) rotate(${angle})`}>
      <line className="wiper-arm-metal" x1="0" y1="0" x2="0" y2={-length * 0.92} />
      <line className="wiper-arm-shadow" x1="0" y1={-length * 0.16} x2="0" y2={-length} />
      <line className="wiper-rubber" x1="0" y1={-length * 0.16} x2="0" y2={-length} />
      <circle className="wiper-pivot" cx="0" cy="0" r="15" />
      <circle className="wiper-pivot-core" cx="0" cy="0" r="6" />
    </g>
  );
}

function WiperClearArc({ pivot, radius, startAngle, endAngle, progress }) {
  const path = describeArc(pivot.x, pivot.y, radius * 0.9, startAngle, endAngle);
  const dash = Math.round(22 + progress * 74);

  return (
    <path
      className="wiper-clear-arc"
      d={path}
      pathLength="100"
      style={{ strokeDasharray: `${dash} 100`, strokeWidth: radius * 0.2 }}
    />
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

function createUnderEyeGestureTrajectories(features, size) {
  const landmarkPaths = generateUnderEyeMassagePaths(features);
  if (landmarkPaths.length >= 2) {
    const sorted = [...landmarkPaths].sort((a, b) => getPathCenterX(a) - getPathCenterX(b));
    return {
      left: sorted[0],
      right: sorted[1],
      all: sorted,
    };
  }

  const width = size.width || 720;
  const height = size.height || 520;
  const y = height * 0.42;
  const left = createFallbackUnderEyePath({
    id: 'under-eye-left-fallback',
    start: { x: width * 0.45, y },
    control: { x: width * 0.35, y: y + height * 0.035 },
    end: { x: width * 0.22, y: y + height * 0.01 },
    tolerance: Math.max(34, width * 0.095),
  });
  const right = createFallbackUnderEyePath({
    id: 'under-eye-right-fallback',
    start: { x: width * 0.55, y },
    control: { x: width * 0.65, y: y + height * 0.035 },
    end: { x: width * 0.78, y: y + height * 0.01 },
    tolerance: Math.max(34, width * 0.095),
  });

  return { left, right, all: [left, right] };
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

  const left = createFallbackUnderEyePath({
    id: 'temple-left-press',
    start: { x: clamp(leftTarget.x - width * 0.14, 8, width - 8), y: leftTarget.y + height * 0.015 },
    control: { x: leftTarget.x - width * 0.06, y: leftTarget.y },
    end: leftTarget,
    tolerance: leftTarget.tolerance,
  });
  const right = createFallbackUnderEyePath({
    id: 'temple-right-press',
    start: { x: clamp(rightTarget.x + width * 0.14, 8, width - 8), y: rightTarget.y + height * 0.015 },
    control: { x: rightTarget.x + width * 0.06, y: rightTarget.y },
    end: rightTarget,
    tolerance: rightTarget.tolerance,
  });

  return { left, right, all: [left, right] };
}

function scoreTemplePress({ features, fingertips, targets, timestamp, progressState, stageProgress }) {
  const left = scoreTempleSide({ point: fingertips.left, target: targets.left });
  const right = scoreTempleSide({ point: fingertips.right, target: targets.right });
  const bothPressing = left.press > 0.52 && right.press > 0.52;
  const onePressing = left.press > 0.42 || right.press > 0.42;
  const balanced = 1 - Math.min(1, Math.abs(left.press - right.press));
  const elapsedSeconds = progressState.lastTimestamp
    ? Math.max(0.016, (timestamp - progressState.lastTimestamp) / 1000)
    : 0.016;
  const pulseGain = bothPressing ? (0.022 + balanced * 0.018) * Math.min(2.2, elapsedSeconds * 60) : -0.009;

  progressState.pressFrames = bothPressing ? progressState.pressFrames + 1 : 0;
  progressState.flow = clamp((progressState.flow || 0) + pulseGain, 0, 1);
  const baseline = stageProgress * 0.08;
  const nextScore = Math.round(clamp((progressState.flow * 0.9 + baseline) * 100, 0, 100));
  progressState.score = Math.max(progressState.score || 0, nextScore);
  progressState.lastTimestamp = timestamp;

  const rain = clamp((left.press + right.press) / 2, 0, 1);
  const growth = clamp(progressState.flow, 0, 1);

  return {
    score: progressState.score,
    completion: growth,
    feedback: getTemplePressFeedback({ features, fingertips, bothPressing, onePressing, balanced, growth }),
    isOnTrack: bothPressing,
    leftPress: left.press,
    rightPress: right.press,
    rain,
    growth,
    ripple: onePressing ? clamp(rain * 0.7 + growth * 0.3, 0, 1) : growth * 0.4,
    flow: growth,
    isPressing: bothPressing,
  };
}

function scoreTempleSide({ point, target }) {
  if (!point || !target) {
    return { press: 0, distance: Infinity };
  }
  const distance = Math.hypot(point.x - target.x, point.y - target.y);
  const tolerance = target.tolerance || 54;
  const press = clamp(1 - distance / tolerance, 0, 1);
  return { press, distance };
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

function getInitialFeedback(sceneId) {
  if (sceneId === SCENE_IDS.templeGarden) return 'Press both temples gently';
  if (sceneId === SCENE_IDS.rainWiper) return 'Glide gently outward under your eyes';
  return 'Open wide and let little fish drift out';
}

function scoreMouthOpening({ features, timestamp, progressState, stageProgress }) {
  const ratio = features?.mouth?.openRatio || 0;
  const mouthOpen = clamp((ratio - 0.07) / 0.22, 0, 1);
  const elapsedSeconds = progressState.lastTimestamp
    ? Math.max(0.016, (timestamp - progressState.lastTimestamp) / 1000)
    : 0.016;
  const ratioVelocity = Math.abs(ratio - (progressState.lastRatio || 0)) / elapsedSeconds;
  const isOpen = mouthOpen > 0.38;
  const isWide = mouthOpen > 0.62;
  const isStable = ratioVelocity < 0.9;

  if (isOpen) {
    progressState.openFrames += 1;
    progressState.flow = clamp(progressState.flow + (isWide ? 0.028 : 0.016) + (isStable ? 0.012 : 0), 0, 1);
  } else {
    progressState.openFrames = 0;
    progressState.flow = clamp(progressState.flow - 0.006, 0, 1);
  }

  const baseline = stageProgress * 0.12;
  const nextScore = Math.round(clamp((progressState.flow * 0.88 + baseline) * 100, 0, 100));
  progressState.score = Math.max(progressState.score || 0, nextScore);
  progressState.lastRatio = ratio;
  progressState.lastTimestamp = timestamp;

  return {
    score: progressState.score,
    completion: clamp(progressState.flow, 0, 1),
    feedback: getMouthOpeningFeedback({ features, isOpen, isWide, isStable, mouthOpen }),
    isOnTrack: isOpen && isStable,
    mouthOpen,
    flow: progressState.flow,
    fishBurst: isOpen ? clamp(mouthOpen + progressState.flow * 0.25, 0, 1) : 0,
    isOpen,
  };
}

function getMouthOpeningFeedback({ features, isOpen, isWide, isStable, mouthOpen }) {
  if (!features?.mouth) return 'Find your face';
  if (!isOpen) return 'Open wide and breathe out';
  if (!isStable && mouthOpen > 0.45) return 'Hold the whale mouth steady';
  if (isWide) return 'Great flow, little fish are drifting out';
  return 'Nice, open a little wider';
}

function scoreUnderEyeMassageGesture({
  fingertips,
  previousFingertips,
  timestamp,
  containerSize,
  progressRef,
  trajectories,
}) {
  const left = scoreMassagePathSide({
    point: fingertips.left || getNearestFingerForPath(fingertips, trajectories.left),
    previous: previousFingertips.left,
    timestamp,
    containerSize,
    progressState: progressRef.current.left,
    path: trajectories.left,
    side: 'left',
  });
  const right = scoreMassagePathSide({
    point: fingertips.right || getNearestFingerForPath(fingertips, trajectories.right),
    previous: previousFingertips.right,
    timestamp,
    containerSize,
    progressState: progressRef.current.right,
    path: trajectories.right,
    side: 'right',
  });
  const hasLeft = Boolean(fingertips.left);
  const hasRight = Boolean(fingertips.right);
  const activeScores = [left, right].filter((item) => item.hasPoint);
  const average = activeScores.length
    ? averageMetrics(activeScores)
    : {
      score: 0,
      accuracy: 0,
      direction: 0,
      speed: 0,
      completion: 0,
    };
  const completion = Math.max(left.completion, right.completion) * 0.34 + ((left.completion + right.completion) / 2) * 0.66;
  const score = Math.round((average.score + completion * 100) / 2);

  return {
    score,
    accuracy: average.accuracy,
    direction: average.direction,
    speed: average.speed,
    completion,
    feedback: getUnderEyeMassageFeedback({ hasLeft, hasRight, left, right, completion }),
    isOnTrack: left.isOnTrack || right.isOnTrack,
    leftOnTrack: left.isOnTrack,
    rightOnTrack: right.isOnTrack,
    leftCompletion: left.completion,
    rightCompletion: right.completion,
    sweep: (left.sweep + right.sweep) / 2,
    leftSweep: left.sweep,
    rightSweep: right.sweep,
  };
}

function scoreMassagePathSide({ point, previous, timestamp, containerSize, progressState, path }) {
  const width = containerSize.width || 1;

  if (!point || !path?.points?.length) {
    return {
      hasPoint: false,
      score: 0,
      accuracy: 0,
      direction: 0,
      speed: 0,
      completion: progressState.maxProgress || 0,
      isOnTrack: false,
      sweep: progressState.lastSweep || progressState.maxProgress || 0,
    };
  }

  const nearest = getNearestPathProgress(point, path.points);
  const tolerance = path.tolerance || Math.max(28, width * 0.075);
  const onTrack = nearest.distance <= tolerance * 1.35;
  const projectedProgress = clamp(nearest.progress, 0, 1);
  const forwardMovement = projectedProgress >= (progressState.lastProgress || 0) - 0.08;
  const meaningfulAdvance = projectedProgress > (progressState.maxProgress || 0) + 0.018;
  if (onTrack && forwardMovement) {
    progressState.maxProgress = Math.max(progressState.maxProgress || 0, projectedProgress);
  }
  progressState.lastProgress = onTrack ? projectedProgress : progressState.lastProgress || 0;

  const completion = clamp(progressState.maxProgress || 0, 0, 1);
  const accuracy = onTrack ? clamp(1 - nearest.distance / (tolerance * 1.35), 0.24, 1) : 0.12;
  const elapsedSeconds = previous?.timestamp ? Math.max(0.016, (timestamp - previous.timestamp) / 1000) : 0.016;
  const movement = previous?.point ? Math.hypot(point.x - previous.point.x, point.y - previous.point.y) : 0;
  const velocity = movement / elapsedSeconds;
  const direction = onTrack && (forwardMovement || meaningfulAdvance) ? 1 : onTrack ? 0.46 : 0.12;
  const speed = velocity < 18 ? 0.46 : velocity < 430 ? 1 : velocity < 720 ? 0.72 : 0.38;
  const score = Math.round((accuracy * 0.26 + direction * 0.22 + speed * 0.2 + completion * 0.32) * 100);
  const sweepTarget = clamp(completion * 1.08, 0, 1);
  progressState.lastSweep = progressState.lastSweep + (sweepTarget - progressState.lastSweep) * 0.22;

  return {
    hasPoint: true,
    score,
    accuracy,
    direction,
    speed,
    completion,
    isOnTrack: onTrack && direction > 0.5,
    sweep: progressState.lastSweep,
  };
}

function createFallbackUnderEyePath({ id, start, control, end, tolerance }) {
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

function getNearestFingerForPath(fingertips, path) {
  const candidates = [fingertips.left, fingertips.right].filter(Boolean);
  if (!candidates.length || !path?.points?.length) return null;
  return candidates
    .map((point) => ({
      point,
      distance: getNearestPathProgress(point, path.points).distance,
    }))
    .sort((a, b) => a.distance - b.distance)[0]?.point || null;
}

function getNearestPathProgress(point, points) {
  let best = {
    distance: Infinity,
    progress: 0,
  };

  points.forEach((pathPoint, index) => {
    const distance = Math.hypot(point.x - pathPoint.x, point.y - pathPoint.y);
    if (distance < best.distance) {
      best = {
        distance,
        progress: points.length <= 1 ? 0 : index / (points.length - 1),
      };
    }
  });

  return best;
}

function getPathCenterX(path) {
  if (!path?.points?.length) return path?.start?.x || 0;
  return path.points.reduce((total, point) => total + point.x, 0) / path.points.length;
}

function averageMetrics(items) {
  const total = items.reduce(
    (current, item) => ({
      score: current.score + item.score,
      accuracy: current.accuracy + item.accuracy,
      direction: current.direction + item.direction,
      speed: current.speed + item.speed,
      completion: current.completion + item.completion,
    }),
    { score: 0, accuracy: 0, direction: 0, speed: 0, completion: 0 },
  );
  const count = items.length || 1;
  return {
    score: total.score / count,
    accuracy: total.accuracy / count,
    direction: total.direction / count,
    speed: total.speed / count,
    completion: total.completion / count,
  };
}

function getUnderEyeMassageFeedback({ hasLeft, hasRight, left, right, completion }) {
  if (!hasLeft && !hasRight) return 'Show your index fingertip under your eye';
  if (!left.isOnTrack && !right.isOnTrack) return 'Place your finger on the under-eye guide';
  if (left.direction < 0.5 || right.direction < 0.5) return 'Glide from inner eye outward';
  if (left.speed < 0.55 || right.speed < 0.55) return 'Keep gliding outward gently';
  if (left.speed < 0.78 || right.speed < 0.78) return 'Slow and smooth is perfect';
  if (completion > 0.82) return 'Nice, the glass is clearing';
  return 'Good under-eye glide';
}

function describeArc(cx, cy, radius, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  return [
    'M',
    round(start.x),
    round(start.y),
    'A',
    round(radius),
    round(radius),
    0,
    largeArcFlag,
    0,
    round(end.x),
    round(end.y),
  ].join(' ');
}

function polarToCartesian(cx, cy, radius, angleInDegrees) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value) {
  return Number(value.toFixed(2));
}
