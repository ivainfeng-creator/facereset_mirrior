import { useEffect, useRef } from 'react';
import { getSceneById } from '../data/scenes.js';
import { useFaceLandmarks } from '../hooks/useFaceLandmarks.js';
import { playSceneEffect } from '../utils/audioManager.js';
import { CameraPreview, RoutineScenePreview } from './RoutineScreen.jsx';
import { useI18n } from '../i18n/context.js';

const PRACTICE_BACK_EFFECT = Object.freeze({
  source: '/audio/Overall/Click-2.mp3',
  volume: 0.7,
});
const PRACTICE_BEGIN_EFFECT = Object.freeze({
  source: '/audio/Overall/Click-1.mp3',
  volume: 0.7,
});

export default function PracticeScreen({ selectedScene, stream, isDemoMode, onBegin, onBack }) {
  const { t } = useI18n();
  const scene = getSceneById(selectedScene);
  const stageRef = useRef(null);
  const trackingVideoRef = useRef(null);
  const { detectorMode } = useFaceLandmarks({
    videoRef: trackingVideoRef,
    stageRef,
    stream,
    isDemoMode,
  });
  const cameraTrack = stream?.getVideoTracks()[0];
  const isCameraUnavailable = (
    !stream
    || !stream.active
    || !cameraTrack
    || !cameraTrack.enabled
    || cameraTrack.readyState !== 'live'
  );
  const sceneTitle = t(`scenes.${scene.id}.title`);
  // Guide copy is keyed by the canonical scene ID; `scene.practice` still owns
  // the renderer, which is a layout concern rather than copy.
  const guide = {
    renderer: scene.practice?.renderer || 'default',
    description: t(`scenes.${scene.id}.description`),
    tips: t(`scenes.${scene.id}.tips`),
  };

  useEffect(() => {
    if (trackingVideoRef.current && stream) {
      trackingVideoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <section className={`screen practice-screen practice-screen-${guide.renderer}`}>
      <main className="practice-card" aria-label={t('practice.cardAria', { scene: sceneTitle })}>
        <section className="practice-instructions" aria-label={t('practice.instructionsAria')}>
          <div className="practice-guide">
            <h1 className="frtitle">{sceneTitle}</h1>
            <p>{guide.description}</p>
          </div>
          <div className="practice-steps">
            <ol>
              {guide.tips.map((tip, index) => (
                <li key={tip} className={`practice-tip practice-tip-${index + 1}`}>
                  <span className="practice-step-number" aria-hidden="true">{t('practice.step', { index: index + 1 })}</span>
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
              {t('practice.back')}
            </button>
            <button
              className="practice-got-it"
              onClick={() => {
                playSceneEffect(PRACTICE_BEGIN_EFFECT);
                onBegin();
              }}
            >
              {t('practice.ready')}
              <span aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" height="19.2px" width="19.2px" viewBox="0 -960 960 960" fill="currentColor"><path d="M647-440H160v-80h487L423-744l57-56 320 320-320 320-57-56 224-224Z" /></svg>
              </span>
            </button>
          </div>
        </section>

        <div className="practice-stage" ref={stageRef} aria-label={t('practice.stageAria')}>
          <CameraPreview
            compact
            detectorMode={detectorMode}
            handMode={detectorMode}
            isDemoMode={isDemoMode}
            isCameraUnavailable={isCameraUnavailable}
            previewVideoRef={trackingVideoRef}
          />
          <div className="practice-stage-art" aria-hidden="true">
            <RoutineScenePreview selectedScene={scene.id} />
          </div>
        </div>
      </main>
    </section>
  );
}
