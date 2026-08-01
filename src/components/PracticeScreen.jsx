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
          <PracticeMascotGuide sceneId={scene.id} />
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

function PracticeMascotGuide({ sceneId }) {
  if (sceneId === SCENE_IDS.whaleDream || sceneId === SCENE_IDS.whaleDream2) {
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

  if (sceneId === SCENE_IDS.flowerCollector) {
    return (
      <div className="practice-mini-scene flower" aria-hidden="true">
        <span className="mini-bottle" />
        <span className="mini-scent-stream one" />
        <span className="mini-scent-stream two" />
        <span className="mini-practice-flower one" />
        <span className="mini-practice-flower two" />
        <span className="mini-practice-flower three" />
        <span className="mini-practice-flower four" />
      </div>
    );
  }

  if (sceneId === SCENE_IDS.bubbleGumBunny) {
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

  if (sceneId === SCENE_IDS.lemonSqueeze) {
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
      title: 'How to Play Whale Mouth',
      description: 'Open your mouth gently and hold it steady so little fish can swim into the whale.',
      tips: ['Keep your face centered.', 'Open your mouth gently and hold it steady.', 'Let the ocean scene react to your breath.'],
      effectTitle: 'Guide the fish',
      effectDescription: 'Open gently. Hold steady. Watch the ocean respond.',
    };
  }

  if (sceneId === SCENE_IDS.whaleDream2) {
    return {
      title: 'How to Play Whale Dream 2',
      description: 'Open your mouth gently and hold it steady so the pufferfish dream can wake up.',
      tips: ['Keep your face centered.', 'Open your mouth gently and hold it steady.', 'Let the ocean scene react to your breath.'],
      effectTitle: 'Wake the dream',
      effectDescription: 'Open gently. Hold steady. Watch the ocean come alive.',
    };
  }

  if (sceneId === SCENE_IDS.templeGarden) {
    return {
      title: 'How to Play Cloud Garden',
      description: 'Place both index fingers on your temples, then press and release slowly.',
      tips: ['Use both hands at the same time.', 'Keep both fingertips visible.', 'Gentle balanced pressure grows the garden.'],
      effectTitle: 'Let it rain',
      effectDescription: 'Press evenly and let the garden breathe.',
    };
  }

  if (sceneId === SCENE_IDS.flowerCollector) {
    return {
      title: 'How to Play Flower Collector',
      description: 'Wrinkle your nose like you are smelling a flower, then relax and repeat.',
      tips: ['Keep your face centered.', 'Scrunch your nose gently.', 'Each good inhale gathers more blossoms.'],
      effectTitle: 'Gather blossoms',
      effectDescription: 'Wrinkle gently and pull flowers toward you.',
    };
  }

  if (sceneId === SCENE_IDS.bubbleGumBunny) {
    return {
      title: 'How to Play Bubble Gum Bunny',
      description: 'Puff your cheeks, relax softly, then puff again to grow the bubble.',
      tips: ['Keep your lips closed.', 'Hold each puff for about two seconds.', 'Steady rhythm grows the biggest bubble.'],
      effectTitle: 'Grow the bubble',
      effectDescription: 'Puff softly and keep the bubble floating.',
    };
  }

  if (sceneId === SCENE_IDS.lemonSqueeze) {
    return {
      title: 'How to Play Lemon Squeeze',
      description: 'Place both index fingers beside your nose bridge, press inward gently, then release.',
      tips: ['Keep both fingertips visible.', 'Press both sides together.', 'Slow squeeze and release makes more soda.'],
      effectTitle: 'Make lemon soda',
      effectDescription: 'Squeeze evenly and fill the glass with bubbles.',
    };
  }

  return {
    title: 'How to Play Whale Mouth',
    description: 'Open your mouth gently and hold it steady so little fish can swim into the whale.',
    tips: ['Keep your face centered.', 'Open your mouth gently and hold it steady.', 'Let the ocean scene react to your breath.'],
    effectTitle: 'Guide the fish',
    effectDescription: 'Open gently. Hold steady. Watch the ocean respond.',
  };
}
