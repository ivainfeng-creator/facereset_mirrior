import { useEffect, useRef } from 'react';
import { getSceneById } from '../data/scenes.js';
import { useFaceLandmarks } from '../hooks/useFaceLandmarks.js';
import { playSceneEffect } from '../utils/audioManager.js';
import { RoutineScenePreview } from './RoutineScreen.jsx';

const PRACTICE_BACK_EFFECT = Object.freeze({
  source: '/audio/Overall/Click-2.mp3',
  volume: 0.7,
});
const PRACTICE_BEGIN_EFFECT = Object.freeze({
  source: '/audio/Overall/Click-1.mp3',
  volume: 0.7,
});

export default function PracticeScreen({ selectedScene, stream, isDemoMode, onBegin, onBack }) {
  const scene = getSceneById(selectedScene);
  const stageRef = useRef(null);
  const trackingVideoRef = useRef(null);
  const { hasLandmarks } = useFaceLandmarks({
    videoRef: trackingVideoRef,
    stageRef,
    stream,
    isDemoMode,
  });
  const guide = scene.practice || {
    renderer: 'default',
    title: `How to Play ${scene.title}`,
    description: scene.subtitle,
    tips: ['Keep your face centered.', `Follow the ${scene.action.toLowerCase()} cue.`, 'Move gently and steadily.'],
    effectTitle: scene.title,
    effectDescription: scene.subtitle,
  };

  useEffect(() => {
    if (trackingVideoRef.current && stream) {
      trackingVideoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <section className={`screen practice-screen practice-screen-${guide.renderer}`}>
      <main className="practice-card" aria-label={`How to play ${scene.title}`}>
        <section className="practice-instructions" aria-label="How to play">
          <div className="practice-guide">
            <h1 className="frtitle">{scene.title}</h1>
            <p>{guide.description}</p>
          </div>
          <div className="practice-steps">
            <ol>
              {guide.tips.map((tip, index) => (
                <li key={tip} className={`practice-tip practice-tip-${index + 1}`}>
                  <span className="practice-step-number" aria-hidden="true">Step {index + 1}</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="practice-actions">
            <button
              className="practice-back"
              onClick={() => {
                playSceneEffect(PRACTICE_BACK_EFFECT);
                onBack();
              }}
            >
              Back
            </button>
            <button
              className="practice-got-it"
              onClick={() => {
                playSceneEffect(PRACTICE_BEGIN_EFFECT);
                onBegin();
              }}
            >
              I&apos;m ready <span aria-hidden="true">→</span>
            </button>
          </div>
        </section>

        <div className="practice-stage" ref={stageRef} aria-label="Scene preview">
          <video ref={trackingVideoRef} className="practice-tracking-video" autoPlay playsInline muted />
          <div className="practice-stage-toolbar" aria-hidden="true">
            <span className="practice-camera-status"><i />camera off</span>
            <span className="practice-stage-timer">0:30</span>
          </div>
          <div className="practice-stage-art" aria-hidden="true">
            <RoutineScenePreview selectedScene={scene.id} />
          </div>
          <div className="practice-stage-footer" aria-hidden="true">
            <strong>0</strong>
            <span><small>POINTS</small>{scene.title}</span>
          </div>
          <div
            className={`face-tracking-toast ${!isDemoMode && !hasLandmarks ? 'is-visible' : ''}`}
            aria-hidden={isDemoMode || hasLandmarks}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7.6v5.2" />
              <path d="M12 16.6h.01" />
            </svg>
            Face not detected. Move back into view.
          </div>
        </div>
      </main>
    </section>
  );
}
