import { useEffect, useRef } from 'react';
import { getSceneById } from '../data/scenes.js';
import { MirrorVideo } from './MirrorScreen.jsx';

export default function PracticeScreen({ selectedScene, stream, isDemoMode, onBegin, onBack }) {
  const previewVideoRef = useRef(null);
  const scene = getSceneById(selectedScene);
  const guide = scene.practice || {
    renderer: 'default',
    title: `How to Play ${scene.title}`,
    description: scene.subtitle,
    tips: ['Keep your face centered.', `Follow the ${scene.action.toLowerCase()} cue.`, 'Move gently and steadily.'],
    effectTitle: scene.title,
    effectDescription: scene.subtitle,
  };

  useEffect(() => {
    if (previewVideoRef.current && stream) {
      previewVideoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <section className="screen practice-screen">
      <main className="practice-card" aria-label="How to play">
        <button className="scan-close-button practice-close-button" onClick={onBack} aria-label="Back to alignment" />

        <div className="practice-preview" aria-label="Front camera preview">
          {isDemoMode || !stream ? (
            <MirrorVideo videoRef={previewVideoRef} isDemoMode />
          ) : (
            <video ref={previewVideoRef} className="practice-preview-video" autoPlay playsInline muted />
          )}
          <span className="practice-camera-pill" aria-hidden="true">
            <span />
            Camera
          </span>
          <div className="practice-preview-hint">
            <span aria-hidden="true" />
            Keep your face centered
          </div>
        </div>

        <div className="practice-guide">
          <p className="practice-kicker">Camera check · How to play</p>
          <h1>{guide.title}</h1>
          <p>{guide.description}</p>
        </div>

        <div className="practice-steps">
          <div className="practice-steps-heading">
            <span aria-hidden="true" />
            <strong>How to do it</strong>
          </div>
          <ul>
            {guide.tips.map((tip, index) => (
              <li key={tip} className={`practice-tip practice-tip-${index + 1}`}>
                <span className="practice-tip-icon" aria-hidden="true" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        <aside className="practice-effect-panel" aria-label="Scene reaction preview">
          <PracticeMascotGuide renderer={guide.renderer} />
          <div className="practice-effect-copy">
            <strong>{guide.effectTitle}</strong>
            <p>{guide.effectDescription}</p>
          </div>
        </aside>

        <button className="practice-got-it" onClick={onBegin}>
          Start
        </button>
      </main>
    </section>
  );
}

const PRACTICE_MASCOTS = {
  whale: WhalePracticeMascot,
  cloud: CloudPracticeMascot,
  popcorn: PopcornPracticeMascot,
  bunny: BunnyPracticeMascot,
  lemon: LemonPracticeMascot,
};

function PracticeMascotGuide({ renderer }) {
  const Mascot = PRACTICE_MASCOTS[renderer] || DefaultPracticeMascot;
  return <Mascot />;
}

function WhalePracticeMascot() {
  return (
    <div className="practice-mini-scene whale" aria-hidden="true">
      <span className="mini-whale" />
      <span className="mini-fish one" />
      <span className="mini-fish two" />
      <span className="mini-fish three" />
    </div>
  );
}

function CloudPracticeMascot() {
  return (
    <div className="practice-mini-scene cloud" aria-hidden="true">
      <span className="mini-cloud left" />
      <span className="mini-cloud right" />
      <span className="mini-rain left" />
      <span className="mini-rain right" />
      <span className="mini-garden" />
    </div>
  );
}

function PopcornPracticeMascot() {
  return (
    <div className="practice-mini-scene popcorn" aria-hidden="true">
      <span className="mini-popcorn-bucket" />
      <span className="mini-popcorn one" />
      <span className="mini-popcorn two" />
      <span className="mini-popcorn three" />
      <span className="mini-popcorn four" />
    </div>
  );
}

function BunnyPracticeMascot() {
  return (
    <div className="practice-mini-scene bunny" aria-hidden="true">
      <span className="mini-bunny-ear left" />
      <span className="mini-bunny-ear right" />
      <span className="mini-bunny-face" />
      <span className="mini-bunny-bubble" />
      <span className="mini-bunny-sparkle one" />
      <span className="mini-bunny-sparkle two" />
      <span className="mini-bunny-sparkle three" />
    </div>
  );
}

function LemonPracticeMascot() {
  return (
    <div className="practice-mini-scene lemon" aria-hidden="true">
      <span className="mini-lemon-half left" />
      <span className="mini-lemon-half right" />
      <span className="mini-lemon-drop one" />
      <span className="mini-lemon-drop two" />
      <span className="mini-lemon-glass" />
      <span className="mini-lemon-bubble one" />
      <span className="mini-lemon-bubble two" />
      <span className="mini-mint-leaf" />
    </div>
  );
}

function DefaultPracticeMascot() {
  return (
    <div className="practice-mascot" aria-hidden="true">
      <img src="/assets/practice-mascot.png" alt="" />
      <span className="mascot-glide left" />
      <span className="mascot-glide right" />
      <svg className="mascot-motion-lines" viewBox="0 0 240 210">
        <path className="mascot-motion-path left" d="M48 102 C68 84 88 82 106 96" />
        <path className="mascot-motion-path right" d="M192 102 C172 84 152 82 134 96" />
      </svg>
    </div>
  );
}
