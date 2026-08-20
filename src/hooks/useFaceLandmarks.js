import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LANDMARK_MODES,
  createFaceLandmarker,
  createMockLandmarkData,
  extractFaceFeatures,
  getAlignmentState,
  getGatePositionChecks,
  getVideoDisplayRect,
  isFallbackEligible,
  normalizeLandmarkData,
} from '../utils/faceLandmarks.js';

const INITIAL_SIZE = { width: 0, height: 0 };
const FALLBACK_VIDEO_SIZE = { width: 720, height: 960 };
const DEFAULT_VIDEO_SIZE = { width: 1280, height: 720 };
const LANDMARK_COMMIT_INTERVAL_MS = 50;
// The pre-scene gate is a lightweight camera-readiness check, not a precise
// calibration: a roughly-positioned face just needs to hold for ~700ms.
// Scene interactions retain their own precise per-frame tracking requirements.
export const CALIBRATION_CONFIRM_MS = 700;
// Brief 1-2 frame drop-outs (jitter, a blink, a quick head turn) shouldn't
// restart the confirm timer — only a sustained loss should.
const POSITION_GRACE_MS = 260;
const TRACKING_LOSS_GRACE_MS = 280;
// Soft max-wait fallback: once a usable face has been broadly present this
// long, the gate stops waiting on the strict conditions and passes. This is a
// wall-clock deadline measured from `firstEligibleAt` (see below) and decided
// in MirrorScreen's interval — never an accumulator, so it cannot be stalled
// by detection-event gaps or a frozen video element.
export const FALLBACK_MAX_WAIT_MS = 2500;
// Eligibility has to lapse for this long before the deadline restarts, so
// short detection/video gaps are tolerated rather than resetting the wait.
export const FALLBACK_ELIGIBILITY_GRACE_MS = 600;

export function useFaceLandmarks({ videoRef, stageRef, stream, isDemoMode, paused = false }) {
  const [landmarkData, setLandmarkData] = useState(null);
  const [detectorMode, setDetectorMode] = useState(
    isDemoMode ? LANDMARK_MODES.demo : LANDMARK_MODES.mock,
  );
  const [detectorMessage, setDetectorMessage] = useState('Preparing landmarks');
  const [containerSize, setContainerSize] = useState(INITIAL_SIZE);
  const [videoSize, setVideoSize] = useState(INITIAL_SIZE);
  const [landmarkStability, setLandmarkStability] = useState({ stable: false, stabilityMs: 0 });
  const landmarkerRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);
  const lastLandmarkCommitRef = useRef(0);
  const stabilityRef = useRef({ lastTime: null, ms: 0 });
  const stabilityLossTimerRef = useRef(null);
  // Raw wall-clock marks for the soft max-wait fallback. Only timestamps are
  // recorded here; the ~2.5s decision itself is made against `performance.now()`
  // in MirrorScreen's interval, so it stays correct even if landmark events
  // stop arriving entirely.
  const fallbackPresenceRef = useRef({ firstEligibleAt: null, lastEligibleAt: null });

  useEffect(() => () => window.clearTimeout(stabilityLossTimerRef.current), []);

  useEffect(() => {
    const element = stageRef.current;
    if (!element) return undefined;

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      const nextSize = { width: Math.round(rect.width), height: Math.round(rect.height) };
      setContainerSize((current) => (
        current.width === nextSize.width && current.height === nextSize.height
          ? current
          : nextSize
      ));
    };

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, [stageRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || isDemoMode) return undefined;

    const updateVideoSize = () => {
      const nextSize = {
        width: video.videoWidth || 1280,
        height: video.videoHeight || 720,
      };
      setVideoSize((current) => (
        current.width === nextSize.width && current.height === nextSize.height
          ? current
          : nextSize
      ));
    };

    video.addEventListener('loadedmetadata', updateVideoSize);
    updateVideoSize();
    return () => video.removeEventListener('loadedmetadata', updateVideoSize);
  }, [isDemoMode, videoRef, stream]);

  useEffect(() => {
    if (paused) return undefined;

    let isCancelled = false;
    let animationFrame = 0;
    lastLandmarkCommitRef.current = 0;

    const commitLandmarkData = (nextData, timestamp = performance.now()) => {
      if (nextData && timestamp - lastLandmarkCommitRef.current < LANDMARK_COMMIT_INTERVAL_MS) return;
      lastLandmarkCommitRef.current = timestamp;
      setLandmarkData(nextData);
    };

    const tickMock = () => {
      if (isCancelled) return;
      const now = performance.now();
      commitLandmarkData(createMockLandmarkData(isDemoMode ? LANDMARK_MODES.demo : LANDMARK_MODES.mock, now), now);
      animationFrame = requestAnimationFrame(tickMock);
    };

    const tickReal = () => {
      if (isCancelled) return;
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;

      if (video && landmarker && video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime;
        try {
          const result = landmarker.detectForVideo(video, performance.now());
          const normalized = normalizeLandmarkData(result, LANDMARK_MODES.real);
          if (normalized) {
            commitLandmarkData(normalized, normalized.detectedAt);
            setDetectorMode(LANDMARK_MODES.real);
            setDetectorMessage('Real landmark mode');
          } else {
            setDetectorMessage('Looking for landmarks');
            setLandmarkData(null);
          }
        } catch {
          setDetectorMode(LANDMARK_MODES.mock);
          setDetectorMessage('Landmarks unavailable');
          setLandmarkData(null);
        }
      }

      animationFrame = requestAnimationFrame(tickReal);
    };

    if (isDemoMode) {
      setDetectorMode(LANDMARK_MODES.demo);
      setDetectorMessage('Camera preview unavailable');
      tickMock();
      return () => {
        isCancelled = true;
        cancelAnimationFrame(animationFrame);
      };
    }

    if (!stream) {
      setDetectorMode(LANDMARK_MODES.mock);
      setDetectorMessage('Camera unavailable');
      setLandmarkData(null);
      return () => {
        isCancelled = true;
        cancelAnimationFrame(animationFrame);
      };
    }

    setDetectorMessage('Loading face landmarks');
    createFaceLandmarker()
      .then((landmarker) => {
        if (isCancelled) return;
        landmarkerRef.current = landmarker;
        setDetectorMode(LANDMARK_MODES.real);
        setDetectorMessage('Real landmark mode');
        tickReal();
      })
      .catch(() => {
        if (isCancelled) return;
        setDetectorMode(LANDMARK_MODES.mock);
        setDetectorMessage('Landmarks unavailable');
        setLandmarkData(null);
      });

    return () => {
      isCancelled = true;
      cancelAnimationFrame(animationFrame);
    };
  }, [isDemoMode, paused, stream, videoRef]);

  const effectiveVideoSize = useMemo(() => {
    if (isDemoMode || !stream) {
      return FALLBACK_VIDEO_SIZE;
    }
    return videoSize.width && videoSize.height ? videoSize : DEFAULT_VIDEO_SIZE;
  }, [isDemoMode, stream, videoSize]);

  const displayRect = useMemo(
    () => getVideoDisplayRect(effectiveVideoSize, containerSize, 'cover'),
    [effectiveVideoSize, containerSize],
  );
  const features = useMemo(
    () => extractFaceFeatures(landmarkData, displayRect, { mirrored: true }),
    [displayRect, landmarkData],
  );

  useEffect(() => {
    const now = performance.now();

    // --- Soft max-wait fallback: record wall-clock marks only. ---
    // Restart the deadline only after eligibility has been absent for a
    // sustained window, so short detection/video gaps don't reset the wait
    // while a long genuine absence still does.
    if (isFallbackEligible(features, containerSize)) {
      const fallback = fallbackPresenceRef.current;
      const lapsed = fallback.lastEligibleAt === null
        || now - fallback.lastEligibleAt > FALLBACK_ELIGIBILITY_GRACE_MS;
      if (fallback.firstEligibleAt === null || lapsed) {
        fallback.firstEligibleAt = now;
      }
      fallback.lastEligibleAt = now;
    }

    // --- Strict fast path: unchanged 700ms roughly-positioned confirm. ---
    const positionChecks = getGatePositionChecks(features, containerSize);
    const positionOk = positionChecks.requiredLandmarks
      && positionChecks.eyesVisible
      && positionChecks.mouthAndChinVisible
      && positionChecks.closeEnough
      && positionChecks.notTooClose
      && positionChecks.centered;

    const commitStability = (stabilityMs) => {
      const next = { stable: stabilityMs >= CALIBRATION_CONFIRM_MS, stabilityMs };
      setLandmarkStability((current) => (
        current.stable === next.stable && current.stabilityMs === next.stabilityMs
          ? current
          : next
      ));
    };

    const previous = stabilityRef.current;
    if (!positionOk) {
      const age = previous.lastTime ? now - previous.lastTime : Infinity;
      // No face at all gets the longer tracking-loss grace; a face that's
      // present but briefly out of position gets the shorter one, so a 1-2
      // frame jitter doesn't restart the confirm timer.
      const grace = features ? POSITION_GRACE_MS : TRACKING_LOSS_GRACE_MS;

      if (age <= grace) {
        window.clearTimeout(stabilityLossTimerRef.current);
        stabilityLossTimerRef.current = window.setTimeout(() => {
          stabilityRef.current = { lastTime: null, ms: 0 };
          commitStability(0);
        }, grace - age);
        return;
      }

      stabilityRef.current = { lastTime: null, ms: 0 };
      commitStability(0);
      return;
    }

    window.clearTimeout(stabilityLossTimerRef.current);
    const elapsedMs = previous.lastTime ? Math.min(120, now - previous.lastTime) : 0;
    const stabilityMs = Math.min(2400, previous.ms + elapsedMs);
    stabilityRef.current = { lastTime: now, ms: stabilityMs };
    commitStability(stabilityMs);
  }, [features, containerSize]);

  const alignment = useMemo(
    () => getAlignmentState(features, containerSize, landmarkStability),
    [containerSize, features, landmarkStability],
  );

  return {
    detectorMode,
    detectorMessage,
    landmarkData,
    features,
    alignment,
    landmarkStability,
    fallbackPresenceRef,
    containerSize,
    displayRect,
    hasLandmarks: Boolean(features),
  };
}
