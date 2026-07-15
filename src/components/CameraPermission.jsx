import { useState } from 'react';

export default function CameraPermission({
  cameraError,
  onCameraReady,
  onCameraError,
  onDemoMode,
  onBack,
}) {
  const [isRequesting, setIsRequesting] = useState(false);

  const enableCamera = async () => {
    setIsRequesting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      onCameraReady(stream);
    } catch {
      onCameraError('Camera permission is needed for the mirror experience. You can still try demo mode.');
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <section className="screen centered-screen">
      <div className="permission-card">
        <button className="ghost-button top-left" onClick={onBack} aria-label="Back">
          <span className="button-icon back-icon" aria-hidden="true" />
        </button>
        <div className="permission-icon">
          <span className="button-icon camera-icon" aria-hidden="true" />
        </div>
        <p className="eyebrow">Local mirror mode</p>
        <h1>Enable your camera to start the AI Mirror experience.</h1>
        <p>
          This demo processes everything locally and does not upload your video. If camera access is not available,
          Demo Mode keeps the full guided routine working.
        </p>

        {cameraError && <div className="error-banner">{cameraError}</div>}

        <div className="button-row">
          <button className="primary-button" onClick={enableCamera} disabled={isRequesting}>
            <span className="button-icon camera-icon" aria-hidden="true" />
            {isRequesting ? 'Opening Camera...' : 'Enable Camera'}
          </button>
          <button className="secondary-button" onClick={onDemoMode}>
            Try Demo Mode
          </button>
        </div>
      </div>
    </section>
  );
}
