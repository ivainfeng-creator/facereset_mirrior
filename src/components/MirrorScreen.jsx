import { useEffect, useRef, useState } from 'react';
import { useFaceLandmarks } from '../hooks/useFaceLandmarks.js';
import { generateFaceOvalPath } from '../utils/overlayPaths.js';

export default function MirrorScreen({ stream, isDemoMode, onBegin, onDemoMode, onBack }) {
  const videoRef = useRef(null);
  const stageRef = useRef(null);
  const [readySince, setReadySince] = useState(null);

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

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!alignment.ready) {
        setReadySince(null);
        return;
      }

      setReadySince((current) => current ?? performance.now());

      if (readySince && performance.now() - readySince > 1400) {
        window.clearInterval(timer);
        onBegin();
      }
    }, 120);
    return () => window.clearInterval(timer);
  }, [alignment.ready, onBegin, readySince]);

  return (
    <section className="screen mirror-screen">
      <div className="mirror-toolbar">
        <button className="ghost-button" onClick={onBack} aria-label="Back to camera setup">
          <span className="button-icon back-icon" aria-hidden="true" />
        </button>
        <div>
          <p className="eyebrow">Mirror alignment</p>
          <h1>對齊你的臉</h1>
        </div>
        <button className="ghost-button" onClick={onDemoMode}>
          Demo
        </button>
      </div>

      <div className="mirror-stage" ref={stageRef}>
        <MirrorVideo videoRef={videoRef} isDemoMode={isDemoMode} />
        <AlignmentLandmarkOverlay
          alignment={alignment}
          features={features}
          width={containerSize.width}
          height={containerSize.height}
        />
        <LandmarkLoadingOverlay
          detectorMode={detectorMode}
          isDemoMode={isDemoMode}
          hasFeatures={Boolean(features)}
        />
        <div className="alignment-card">
          <span className="pulse-dot" />
          <span>{alignment.label}</span>
        </div>
        <div className="mode-chip">
          Eye-only Rain v2 · {formatDetectorMode(detectorMode)} · {detectorMessage}
        </div>
        <div className="quality-meter" aria-label={`Face quality ${alignment.quality}%`}>
          <span style={{ width: `${alignment.quality}%` }} />
        </div>
      </div>
    </section>
  );
}

function LandmarkLoadingOverlay({ detectorMode, isDemoMode, hasFeatures }) {
  if (hasFeatures || isDemoMode) return null;

  const message =
    detectorMode === 'mock-landmark'
      ? 'Real landmarks are not ready. Use Demo if camera landmark loading fails.'
      : 'Loading real facial landmarks';

  return (
    <div className="landmark-loading-overlay">
      <div className="landmark-loading-card">
        <span className="pulse-dot" />
        <span>{message}</span>
      </div>
    </div>
  );
}

function AlignmentLandmarkOverlay({ alignment, features, width, height }) {
  if (!features || !width || !height) return null;
  const ovalPath = generateFaceOvalPath(features);
  const leftEye = features.leftEye.center;
  const rightEye = features.rightEye.center;
  const mouth = features.mouth.center;

  return (
    <svg className="landmark-overlay alignment-overlay" viewBox={`0 0 ${width} ${height}`}>
      <path className="face-oval-path" d={ovalPath} />
      <line className="alignment-feature-line" x1={leftEye.x} y1={leftEye.y} x2={rightEye.x} y2={rightEye.y} />
      <circle className="alignment-anchor" cx={leftEye.x} cy={leftEye.y} r="4" />
      <circle className="alignment-anchor" cx={rightEye.x} cy={rightEye.y} r="4" />
      <circle className="nose-anchor" cx={features.face.noseCenter.x} cy={features.face.noseCenter.y} r="5" />
      <circle className="alignment-anchor soft" cx={mouth.x} cy={mouth.y} r="4" />
    </svg>
  );
}

function formatDetectorMode(mode) {
  if (mode === 'real-landmark') return 'Real landmark mode';
  if (mode === 'mock-landmark') return 'Mock landmark mode';
  return 'No-camera demo mode';
}

export function MirrorVideo({ videoRef, isDemoMode }) {
  if (isDemoMode) {
    return (
      <div className="demo-mirror">
        <div className="demo-face">
          <span className="demo-eye left" />
          <span className="demo-eye right" />
          <span className="demo-nose" />
          <span className="demo-mouth" />
        </div>
      </div>
    );
  }

  return <video ref={videoRef} className="mirror-video" autoPlay playsInline muted />;
}
