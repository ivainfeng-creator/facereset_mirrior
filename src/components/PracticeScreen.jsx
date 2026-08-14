import { getSceneById } from '../data/scenes.js';
import { RoutineScenePreview } from './RoutineScreen.jsx';

export default function PracticeScreen({ selectedScene, onBegin, onBack }) {
  const scene = getSceneById(selectedScene);
  const guide = scene.practice || {
    renderer: 'default',
    title: `How to Play ${scene.title}`,
    description: scene.subtitle,
    tips: ['Keep your face centered.', `Follow the ${scene.action.toLowerCase()} cue.`, 'Move gently and steadily.'],
    effectTitle: scene.title,
    effectDescription: scene.subtitle,
  };

  return (
    <section className={`screen practice-screen practice-screen-${guide.renderer}`}>
      <main className="practice-card" aria-label={`How to play ${scene.title}`}>
        <section className="practice-instructions" aria-label="How to play">
          <div className="practice-guide">
            <p className="practice-kicker">How to play</p>
            <h1>{scene.title}</h1>
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
            <button className="practice-back" onClick={onBack}>Back</button>
            <button className="practice-got-it" onClick={onBegin}>
              I&apos;m ready <span aria-hidden="true">→</span>
            </button>
          </div>
        </section>

        <div className="practice-stage" aria-label="Scene preview">
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
        </div>
      </main>
    </section>
  );
}
