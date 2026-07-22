import { useEffect, useRef } from 'react';
import { MirrorVideo } from './MirrorScreen.jsx';

export default function PracticeScreen({ stream, isDemoMode, onBegin, onBack }) {
  const previewVideoRef = useRef(null);

  useEffect(() => {
    if (previewVideoRef.current && stream) {
      previewVideoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <section className="screen practice-screen">
      <main className="practice-card" aria-label="Gesture practice">
        <button className="scan-close-button practice-close-button" onClick={onBack} aria-label="Back to alignment" />

        <div className="practice-preview" aria-label="Front camera preview">
          {isDemoMode || !stream ? (
            <MirrorVideo videoRef={previewVideoRef} isDemoMode />
          ) : (
            <video ref={previewVideoRef} className="practice-preview-video" autoPlay playsInline muted />
          )}
        </div>

        <div className="practice-guide">
          <p className="practice-kicker">Gesture control</p>
          <h1>Practice the eye wiper</h1>
          <p>Place your index finger under your eye, then glide outward slowly.</p>
          <PracticeMascotGuide />
          <ul>
            <li>Keep your finger soft and visible.</li>
            <li>Move left and right like a gentle wiper.</li>
            <li>Slow motion scores better than speed.</li>
          </ul>
        </div>

        <button className="practice-got-it" onClick={onBegin}>
          Got it
        </button>
      </main>
    </section>
  );
}

function PracticeMascotGuide() {
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
