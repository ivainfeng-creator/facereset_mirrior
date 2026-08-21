import { useEffect, useRef, useState } from 'react';
import {
  CALIBRATION_CONFIRM_MS,
  FALLBACK_ELIGIBILITY_GRACE_MS,
  FALLBACK_MAX_WAIT_MS,
  useFaceLandmarks,
} from '../hooks/useFaceLandmarks.js';
import { getSceneById } from '../data/scenes.js';
import { getSceneTuning } from '../data/interactionTuning.js';
import { playSceneEffect } from '../utils/audioManager.js';
import { createCalibratedCheekPuffState, updateCalibratedCheekPuff } from '../utils/interactionSignal.js';
import { useI18n } from '../i18n/context.js';

// Bubble Gum Bunny learns a neutral cheek baseline during the scan. It must
// never be able to hold the gate open: if it has not converged by this point
// the scan proceeds uncalibrated and the scene calibrates in-place instead.
const CHEEK_PUFF_CALIBRATION_MAX_WAIT_MS = 4000;

const SCAN_COMPLETE_EFFECT = Object.freeze({
  source: '/audio/Overall/Scanning.mp3',
  volume: 0.7,
});
const SCAN_CLOSE_EFFECT = Object.freeze({
  source: '/audio/Overall/Click-2.mp3',
  volume: 0.7,
});
const SCAN_CTA_EFFECT = Object.freeze({
  source: '/audio/Overall/Click-1.mp3',
  volume: 0.7,
});

export default function MirrorScreen({ stream, isDemoMode, selectedScene, onCheekPuffCalibrated, onBegin, onBack, isOverlay = false }) {
  const { t } = useI18n();
  const videoRef = useRef(null);
  const stageRef = useRef(null);
  const alignmentRef = useRef(null);
  const featuresRef = useRef(null);
  const stabilityRef = useRef(null);
  const completedRef = useRef(false);
  const cheekPuffCalibrationRef = useRef(createCalibratedCheekPuffState());
  const hasReportedCheekPuffCalibrationRef = useRef(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [isScanComplete, setIsScanComplete] = useState(false);
  const [isCheekPuffCalibrated, setIsCheekPuffCalibrated] = useState(false);
  const [hasCheekPuffCalibrationTimedOut, setHasCheekPuffCalibrationTimedOut] = useState(false);
  // Scoped to Bubble Gum Bunny. Every other scene skips this entirely, and demo
  // mode never gates on it.
  const requiresCheekPuffCalibration = !isDemoMode
    && getSceneById(selectedScene).interaction === 'cheekPuff';
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

  const {
    alignment,
    landmarkStability,
    fallbackPresenceRef,
    containerSize,
    detectorMessage,
    detectorMode,
    features,
  } = useFaceLandmarks({
    videoRef,
    stageRef,
    stream,
    isDemoMode,
  });

  useEffect(() => {
    alignmentRef.current = alignment;
    featuresRef.current = features;
    stabilityRef.current = landmarkStability;
  }, [alignment, features, landmarkStability]);

  useEffect(() => {
    if (!requiresCheekPuffCalibration) return undefined;

    const timer = window.setTimeout(
      () => setHasCheekPuffCalibrationTimedOut(true),
      CHEEK_PUFF_CALIBRATION_MAX_WAIT_MS,
    );
    return () => window.clearTimeout(timer);
  }, [requiresCheekPuffCalibration]);

  useEffect(() => {
    if (!requiresCheekPuffCalibration || !features?.cheeks) return;
    if (hasReportedCheekPuffCalibrationRef.current) return;

    const calibration = updateCalibratedCheekPuff({
      cheekPuff: features.cheeks.puffRatio,
      mouthPucker: features.cheeks.mouthPucker,
      mouthFunnel: features.cheeks.mouthFunnel,
      mouthOpen: features.cheeks.mouthOpen,
    }, performance.now(), cheekPuffCalibrationRef.current, getSceneTuning(selectedScene).input);

    if (!calibration.calibrated) return;

    hasReportedCheekPuffCalibrationRef.current = true;
    setIsCheekPuffCalibrated(true);
    onCheekPuffCalibrated?.({
      calibrated: true,
      calibrationMs: cheekPuffCalibrationRef.current.calibrationMs,
      samples: [],
      baseline: cheekPuffCalibrationRef.current.baseline,
      lastTimestamp: 0,
    });
  }, [features, onCheekPuffCalibrated, requiresCheekPuffCalibration, selectedScene]);

  useEffect(() => {
    let lastTick = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const elapsed = Math.min(180, now - lastTick);
      lastTick = now;

      const currentAlignment = alignmentRef.current;
      const currentFeatures = featuresRef.current;
      const currentStability = stabilityRef.current;

      // === Soft max-wait fallback decision (wall clock) ===
      // Measured against performance.now(), not against accumulated landmark
      // events, so a usable face that stays broadly present reaches Ready by
      // ~2.5s even if detection events stutter or stop arriving.
      const fallback = fallbackPresenceRef.current;
      const isFallbackHolding = fallback.firstEligibleAt !== null
        && now - fallback.lastEligibleAt <= FALLBACK_ELIGIBILITY_GRACE_MS;
      const fallbackElapsed = isFallbackHolding ? now - fallback.firstEligibleAt : 0;
      const isFallbackReady = fallbackElapsed >= FALLBACK_MAX_WAIT_MS;
      const isCheekPuffGateSatisfied = !requiresCheekPuffCalibration
        || isCheekPuffCalibrated
        || hasCheekPuffCalibrationTimedOut;
      const isReady = (Boolean(currentAlignment?.ready) || isFallbackReady)
        && isCheekPuffGateSatisfied;

      setScanProgress((current) => {
        if (completedRef.current) return 1;

        let next = current;
        if (isReady) {
          next = Math.min(1, current + elapsed / 320);
        } else if (!currentFeatures && !isFallbackHolding) {
          // No face, and not inside the fallback's grace window: decay toward
          // zero. The gate does not pass.
          next = Math.max(0, current - elapsed / 2200);
        } else {
          // Ring tracks whichever path is further along — the strict 700ms
          // confirm or the 2.5s wall-clock fallback — so it never stalls at an
          // artificial ceiling and never jumps at the end.
          const strictProgress = (currentStability?.stabilityMs || 0) / CALIBRATION_CONFIRM_MS;
          const fallbackProgress = fallbackElapsed / FALLBACK_MAX_WAIT_MS;
          const target = Math.min(0.96, Math.max(strictProgress, fallbackProgress));
          next = target >= current
            ? Math.min(target, current + elapsed / 260)
            : Math.max(target, current - elapsed / 1400);
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
  }, [
    fallbackPresenceRef,
    hasCheekPuffCalibrationTimedOut,
    isCheekPuffCalibrated,
    requiresCheekPuffCalibration,
  ]);

  return (
    <section className={`screen mirror-screen scan-alignment-screen ${isOverlay ? 'guide-flow-overlay' : ''}`}>
      <main className="scan-alignment-card" aria-label={t('scan.cardAria')}>
        <div className="scan-alignment-header">
          <h1>{t('scan.title')}</h1>
          <p>{t('scan.subtitle')}</p>
        </div>

        <button
          className="scan-close-button"
          onClick={() => {
            playSceneEffect(SCAN_CLOSE_EFFECT);
            onBack();
          }}
          aria-label={t('scan.backAria')}
        />

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
          onClick={() => {
            playSceneEffect(SCAN_CTA_EFFECT);
            onBegin();
          }}
        >
          {isCameraUnavailable ? t('scan.paused') : isScanComplete ? t('scan.next') : (
            <span className="challenge-v3-start-preparing">
              {t('scan.scanning')}<span>.</span><span>.</span><span>.</span>
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

export function ScanCameraPlaceholder() {
  return (
    <span className="scan-camera-placeholder camera-permission-icon" aria-hidden="true">
      <svg viewBox="0 -960 960 960" focusable="false">
        <path d="M400-480Zm240 320H467q13-18 22.5-38t16.5-42h134v-480H160v131q-22 6-42 15.5T80-551v-169q0-33 23.5-56.5T160-800h480q33 0 56.5 23.5T720-720v180l160-160v440L720-420v180q0 33-23.5 56.5T640-160ZM98.5-178.5Q40-237 40-320t58.5-141.5Q157-520 240-520t141.5 58.5Q440-403 440-320t-58.5 141.5Q323-120 240-120T98.5-178.5ZM240-200q8 0 14-6t6-14q0-8-6-14t-14-6q-8 0-14 6t-6 14q0 8 6 14t14 6Zm-20-80h40v-160h-40v160Z" />
      </svg>
    </span>
  );
}
