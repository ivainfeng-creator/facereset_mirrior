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
        <div className="alignment-card">
          <span className="pulse-dot" />
          <span>{alignment.label}</span>
        </div>
        <div className="mode-chip">
          {formatDetectorMode(detectorMode)} · {detectorMessage}
        </div>
        <div className="quality-meter" aria-label={`Face quality ${alignment.quality}%`}>
          <span style={{ width: `${alignment.quality}%` }} />
        </div>
      </div>
    </section>
  );
}

function AlignmentLandmarkOverlay({ alignment, features, width, height }) {
  if (!features || !width || !height) return null;
  const ovalPath = generateFaceOvalPath(features);
  const checks = [
    ['Centered', alignment.checks?.centered],
    ['Distance', alignment.checks?.distance],
    ['Eyes', alignment.checks?.eyes],
    ['Mouth + chin', alignment.checks?.mouthChin],
    ['Stable', alignment.checks?.stable],
  ];

  return (
    <svg className="landmark-overlay alignment-overlay" viewBox={`0 0 ${width} ${height}`}>
      <path className="face-oval-path" d={ovalPath} />
      <rect
        className="face-bounds-box"
        x={features.bounds.x}
        y={features.bounds.y}
        width={features.bounds.width}
        height={features.bounds.height}
        rx="18"
      />
      <circle className="nose-anchor" cx={features.face.noseCenter.x} cy={features.face.noseCenter.y} r="5" />
      <foreignObject x="18" y="62" width="170" height="190">
        <div className="alignment-checks">
          {checks.map(([label, isReady]) => (
            <div className={isReady ? 'ready' : ''} key={label}>
              <span />
              {label}
            </div>
          ))}
        </div>
      </foreignObject>
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
