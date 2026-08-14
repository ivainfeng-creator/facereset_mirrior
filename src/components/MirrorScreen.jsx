import { useEffect, useRef, useState } from 'react';
import { useFaceLandmarks } from '../hooks/useFaceLandmarks.js';

export default function MirrorScreen({ stream, isDemoMode, onBegin, onBack, isOverlay = false }) {
  const videoRef = useRef(null);
  const stageRef = useRef(null);
  const alignmentRef = useRef(null);
  const featuresRef = useRef(null);
  const completedRef = useRef(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [isScanComplete, setIsScanComplete] = useState(false);

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
    alignmentRef.current = alignment;
    featuresRef.current = features;
  }, [alignment, features]);

  useEffect(() => {
    let lastTick = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const elapsed = Math.min(180, now - lastTick);
      lastTick = now;

      const currentAlignment = alignmentRef.current;
      const currentFeatures = featuresRef.current;

      setScanProgress((current) => {
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
          <div className="scan-face-frame" ref={stageRef}>
            <MirrorVideo videoRef={videoRef} isDemoMode={isDemoMode} />
            <div className="scan-face-tint" style={{ '--scan-progress': scanProgress }} />
          </div>
          <ScanProgressRing progress={scanProgress} />
        </div>

        <button
          className={`scan-primary-action ${isScanComplete ? 'is-complete' : ''}`}
          type="button"
          disabled={!isScanComplete}
          onClick={onBegin}
        >
          {isScanComplete ? 'Next' : (
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

export function MirrorVideo({ videoRef, isDemoMode }) {
  if (isDemoMode) {
    return <div className="demo-mirror" />;
  }

  return <video ref={videoRef} className="mirror-video" autoPlay playsInline muted />;
}
