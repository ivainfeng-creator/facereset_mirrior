import { useLayoutEffect, useRef } from 'react';
import { getSceneById } from '../data/scenes.js';
import { playSceneEffect } from '../utils/audioManager.js';

const SESSION_SELECT_EFFECT = Object.freeze({
  source: '/audio/Overall/Click-1.mp3',
  volume: 0.7,
});
const HISTORY_CLOSE_EFFECT = Object.freeze({
  source: '/audio/Overall/Click-2.mp3',
  volume: 0.7,
});

export default function TodayPlanCard({
  sceneResults,
  programDay,
  selectedScene,
  preparingSceneId = null,
  onStart,
  onSessionSelect,
  showCompletion = false,
  newlyCompletedSceneId = null,
  onCompletionStampAnimationEnd,
  onViewHistory,
  isHistoryOpen = false,
  shouldAnimateCompletionFlow = false,
  className = '',
  isReadOnly = false,
  focusLabel = 'TODAY\'S FOCUS',
}) {
  const historyButtonRef = useRef(null);
  const previousHistoryWidthRef = useRef(null);
  const previousHistoryOpenRef = useRef(isHistoryOpen);
  const dailyScenes = sceneResults.map((result) => getSceneById(result.sceneId));
  const resultsBySceneId = new Map(sceneResults.map((result) => [result.sceneId, result]));
  const completedScenes = new Set(
    sceneResults.filter((result) => result.completed).map((result) => result.sceneId),
  );
  const completedCount = completedScenes.size;
  const activeIndex = dailyScenes.findIndex((scene) => !completedScenes.has(scene.id));
  const isAllDone = completedCount >= dailyScenes.length;

  const toggleHistory = () => {
    playSceneEffect(isHistoryOpen ? HISTORY_CLOSE_EFFECT : SESSION_SELECT_EFFECT);
    onViewHistory?.();
  };

  useLayoutEffect(() => {
    const button = historyButtonRef.current;
    if (!button) return undefined;

    const nextWidth = button.getBoundingClientRect().width;
    const previousWidth = previousHistoryWidthRef.current;
    const didHistoryStateChange = previousHistoryOpenRef.current !== isHistoryOpen;
    previousHistoryOpenRef.current = isHistoryOpen;
    previousHistoryWidthRef.current = nextWidth;

    if (!didHistoryStateChange || !previousWidth) return undefined;

    button.style.width = `${previousWidth}px`;
    void button.offsetWidth;
    const animationFrame = window.requestAnimationFrame(() => {
      button.style.width = `${nextWidth}px`;
    });
    const clearWidth = (event) => {
      if (event.propertyName === 'width') button.style.width = '';
    };
    button.addEventListener('transitionend', clearWidth);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      button.removeEventListener('transitionend', clearWidth);
    };
  }, [isHistoryOpen]);

  return (
    <section className={`challenge-v3-plan ${className}`.trim()} aria-label={focusLabel}>
      <div className="challenge-v3-plan-header">
        <div>
          <p>{focusLabel}</p>
          <h2>FACIAL WARM-UP</h2>
        </div>
        <div className="challenge-v3-progress" aria-label={`${completedCount} of ${dailyScenes.length} complete`}>
          <span className="challenge-v3-progress-rail">
            <span
              className="challenge-v3-progress-fill"
              style={{ width: `${(completedCount / dailyScenes.length) * 100}%` }}
            />
          </span>
          <strong>{completedCount} / {dailyScenes.length}</strong>
        </div>
      </div>

      <div className="challenge-v3-sessions">
        {dailyScenes.map((scene, index) => {
          const result = resultsBySceneId.get(scene.id);
          const isDone = completedScenes.has(scene.id);
          const isActive = activeIndex === index;
          const isLocked = !isAllDone && activeIndex !== -1 && index > activeIndex;
          const isPreparing = preparingSceneId === scene.id;
          const isNewlyCompleted = newlyCompletedSceneId === scene.id;
          const canSelect = !isReadOnly && Boolean(onSessionSelect) && (isDone || isActive);
          const rowClassName = [
            'challenge-v3-session',
            selectedScene === scene.id ? 'is-selected' : '',
            isDone ? 'is-done' : '',
            isActive ? 'is-active' : '',
            isLocked ? 'is-locked' : '',
            isPreparing ? 'is-preparing' : '',
            isNewlyCompleted ? 'is-newly-completed' : '',
          ].filter(Boolean).join(' ');

          return (
            <button
              key={scene.id}
              className={rowClassName}
              type="button"
              onClick={() => {
                if (!canSelect) return;
                playSceneEffect(SESSION_SELECT_EFFECT);
                onSessionSelect(scene.id);
              }}
              disabled={!canSelect || Boolean(preparingSceneId)}
              aria-label={isDone
                ? `${isReadOnly ? 'Completed' : 'Replay'} ${scene.title}. Best score ${result?.score || 0}`
                : undefined}
            >
              <span className="challenge-v3-art-wrap">
                <img src={scene.planArt} alt="" className="challenge-v3-art" />
                {isLocked && <span className="challenge-v3-art-disabled-overlay" aria-hidden="true" />}
                {isPreparing && <span className="challenge-v3-preparing-spinner" aria-hidden="true" />}
              </span>

              <span className="challenge-v3-session-copy">
                <small>SESSION {index + 1}</small>
                <strong>{scene.title}</strong>
                <span>30 sec · {scene.planPhase}</span>
              </span>

              {isDone && (
                <span className="challenge-v3-done-actions">
                  <span
                    className="challenge-v3-done"
                    onAnimationEnd={isNewlyCompleted ? onCompletionStampAnimationEnd : undefined}
                  >
                    DONE | {result?.score || 0}
                  </span>
                  <span className="challenge-v3-replay" aria-hidden="true">↻</span>
                </span>
              )}
              {!isDone && <span className="challenge-v3-arrow" aria-hidden="true">→</span>}
            </button>
          );
        })}
      </div>

      {!isAllDone && activeIndex >= 0 && onStart && (
        <button
          className="challenge-v3-start"
          type="button"
          onClick={() => {
            if (preparingSceneId) return;
            playSceneEffect(SESSION_SELECT_EFFECT);
            onStart(dailyScenes[activeIndex].id);
          }}
          disabled={Boolean(preparingSceneId)}
        >
          {preparingSceneId ? (
            <span className="challenge-v3-start-preparing">
              Preparing<span>.</span><span>.</span><span>.</span>
            </span>
          ) : (completedCount ? 'Continue' : 'Start')}
        </button>
      )}

      {isAllDone && showCompletion && (
        <>
          <div className="challenge-v3-day-complete-banner" role="status">
            <span className="challenge-v3-banner-sheen" aria-hidden="true" />
            <div className="challenge-v3-banner-copy">
              <strong>Day {programDay} Complete</strong>
              <span>Come back on your next active day for Day {programDay + 1}</span>
            </div>
            <div className="challenge-v3-banner-calendar" aria-hidden="true">
              <i className="challenge-v3-banner-confetti-one" />
              <i className="challenge-v3-banner-confetti-two" />
              <i className="challenge-v3-banner-confetti-three" />
              <div>
                <span>DAY</span>
                <b>{programDay + 1}</b>
              </div>
            </div>
          </div>
          {onViewHistory && (
            <button
              ref={historyButtonRef}
              className={`history-fab${isHistoryOpen ? ' is-active' : ''}${shouldAnimateCompletionFlow ? ' is-completion-entering' : ''}`}
              type="button"
              aria-label={isHistoryOpen ? 'Close history' : 'View history'}
              aria-expanded={isHistoryOpen}
              onClick={toggleHistory}
            >
              {isHistoryOpen ? <CloseIcon /> : <HistoryIcon />}
              <span>{isHistoryOpen ? 'Close' : 'View history'}</span>
            </button>
          )}
        </>
      )}
    </section>
  );
}

function HistoryIcon() {
  return (
    <svg className="history-profile-icon" aria-hidden="true" viewBox="0 -960 960 960">
      <path d="m489-460 91-55 91 55-24-104 80-69-105-9-42-98-42 98-105 9 80 69-24 104Zm19 260h224q-7 26-24 42t-44 20L228-85q-33 5-59.5-15.5T138-154L85-591q-4-33 16-59t53-30l46-6v80l-36 5 54 437 290-36Zm-148-80q-33 0-56.5-23.5T280-360v-440q0-33 23.5-56.5T360-880h440q33 0 56.5 23.5T880-800v440q0 33-23.5 56.5T800-280H360Zm0-80h440v-440H360v440Zm220-220ZM218-164Z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </svg>
  );
}