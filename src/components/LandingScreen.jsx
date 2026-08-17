import { useEffect, useState } from 'react';

const LANDING_MASCOTS = [
  { placement: 'main', pose: 'openmouth', label: 'Open mouth' },
  { placement: 'left', pose: 'relax', label: 'Relax' },
  { placement: 'right', pose: 'blow', label: 'Blow' },
];

const MASCOT_FRAME_TIMING = {
  main: { frameOneMs: 4600, frameTwoMs: 780, startDelayMs: 1500 },
  left: { frameOneMs: 3800, frameTwoMs: 620, startDelayMs: 700 },
  right: { frameOneMs: 4200, frameTwoMs: 680, startDelayMs: 2300 },
};

function LandingMascot({ placement, pose, label }) {
  const assetBase = `/assets/landing/bluecloud_${pose}`;
  const [frame, setFrame] = useState(1);

  useEffect(() => {
    const timing = MASCOT_FRAME_TIMING[placement];
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;

    let timeout;
    const scheduleFrameTwo = (delay) => {
      timeout = window.setTimeout(() => {
        setFrame(2);
        timeout = window.setTimeout(() => {
          setFrame(1);
          scheduleFrameTwo(timing.frameOneMs);
        }, timing.frameTwoMs);
      }, delay);
    };

    scheduleFrameTwo(timing.startDelayMs);
    return () => window.clearTimeout(timeout);
  }, [placement]);

  return (
    <div className={`welcome-v3-sticker welcome-v3-sticker-${placement}`}>
      <div className="welcome-v3-sticker-motion">
        <div className="welcome-v3-sticker-surface">
          <img className="welcome-v3-mascot-frame" src={`${assetBase}_${frame}.png`} alt={label} />
        </div>
      </div>
    </div>
  );
}

export default function LandingScreen({ onStart, onInteract, isExiting = false }) {
  return (
    <section
      className={`screen landing-screen welcome-v3 ${isExiting ? 'is-paper-under' : ''}`}
      onPointerDown={onInteract}
    >
      <main className="welcome-v3-stage" aria-label="Face Reset introduction">
        <header className="welcome-v3-heading">
          <h1>
            FACE
            <br />
            RESET
          </h1>
          <p>Small exercises. Big face relief.</p>
        </header>

        <div className="welcome-v3-mascots" aria-hidden="true">
          {LANDING_MASCOTS.map((mascot) => <LandingMascot key={mascot.placement} {...mascot} />)}
          <img
            className="welcome-v3-sparkle"
            src="/assets/landing/yellow_star.png"
            alt=""
          />
          <div className="welcome-v3-badge">
            3 sessions A DAY
          </div>
        </div>

        <button className="welcome-v3-start" onClick={onStart} disabled={isExiting}>
          Let's go
        </button>
      </main>
    </section>
  );
}
