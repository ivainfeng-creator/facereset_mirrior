import { useEffect, useRef, useState } from 'react';
import { useFaceLandmarks } from '../hooks/useFaceLandmarks.js';
import {
  pauseSceneEffect,
  playSceneEffect,
  resumeSceneEffect,
  stopSceneEffect,
} from '../utils/audioManager.js';

const SCAN_POPUP_EFFECT = Object.freeze({
  source: '/audio/Overall/Popup.mp3',
  volume: 0.7,
  loop: true,
});
const SCAN_COMPLETE_EFFECT = Object.freeze({
  source: '/audio/Overall/Scanning.mp3',
  volume: 0.7,
});

export default function MirrorScreen({ stream, isDemoMode, onBegin, onBack, isOverlay = false }) {
  const videoRef = useRef(null);
  const stageRef = useRef(null);
  const alignmentRef = useRef(null);
  const featuresRef = useRef(null);
  const completedRef = useRef(false);
  const scanEffectStartedRef = useRef(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [isScanComplete, setIsScanComplete] = useState(false);
  const cameraTrack = stream?.getVideoTracks()[0];
  const isCameraUnavailable = !isDemoMode && (
    !stream
    || !stream.active
    || !cameraTrack
    || !cameraTrack.enabled
    || cameraTrack.readyState !== 'live'
  );

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const { alignment, containerSize, detectorMessage, detectorMode, features } = useFaceLandmarks({
    videoRef,
    stageRef,
    stream,
    isDemoMode,
  });
  const scanProgressCap = alignment?.ready
    ? 1
    : (alignment?.quality || 0) >= 72
      ? 0.74
      : (alignment?.quality || 0) >= 54
        ? 0.42
        : null;
  const isScanStalled = scanProgressCap !== null
    && scanProgress >= scanProgressCap
    && !alignment?.ready;

  useEffect(() => {
    alignmentRef.current = alignment;
    featuresRef.current = features;
  }, [alignment, features]);

  useEffect(() => {
    if (isScanComplete) {
      stopSceneEffect(SCAN_POPUP_EFFECT);
      return;
    }

    if (!features || isCameraUnavailable || isScanStalled) {
      if (scanEffectStartedRef.current) pauseSceneEffect(SCAN_POPUP_EFFECT);
      return;
    }

    if (!scanEffectStartedRef.current) {
      scanEffectStartedRef.current = true;
      playSceneEffect(SCAN_POPUP_EFFECT);
      return;
    }

    resumeSceneEffect(SCAN_POPUP_EFFECT);
  }, [features, isCameraUnavailable, isScanComplete, isScanStalled]);

  useEffect(() => () => stopSceneEffect(SCAN_POPUP_EFFECT), []);

  useEffect(() => {
    let lastTick = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const elapsed = Math.min(180, now - lastTick);
      lastTick = now;

      const currentAlignment = alignmentRef.current;
      const currentFeatures = featuresRef.current;

      setScanProgress((current) => {
        if (completedRef.current) return 1;

        let next = current;
        if (!currentFeatures) {
          next = Math.max(0, current - elapsed / 2200);
        } else if (currentAlignment?.ready) {
          next = Math.min(1, current + elapsed / 650);
        } else if ((currentAlignment?.quality || 0) >= 72) {
          next = Math.min(0.74, current + elapsed / 3200);
        } else if ((currentAlignment?.quality || 0) >= 54) {
          next = Math.min(0.42, current + elapsed / 4200);
        } else {
          next = Math.max(0.08, current - elapsed / 2400);
        }

        if (next >= 1 && !completedRef.current) {
          completedRef.current = true;
          playSceneEffect(SCAN_COMPLETE_EFFECT);
          setIsScanComplete(true);
        }

        return next;
      });
    }, 90);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className={`screen mirror-screen scan-alignment-screen ${isOverlay ? 'guide-flow-overlay' : ''}`}>
      <main className="scan-alignment-card" aria-label="Mirror alignment">
        <div className="scan-alignment-header">
          <h1>Face detection</h1>
          <p>Center your face in the frame</p>
        </div>

        <button className="scan-close-button" onClick={onBack} aria-label="Back to intro" />

        <div className="scan-face-zone">
          <div className={`scan-face-frame ${isCameraUnavailable ? 'is-camera-unavailable' : ''}`} ref={stageRef}>
            <MirrorVideo videoRef={videoRef} isDemoMode={isDemoMode} showPlaceholder={isCameraUnavailable} />
            <div className="scan-face-tint" style={{ '--scan-progress': scanProgress }} />
          </div>
          {!isCameraUnavailable && <ScanProgressRing progress={scanProgress} />}
        </div>

        <button
          className={`scan-primary-action ${isScanComplete ? 'is-complete' : ''}`}
          type="button"
          disabled={!isScanComplete}
          onClick={onBegin}
        >
          {isCameraUnavailable ? 'Scan paused' : isScanComplete ? 'Next' : (
            <span className="challenge-v3-start-preparing">
              Scanning<span>.</span><span>.</span><span>.</span>
            </span>
          )}
        </button>

      </main>
    </section>
  );
}

function ScanProgressRing({ progress }) {
  const dots = 50;
  const center = 120;
  const radius = 102;

  return (
    <svg className="scan-ring" viewBox="0 0 240 240" aria-hidden="true">
      {Array.from({ length: dots }, (_, index) => {
        const angle = -Math.PI / 2 + (index / dots) * Math.PI * 2;
        const rhythm = (Math.sin(index * 1.93) + 1) * 0.006 + (Math.sin(index * 0.61) + 1) * 0.004;
        const threshold = Math.max(0, Math.min(0.98, index / dots + rhythm));
        const active = progress >= threshold;
        const intensity = active ? 0.78 + Math.sin(index * 1.7) * 0.14 : 0;
        return (
          <circle
            key={index}
            className={`scan-ring-dot ${active ? 'active' : ''}`}
            cx={center + Math.cos(angle) * radius}
            cy={center + Math.sin(angle) * radius}
            r="3.2"
            style={{
              '--dot-delay': `${(index % 9) * 24}ms`,
              '--dot-opacity': active ? intensity : 1,
            }}
          />
        );
      })}
    </svg>
  );
}

export function MirrorVideo({ videoRef, isDemoMode, showPlaceholder = false }) {
  if (isDemoMode) {
    return <div className="demo-mirror" />;
  }

  return (
    <>
      {showPlaceholder && <ScanCameraPlaceholder />}
      <video ref={videoRef} className="mirror-video" autoPlay playsInline muted />
    </>
  );
}

function ScanCameraPlaceholder() {
  return (
    <span className="scan-camera-placeholder camera-permission-icon" aria-hidden="true">
      <svg viewBox="0 -960 960 960" focusable="false">
        <path d="M400-480Zm240 320H467q13-18 22.5-38t16.5-42h134v-480H160v131q-22 6-42 15.5T80-551v-169q0-33 23.5-56.5T160-800h480q33 0 56.5 23.5T720-720v180l160-160v440L720-420v180q0 33-23.5 56.5T640-160ZM98.5-178.5Q40-237 40-320t58.5-141.5Q157-520 240-520t141.5 58.5Q440-403 440-320t-58.5 141.5Q323-120 240-120T98.5-178.5ZM240-200q8 0 14-6t6-14q0-8-6-14t-14-6q-8 0-14 6t-6 14q0 8 6 14t14 6Zm-20-80h40v-160h-40v160Z" />
      </svg>
    </span>
  );
}
