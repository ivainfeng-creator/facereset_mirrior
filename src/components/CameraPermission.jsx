import { useState } from 'react';

export default function CameraPermission({
  cameraError,
  onCameraReady,
  onCameraError,
  onBack,
}) {
  const [cameraPhase, setCameraPhase] = useState('idle');
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

  if (cameraPhase === 'preparing') {
    return (
      <section className="screen preparing-landing">
        <main className="preparing-card" aria-live="polite" aria-label="Preparing camera">
          <span className="preparing-spinner" aria-hidden="true" />
          <p>Preparing...</p>
        </main>
      </section>
    );
  }

  return (
    <section className="screen intro-landing">
      <button className="intro-back-button" onClick={onBack} aria-label="Back to welcome" />

      <main className="intro-copy" aria-label="How Face Reset works">
        <div className="intro-heading">
          <h1>How it works?</h1>
          <p>Complete today's reset in three simple steps.</p>
        </div>

        <ol className="intro-steps">
          <li>📷 Align your face</li>
          <li>👇 Follow the guide</li>
          <li>😊 Relax and finish</li>
        </ol>
      </main>

      {cameraError && (
        <div className="intro-error">
          <p>{cameraError}</p>
        </div>
      )}

      <button className="journey-button" onClick={enableCamera} disabled={isPrompting}>
        <span>{isPrompting ? 'Waiting for permission' : 'Next'}</span>
        <span className="journey-arrow" aria-hidden="true" />
      </button>
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
