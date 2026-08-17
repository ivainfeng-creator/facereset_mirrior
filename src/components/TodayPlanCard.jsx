import { dailyScenes } from '../data/scenes.js';

export default function TodayPlanCard({
  sceneResults,
  programDay,
  selectedScene,
  preparingSceneId = null,
  onStart,
  onSessionSelect,
  showCompletion = false,
  onViewResult,
  isHistory = false,
  className = '',
}) {
  const resultsBySceneId = new Map(sceneResults.map((result) => [result.sceneId, result]));
  const completedScenes = new Set(
    sceneResults.filter((result) => result.completed).map((result) => result.sceneId),
  );
  const completedCount = completedScenes.size;
  const activeIndex = dailyScenes.findIndex((scene) => !completedScenes.has(scene.id));
  const isAllDone = completedCount >= dailyScenes.length;

  return (
    <section className={`challenge-v3-plan ${isHistory ? 'is-history' : ''} ${className}`.trim()} aria-label={isHistory ? `Program Day ${programDay} history` : 'Today’s focus'}>
      <div className="challenge-v3-plan-header">
        <div>
          <p>{isHistory ? `DAY ${programDay} HISTORY` : 'TODAY’S FOCUS'}</p>
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
          const canSelect = !isHistory && Boolean(onSessionSelect) && (isDone || isActive);
          const rowClassName = [
            'challenge-v3-session',
            selectedScene === scene.id ? 'is-selected' : '',
            isDone ? 'is-done' : '',
            isActive ? 'is-active' : '',
            isLocked ? 'is-locked' : '',
            isPreparing ? 'is-preparing' : '',
          ].filter(Boolean).join(' ');

          return (
            <button
              key={scene.id}
              className={rowClassName}
              type="button"
              onClick={() => canSelect && onSessionSelect(scene.id)}
              disabled={!canSelect || Boolean(preparingSceneId)}
              aria-label={isDone ? `${isHistory ? 'Completed' : 'Replay'} ${scene.title}. Score ${result?.score || 0}` : undefined}
            >
              <span className="challenge-v3-art-wrap">
                <img src={scene.planArt} alt="" className="challenge-v3-art" />
                {isLocked && <span className="challenge-v3-art-disabled-overlay" aria-hidden="true" />}
                {isPreparing && <span className="challenge-v3-preparing-spinner" aria-hidden="true" />}
              </span>

              <span className="challenge-v3-session-copy">
                {isActive && !isDone && <small>SESSION {index + 1}</small>}
                <strong>{scene.title}</strong>
                <span>30 sec · {scene.planPhase}</span>
              </span>

              {isDone && (
                <span className="challenge-v3-done-actions">
                  <span className="challenge-v3-done">DONE | {result?.score || 0}</span>
                  {!isHistory && <span className="challenge-v3-replay" aria-hidden="true">↻</span>}
                </span>
              )}
              {!isDone && !isHistory && <span className="challenge-v3-arrow" aria-hidden="true">→</span>}
            </button>
          );
        })}
      </div>

      {!isAllDone && activeIndex >= 0 && onStart && (
        <button
          className="challenge-v3-start"
          type="button"
          onClick={() => onStart(dailyScenes[activeIndex].id)}
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
        <button
          className={`challenge-v3-day-complete-banner ${onViewResult ? 'is-clickable' : ''}`}
          type="button"
          onClick={onViewResult}
          disabled={!onViewResult}
          aria-label={onViewResult ? `View Program Day ${programDay} result` : undefined}
        >
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
          {onViewResult && <span className="challenge-v3-banner-chevron" aria-hidden="true">→</span>}
        </button>
      )}
    </section>
  );
}
