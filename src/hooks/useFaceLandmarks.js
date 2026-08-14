import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LANDMARK_MODES,
  createFaceLandmarker,
  createMockLandmarkData,
  extractFaceFeatures,
  getAlignmentState,
  getVideoDisplayRect,
  normalizeLandmarkData,
} from '../utils/faceLandmarks.js';

const INITIAL_SIZE = { width: 0, height: 0 };
// Calibration only needs a brief run of valid landmarks. Scene interactions
// retain their own precise per-frame tracking requirements.
const CALIBRATION_CONFIRM_MS = 180;
const TRACKING_LOSS_GRACE_MS = 280;

export function useFaceLandmarks({ videoRef, stageRef, stream, isDemoMode }) {
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
  const stabilityRef = useRef({
    lastCenter: null,
    lastScale: null,
    lastTime: null,
    stabilityMs: 0,
  });
  const stabilityLossTimerRef = useRef(null);

  useEffect(() => () => window.clearTimeout(stabilityLossTimerRef.current), []);

  useEffect(() => {
    const element = stageRef.current;
    if (!element) return undefined;

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      setContainerSize({
        width: rect.width,
        height: rect.height,
      });
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
      setVideoSize({
        width: video.videoWidth || 1280,
        height: video.videoHeight || 720,
      });
    };

    video.addEventListener('loadedmetadata', updateVideoSize);
    updateVideoSize();
    return () => video.removeEventListener('loadedmetadata', updateVideoSize);
  }, [isDemoMode, videoRef, stream]);

  useEffect(() => {
    let isCancelled = false;
    let animationFrame = 0;

    const tickMock = () => {
      if (isCancelled) return;
      const now = performance.now();
      setLandmarkData(createMockLandmarkData(isDemoMode ? LANDMARK_MODES.demo : LANDMARK_MODES.mock, now));
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
            setLandmarkData(normalized);
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
  }, [isDemoMode, stream, videoRef]);

  const effectiveVideoSize = useMemo(() => {
    if (isDemoMode || !stream) {
      return { width: 720, height: 960 };
    }
    return videoSize.width && videoSize.height ? videoSize : { width: 1280, height: 720 };
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
    if (!features) {
      const previous = stabilityRef.current;
      const age = previous.lastTime ? now - previous.lastTime : Infinity;

      // Keep a short landmark-loss grace period so a dropped camera frame does
      // not force someone to restart an otherwise valid alignment scan.
      if (age <= TRACKING_LOSS_GRACE_MS) {
        window.clearTimeout(stabilityLossTimerRef.current);
        stabilityLossTimerRef.current = window.setTimeout(() => {
          stabilityRef.current = {
            lastCenter: null,
            lastScale: null,
            lastTime: null,
            stabilityMs: 0,
          };
          setLandmarkStability({ stable: false, stabilityMs: 0 });
        }, TRACKING_LOSS_GRACE_MS - age);
        return;
      }

      stabilityRef.current = { lastCenter: null, lastScale: null, lastTime: null, stabilityMs: 0 };
      setLandmarkStability({ stable: false, stabilityMs: 0 });
      return;
    }

    window.clearTimeout(stabilityLossTimerRef.current);
    const previous = stabilityRef.current;
    const elapsedMs = previous.lastTime ? Math.min(120, now - previous.lastTime) : 0;
    const stabilityMs = Math.min(2400, previous.stabilityMs + elapsedMs);

    stabilityRef.current = {
      lastCenter: features.bounds.center,
      lastScale: features.faceScale,
      lastTime: now,
      stabilityMs,
    };
    setLandmarkStability({
      stable: stabilityMs >= CALIBRATION_CONFIRM_MS,
      stabilityMs,
    });
  }, [features]);

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
    containerSize,
    displayRect,
    hasLandmarks: Boolean(features),
  };
}
