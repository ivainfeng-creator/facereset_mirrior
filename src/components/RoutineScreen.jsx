import { useEffect, useMemo, useRef, useState } from 'react';
import { STAGE_SECONDS, routineStages } from '../data/routine.js';
import { useFaceLandmarks } from '../hooks/useFaceLandmarks.js';
import { useHandTracking } from '../hooks/useHandTracking.js';
import { useRainWiperAudio } from '../hooks/useRainWiperAudio.js';
import { buildResult, getRoutineFeedback } from '../utils/mockDetection.js';
import { MirrorVideo } from './MirrorScreen.jsx';

const totalSeconds = STAGE_SECONDS * routineStages.length;

export default function RoutineScreen({ stream, isDemoMode, onComplete }) {
  const videoRef = useRef(null);
  const previewVideoRef = useRef(null);
  const stageRef = useRef(null);
  const previousFingersRef = useRef({ left: null, right: null });
  const snapshotFramesRef = useRef([]);
  const snapshotTargetsRef = useRef([0.12, 0.3, 0.48, 0.66, 0.84]);
  const sweepCoverageRef = useRef({
    left: { min: 0.5, max: 0.5 },
    right: { min: 0.5, max: 0.5 },
  });
  const [elapsed, setElapsed] = useState(0);
  const [stageScores, setStageScores] = useState({});
  const [interaction, setInteraction] = useState({
    score: 0,
    completion: 0,
    feedback: 'Move your index finger side to side',
    isOnTrack: false,
    sweep: 0.5,
    leftSweep: 0.5,
    rightSweep: 0.5,
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
  const gestureTrajectories = useMemo(() => createWiperGestureTrajectories(containerSize), [containerSize]);
  const { fingertips, handMessage, handMode, hasFingertips } = useHandTracking({
    videoRef,
    stream,
    isDemoMode,
    displayRect,
    trajectories: gestureTrajectories,
  });

  const { isSoundEnabled, toggleSound } = useRainWiperAudio({
    leftSweep: interaction.leftSweep,
    rightSweep: interaction.rightSweep,
  });

  useEffect(() => {
    previousFingersRef.current = { left: null, right: null };
    sweepCoverageRef.current = {
      left: { min: 0.5, max: 0.5 },
      right: { min: 0.5, max: 0.5 },
    };
    setInteraction({
      score: 0,
      completion: 0,
      feedback: 'Move your index finger side to side',
      isOnTrack: false,
      sweep: 0.5,
      leftSweep: 0.5,
      rightSweep: 0.5,
    });
  }, [stage.id]);

  useEffect(() => {
    const now = performance.now();
    const previous = previousFingersRef.current;
    const nextInteraction = scoreDualWiperGesture({
      fingertips,
      previousFingertips: previous,
      timestamp: now,
      containerSize,
      coverageRef: sweepCoverageRef,
      fallbackSweep: 0.5 - Math.cos(stageProgress * Math.PI * 2) / 2,
    });

    setInteraction(nextInteraction);
    previousFingersRef.current = {
      left: fingertips.left ? { point: fingertips.left, timestamp: now } : null,
      right: fingertips.right ? { point: fingertips.right, timestamp: now } : null,
    };
  }, [containerSize, fingertips, stageProgress]);

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

  return (
    <section className="screen routine-screen">
      <div className="routine-header">
        <div>
          <p className="eyebrow">Guided Face Reset</p>
          <h1>{stage.zhTitle}</h1>
        </div>
        <div className="routine-controls">
          <button
            className={`sound-toggle ${isSoundEnabled ? 'active' : ''}`}
            type="button"
            aria-pressed={isSoundEnabled}
            onClick={toggleSound}
          >
            <span className="sound-icon" aria-hidden="true" />
            {isSoundEnabled ? 'Sound on' : 'Sound off'}
          </button>
          <div className="timer-ring" style={{ '--progress': `${globalProgress * 360}deg` }}>
            <span>{formatTime(secondsLeft)}</span>
          </div>
        </div>
      </div>

      <div className="routine-layout">
        <div className="mirror-stage routine-mirror" ref={stageRef}>
          <RainScene interaction={interaction} />
          <TrackingVideo videoRef={videoRef} isDemoMode={isDemoMode} />
          <WindshieldWiperOverlay
            fingertips={fingertips}
            height={containerSize.height}
            interaction={interaction}
            width={containerSize.width}
          />
          <CameraPreview
            detectorMode={detectorMode}
            handMode={handMode}
            isDemoMode={isDemoMode}
            previewVideoRef={previewVideoRef}
            stream={stream}
          />
          <div className="ai-label top-label">
            {formatDetectorMode(detectorMode)} · {formatDetectorMode(handMode)} hand ·{' '}
            {hasLandmarks && hasFingertips ? `Tracking ${interaction.score}` : handMessage}
          </div>
          <div className={`ai-label bottom-label ${interaction.isOnTrack ? 'positive' : ''}`}>
            {interaction.feedback || feedback.label}
          </div>
        </div>

        <aside className="routine-hud">
          <div className="stage-chip" style={{ '--accent': stage.accent }}>
            Eye-only Rain v2
          </div>
          <div className="hud-copy">
            <h2>{stage.title}</h2>
            <p>左食指控制左雨刷，右食指控制右雨刷。</p>
          </div>

          <div className="score-row">
            <span>Score</span>
            <strong>{interaction.score || feedback.score}</strong>
          </div>
          <div className="progress-track">
            <span style={{ width: `${Math.max(globalProgress * 100, interaction.completion * 100)}%` }} />
          </div>

          <div className="tracking-grid">
            <div>
              <span>Sweep range</span>
              <strong>{toPercent(interaction.accuracy)}</strong>
            </div>
            <div>
              <span>Side movement</span>
              <strong>{toPercent(interaction.direction)}</strong>
            </div>
            <div>
              <span>Gentle speed</span>
              <strong>{toPercent(interaction.speed)}</strong>
            </div>
            <div>
              <span>Completion</span>
              <strong>{toPercent(interaction.completion)}</strong>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function RainScene({ interaction }) {
  const cleared = Math.round((interaction.completion || 0) * 100);

  return (
    <div className="rain-scene" aria-hidden="true">
      <div className="windshield-frame" />
      <div className="dashboard-edge" />
      <div className="rain-sky" />
      <div className="street-glow left" />
      <div className="street-glow right" />
      <div className="rain-layer near" />
      <div className="rain-layer far" />
      <div className="glass-fog" />
      <div className="water-beads" />
      <div className="running-drops" />
      <div className="cleared-meter" style={{ '--cleared': `${cleared}%` }}>
        <span />
      </div>
    </div>
  );
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

function WindshieldWiperOverlay({ fingertips, height, interaction, width }) {
  if (!width || !height) return null;

  const leftSweep = interaction.leftSweep ?? interaction.sweep ?? 0.5;
  const rightSweep = interaction.rightSweep ?? interaction.sweep ?? 0.5;
  const leftPivot = { x: width * 0.28, y: height * 0.94 };
  const rightPivot = { x: width * 0.72, y: height * 0.94 };
  const bladeLength = Math.min(width * 0.43, height * 0.74);
  const leftAngle = -58 + leftSweep * 96;
  const rightAngle = -38 + rightSweep * 96;

  return (
    <svg className="landmark-overlay wiper-overlay" viewBox={`0 0 ${width} ${height}`}>
      <WiperClearArc pivot={leftPivot} radius={bladeLength} side="left" progress={interaction.leftCompletion || 0} />
      <WiperClearArc pivot={rightPivot} radius={bladeLength} side="right" progress={interaction.rightCompletion || 0} />
      <WiperBlade pivot={leftPivot} length={bladeLength} angle={leftAngle} />
      <WiperBlade pivot={rightPivot} length={bladeLength} angle={rightAngle} />
      <WiperGestureBand width={width} height={height} />
      {fingertips?.left && <FingertipDot point={fingertips.left} side="left" isOnTrack={interaction.leftOnTrack} />}
      {fingertips?.right && <FingertipDot point={fingertips.right} side="right" isOnTrack={interaction.rightOnTrack} />}
    </svg>
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

function WiperClearArc({ pivot, radius, side, progress }) {
  const startAngle = side === 'left' ? -58 : -38;
  const endAngle = side === 'left' ? 38 : 58;
  const path = describeArc(pivot.x, pivot.y, radius * 0.72, startAngle, endAngle);
  const dash = Math.round(22 + progress * 74);

  return (
    <path
      className="wiper-clear-arc"
      d={path}
      pathLength="100"
      style={{ strokeDasharray: `${dash} 100`, strokeWidth: radius * 0.34 }}
    />
  );
}

function WiperGestureBand({ width, height }) {
  const y = height * 0.5;
  return (
    <g className="wiper-gesture-band">
      <path d={`M ${width * 0.22} ${y} C ${width * 0.38} ${y + height * 0.05} ${width * 0.62} ${y + height * 0.05} ${width * 0.78} ${y}`} />
      <circle cx={width * 0.22} cy={y} r="5" />
      <circle cx={width * 0.78} cy={y} r="5" />
    </g>
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

function createWiperGestureTrajectories(size) {
  const width = size.width || 720;
  const height = size.height || 520;
  const y = height * 0.5;
  const points = Array.from({ length: 40 }, (_, index) => {
    const t = index / 39;
    return {
      x: width * (0.22 + t * 0.56),
      y: y + Math.sin(t * Math.PI) * height * 0.05,
    };
  });

  return [
    {
      id: 'wiper-finger-sweep',
      points,
      tolerance: height * 0.32,
    },
  ];
}

function scoreDualWiperGesture({
  fingertips,
  previousFingertips,
  timestamp,
  containerSize,
  coverageRef,
  fallbackSweep,
}) {
  const width = containerSize.width || 1;
  const height = containerSize.height || 1;
  const left = scoreSingleWiperSide({
    point: fingertips.left,
    previous: previousFingertips.left,
    timestamp,
    containerSize,
    coverage: coverageRef.current.left,
    side: 'left',
    fallbackSweep,
  });
  const right = scoreSingleWiperSide({
    point: fingertips.right,
    previous: previousFingertips.right,
    timestamp,
    containerSize,
    coverage: coverageRef.current.right,
    side: 'right',
    fallbackSweep,
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
  const completion = (left.completion + right.completion) / 2;
  const score = Math.round((average.score + completion * 100) / 2);

  return {
    score,
    accuracy: average.accuracy,
    direction: average.direction,
    speed: average.speed,
    completion,
    feedback: getDualWiperFeedback({ hasLeft, hasRight, left, right, completion }),
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

function scoreSingleWiperSide({ point, previous, timestamp, containerSize, coverage, side, fallbackSweep }) {
  const width = containerSize.width || 1;
  const height = containerSize.height || 1;
  const isLeft = side === 'left';

  if (!point) {
    return {
      hasPoint: false,
      score: 0,
      accuracy: 0,
      direction: 0,
      speed: 0,
      completion: clamp((coverage.max - coverage.min) / 0.58, 0, 1),
      isOnTrack: false,
      sweep: fallbackSweep,
    };
  }

  const minX = isLeft ? width * 0.07 : width * 0.45;
  const maxX = isLeft ? width * 0.53 : width * 0.93;
  const sweep = clamp((point.x - minX) / (maxX - minX), 0, 1);
  coverage.min = Math.min(coverage.min, sweep);
  coverage.max = Math.max(coverage.max, sweep);

  const range = coverage.max - coverage.min;
  const completion = clamp(range / 0.58, 0, 1);
  const inGestureBand = point.y > height * 0.18 && point.y < height * 0.82;
  const inSideZone = isLeft ? point.x < width * 0.57 : point.x > width * 0.43;
  const accuracy = inGestureBand && inSideZone ? clamp(range / 0.42, 0.25, 1) : 0.16;
  const elapsedSeconds = previous?.timestamp ? Math.max(0.016, (timestamp - previous.timestamp) / 1000) : 0.016;
  const dx = previous?.point ? Math.abs(point.x - previous.point.x) : 0;
  const velocity = dx / elapsedSeconds;
  const direction = dx > width * 0.006 ? 1 : 0.38;
  const speed = velocity < 24 ? 0.42 : velocity < 540 ? 1 : velocity < 820 ? 0.7 : 0.38;
  const score = Math.round((accuracy * 0.26 + direction * 0.22 + speed * 0.2 + completion * 0.32) * 100);

  return {
    hasPoint: true,
    score,
    accuracy,
    direction,
    speed,
    completion,
    isOnTrack: inGestureBand && inSideZone && direction > 0.5,
    sweep,
  };
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

function getDualWiperFeedback({ hasLeft, hasRight, left, right, completion }) {
  if (!hasLeft && !hasRight) return 'Show both index fingertips';
  if (!hasLeft) return 'Show your left index fingertip';
  if (!hasRight) return 'Show your right index fingertip';
  if (!left.isOnTrack || !right.isOnTrack) return 'Keep each finger on its own side';
  if (left.speed < 0.55 || right.speed < 0.55) return 'A little more movement';
  if (left.speed < 0.78 || right.speed < 0.78) return 'Slower and smoother';
  if (completion > 0.82) return 'Nice, the windshield is clearing';
  return 'Good two-hand sweep';
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
