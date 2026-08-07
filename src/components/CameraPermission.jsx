import { useEffect, useRef, useState } from 'react';

export default function CameraPermission({
  cameraError,
  autoStart = false,
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
      <section className="screen preparing-landing">
        <main className="preparing-card" aria-live="polite" aria-label="Preparing camera">
          <span className="preparing-spinner" aria-hidden="true" />
          <p>{cameraPhase === 'prompting' ? 'Allow camera access...' : 'Preparing...'}</p>
        </main>
      </section>
    );
  }

  return (
    <section className="screen camera-permission-fallback">
      <button className="intro-back-button" onClick={onBack} aria-label="Back to today plan" />

      <main className="camera-permission-card" aria-label="Camera permission">
        <div className="camera-permission-copy">
          <h1>Camera access needed</h1>
          <p>{cameraError || 'Please allow camera access to continue Face Reset.'}</p>
        </div>

        <button className="camera-retry-button" onClick={enableCamera} disabled={isPrompting}>
          {isPrompting ? 'Waiting for permission' : 'Try again'}
        </button>
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
