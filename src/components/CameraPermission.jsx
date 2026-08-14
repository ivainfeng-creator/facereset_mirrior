import { useEffect, useRef, useState } from 'react';

export default function CameraPermission({
  autoStart = false,
  isOverlay = false,
  onCameraReady,
  onCameraError,
  onBack,
}) {
  const [cameraPhase, setCameraPhase] = useState('idle');
  const hasAutoStarted = useRef(false);
  const isPrompting = cameraPhase === 'prompting';

  const enableCamera = async () => {
    setCameraPhase('prompting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      const preparingStartedAt = performance.now();
      setCameraPhase('preparing');
      await waitForMinimumLoadingTime(preparingStartedAt, 620);
      onCameraReady(stream);
    } catch {
      setCameraPhase('idle');
      onCameraError('Camera permission is needed for the mirror experience. Please allow camera access and try again.');
    }
  };

  useEffect(() => {
    if (!autoStart || hasAutoStarted.current) {
      return;
    }

    hasAutoStarted.current = true;
    enableCamera();
  }, [autoStart]);

  if (autoStart || cameraPhase === 'prompting' || cameraPhase === 'preparing') {
    return (
      <section className={`screen preparing-landing ${isOverlay ? 'guide-flow-overlay' : ''}`}>
        <main className="preparing-card" aria-live="polite" aria-label="Preparing camera">
          <span className="preparing-spinner" aria-hidden="true" />
          <p>{cameraPhase === 'prompting' ? 'Allow camera access...' : 'Preparing...'}</p>
        </main>
      </section>
    );
  }

  return (
    <section className={`screen camera-permission-fallback ${isOverlay ? 'guide-flow-overlay' : ''}`}>
      <main className="camera-permission-card" aria-label="Camera permission">
        <button className="camera-close-button" onClick={onBack} aria-label="Close camera permission" />
        <span className="camera-permission-icon" aria-hidden="true">
          <svg viewBox="0 -960 960 960" focusable="false">
            <path d="M400-480Zm240 320H467q13-18 22.5-38t16.5-42h134v-480H160v131q-22 6-42 15.5T80-551v-169q0-33 23.5-56.5T160-800h480q33 0 56.5 23.5T720-720v180l160-160v440L720-420v180q0 33-23.5 56.5T640-160ZM98.5-178.5Q40-237 40-320t58.5-141.5Q157-520 240-520t141.5 58.5Q440-403 440-320t-58.5 141.5Q323-120 240-120T98.5-178.5ZM240-200q8 0 14-6t6-14q0-8-6-14t-14-6q-8 0-14 6t-6 14q0 8 6 14t14 6Zm-20-80h40v-160h-40v160Z" />
          </svg>
        </span>
        <div className="camera-permission-copy">
          <p className="camera-permission-kicker">ONE QUICK CHECK</p>
          <h1>TURN ON YOUR CAMERA</h1>
          <p>Allow camera access to start the game.</p>
        </div>

        <button className="camera-retry-button" onClick={onBack}>Got it</button>
      </main>
    </section>
  );
}

function waitForMinimumLoadingTime(startedAt, minimumMs) {
  const elapsed = performance.now() - startedAt;
  const remaining = Math.max(0, minimumMs - elapsed);
  return new Promise((resolve) => {
    window.setTimeout(resolve, remaining);
  });
}
