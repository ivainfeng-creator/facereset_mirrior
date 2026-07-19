import { useEffect, useMemo, useRef, useState } from 'react';
import { STAGE_SECONDS, routineStages } from '../data/routine.js';
import { useFaceLandmarks } from '../hooks/useFaceLandmarks.js';
import { useHandTracking } from '../hooks/useHandTracking.js';
import { buildResult, getRoutineFeedback } from '../utils/mockDetection.js';
import {
  createAnimatedPathStyle,
  createUnderEyePath,
} from '../utils/overlayPaths.js';
import { scoreFingertipAgainstPaths } from '../utils/pathTracking.js';
import { MirrorVideo } from './MirrorScreen.jsx';

const totalSeconds = STAGE_SECONDS * routineStages.length;

export default function RoutineScreen({ stream, isDemoMode, onComplete }) {
  const videoRef = useRef(null);
  const previewVideoRef = useRef(null);
  const stageRef = useRef(null);
  const previousFingerRef = useRef(null);
  const [elapsed, setElapsed] = useState(0);
  const [stageScores, setStageScores] = useState({});
  const [interaction, setInteraction] = useState({
    score: 0,
    completion: 0,
    feedback: 'Follow the glowing path',
    isOnTrack: false,
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
  const trajectories = useMemo(() => createStageTrajectories(stage.area, features), [features, stage.area]);
  const { fingertip, handMessage, handMode, hasFingertip } = useHandTracking({
    videoRef,
    stream,
    isDemoMode,
    displayRect,
    trajectories,
  });

  useEffect(() => {
    previousFingerRef.current = null;
    setInteraction({
      score: 0,
      completion: 0,
      feedback: 'Follow the glowing path',
      isOnTrack: false,
    });
  }, [stage.id]);

  useEffect(() => {
    const now = performance.now();
    const previous = previousFingerRef.current;
    const nextInteraction = scoreFingertipAgainstPaths({
      point: fingertip,
      previousPoint: previous?.point,
      timestamp: now,
      previousTimestamp: previous?.timestamp,
      paths: trajectories,
      previousMaxProgress: interaction.completion,
    });

    setInteraction(nextInteraction);
    previousFingerRef.current = fingertip ? { point: fingertip, timestamp: now } : null;
  }, [fingertip, interaction.completion, trajectories]);

  useEffect(() => {
    setStageScores((current) => ({
      ...current,
      [stage.id]: Math.max(current[stage.id] || 0, interaction.score || feedback.localScore),
    }));
  }, [feedback.localScore, interaction.score, stage.id]);

  useEffect(() => {
    if (elapsed >= totalSeconds) {
      onComplete(buildResult(stageScores));
    }
  }, [elapsed, onComplete, stageScores]);

  return (
    <section className="screen routine-screen">
      <div className="routine-header">
        <div>
          <p className="eyebrow">Guided Face Reset</p>
          <h1>{stage.zhTitle}</h1>
        </div>
        <div className="timer-ring" style={{ '--progress': `${globalProgress * 360}deg` }}>
          <span>{formatTime(secondsLeft)}</span>
        </div>
      </div>

      <div className="routine-layout">
        <div className="mirror-stage routine-mirror" ref={stageRef}>
          <RainScene interaction={interaction} />
          <TrackingVideo videoRef={videoRef} isDemoMode={isDemoMode} />
          <LandmarkGuidanceOverlay
            accent={stage.accent}
            area={stage.area}
            features={features}
            fingertip={fingertip}
            height={containerSize.height}
            interaction={interaction}
            stageProgress={stageProgress}
            trajectories={trajectories}
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
            {hasLandmarks && hasFingertip ? `Tracking ${interaction.score}` : handMessage}
          </div>
          <div className={`ai-label bottom-label ${interaction.isOnTrack ? 'positive' : ''}`}>
            {interaction.feedback || feedback.label}
          </div>
        </div>

        <aside className="guidance-panel routine-hud">
          <div className="stage-chip" style={{ '--accent': stage.accent }}>
            Rain Wiper Eye Reset
          </div>
          <h2>{stage.title}</h2>
          <p>把手指當成小雨刷，沿著下眼周發光軌跡，慢慢把雨水刷開。</p>

          <div className="score-row">
            <span>Trajectory score</span>
            <strong>{interaction.score || feedback.score}</strong>
          </div>
          <div className="progress-track">
            <span style={{ width: `${Math.max(globalProgress * 100, interaction.completion * 100)}%` }} />
          </div>

          <div className="tracking-grid">
            <div>
              <span>Path accuracy</span>
              <strong>{toPercent(interaction.accuracy)}</strong>
            </div>
            <div>
              <span>Direction</span>
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

          <div className="breath-widget">
            <span className="breath-circle" />
            <div>
              <strong>Slow and gentle</strong>
              <p>跟著畫面節奏，不需要追求完美。</p>
            </div>
          </div>

          <div className="metrics-list">
            {routineStages.slice(0, 3).map((item) => (
              <div key={item.id}>
                <span>{item.metricLabel}</span>
                <strong>{stageScores[item.id] || '--'}%</strong>
              </div>
            ))}
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
      <div className="rain-sky" />
      <div className="rain-layer near" />
      <div className="rain-layer far" />
      <div className="glass-fog" />
      <div className="water-beads" />
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

function LandmarkGuidanceOverlay({
  accent,
  area,
  features,
  fingertip,
  height,
  interaction,
  stageProgress,
  trajectories,
  width,
}) {
  if (!features || !width || !height) {
    return null;
  }

  return (
    <svg
      className={`landmark-overlay routine-landmark-overlay ${area}`}
      style={{ '--accent': accent }}
      viewBox={`0 0 ${width} ${height}`}
    >
      {area === 'eyes' && (
        <EyeRelaxOverlay interaction={interaction} progress={stageProgress} trajectories={trajectories} />
      )}
      {fingertip && <FingertipDot point={fingertip} isOnTrack={interaction.isOnTrack} />}
    </svg>
  );
}

function EyeRelaxOverlay({ interaction, progress, trajectories }) {
  return (
    <>
      {trajectories.map((path, index) => (
        <g className={interaction.activePath?.id === path.id ? 'active-trajectory' : ''} key={path.id}>
          <path className="under-eye-highlight" d={path.highlight} />
          <path
            className="wiper-cleared-path"
            d={path.d}
            pathLength="100"
            style={{ strokeDasharray: `${Math.round((interaction.completion || 0) * 100)} 100` }}
          />
          <TrajectoryPath path={path} progress={interaction.activePath?.id === path.id ? interaction.completion : 0} />
          <path className="massage-path under-eye-path" d={path.d} />
          {path.dots.map((dot) => (
            <circle className="path-dot under-eye-dot" cx={dot.x} cy={dot.y} r="3.6" key={`${dot.x}-${dot.y}`} />
          ))}
          <polygon className="direction-arrow" points={path.arrow.points} />
          <GuideMarker point={pointAlongDots(path.points, progress)} delay={index * 0.3} />
        </g>
      ))}
    </>
  );
}

function TrajectoryPath({ path, progress }) {
  const activeStyle = createAnimatedPathStyle(progress);
  return (
    <>
      <path
        className="trajectory-track"
        d={path.d}
        pathLength="100"
        style={{ strokeWidth: path.trackWidth }}
      />
      <path
        className="trajectory-flow"
        d={path.d}
        pathLength="100"
        style={{
          ...activeStyle,
          strokeWidth: Math.max(5, path.trackWidth * 0.34),
        }}
      />
    </>
  );
}

function GuideMarker({ point, delay }) {
  if (!point) return null;
  return (
    <g className="guide-marker" style={{ animationDelay: `${delay}s` }}>
      <circle cx={point.x} cy={point.y} r="12" />
      <circle cx={point.x} cy={point.y} r="5" />
    </g>
  );
}

function FingertipDot({ point, isOnTrack }) {
  return (
    <g className={`fingertip-dot ${isOnTrack ? 'on-track' : ''}`}>
      <line className="wiper-handle" x1={point.x - 26} y1={point.y + 30} x2={point.x} y2={point.y} />
      <circle cx={point.x} cy={point.y} r="15" />
      <circle cx={point.x} cy={point.y} r="6" />
    </g>
  );
}

function pointAlongDots(dots, progress) {
  if (!dots.length) return null;
  const loopedProgress = (progress * 1.8) % 1;
  const index = Math.min(dots.length - 1, Math.round(loopedProgress * (dots.length - 1)));
  return dots[index];
}

function createStageTrajectories(area, features) {
  if (!features) return [];
  if (area === 'eyes') return createUnderEyePath(features);
  return [];
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
