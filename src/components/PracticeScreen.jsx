import { useEffect, useRef } from 'react';
import { SCENE_IDS, getSceneById } from '../data/scenes.js';
import { MirrorVideo } from './MirrorScreen.jsx';

export default function PracticeScreen({ selectedScene, stream, isDemoMode, onBegin, onBack }) {
  const previewVideoRef = useRef(null);
  const scene = getSceneById(selectedScene);
  const guide = getPracticeGuide(scene.id);

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
          <h1>{guide.title}</h1>
          <p>{guide.description}</p>
          <PracticeMascotGuide sceneId={scene.id} />
          <ul>
            {guide.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>

        <button className="practice-got-it" onClick={onBegin}>
          Got it
        </button>
      </main>
    </section>
  );
}

function PracticeMascotGuide({ sceneId }) {
  if (sceneId === SCENE_IDS.whaleDream) {
    return (
      <div className="practice-mini-scene whale" aria-hidden="true">
        <span className="mini-whale" />
        <span className="mini-fish one" />
        <span className="mini-fish two" />
        <span className="mini-fish three" />
      </div>
    );
  }

  if (sceneId === SCENE_IDS.templeGarden) {
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

function getPracticeGuide(sceneId) {
  if (sceneId === SCENE_IDS.whaleDream) {
    return {
      title: 'Practice Whale Dream',
      description: 'Open your mouth gently and hold it steady so the whale can release little fish.',
      tips: ['Keep your face centered.', 'Open wide without rushing.', 'A steady breath creates better flow.'],
    };
  }

  if (sceneId === SCENE_IDS.templeGarden) {
    return {
      title: 'Practice Cloud Garden',
      description: 'Place both index fingers on your temples, then press and release slowly.',
      tips: ['Use both hands at the same time.', 'Keep both fingertips visible.', 'Gentle balanced pressure grows the garden.'],
    };
  }

  return {
    title: 'Practice Rain Wiper',
    description: 'Place your index finger under your eye, then glide outward slowly.',
    tips: ['Keep your finger soft and visible.', 'Move left and right like a gentle wiper.', 'Slow motion scores better than speed.'],
  };
}
