import { dailyScenes } from '../data/scenes.js';
import { buildDailyPlanSummary, getCompletedProgramDays } from '../utils/dailyPlan.js';

export default function ThemeScreen({
  habit,
  selectedScene,
  onSelect,
  onContinue,
  isEntering = false,
}) {
  const todayScenes = dailyScenes;
  const dailyPlan = buildDailyPlanSummary(habit);
  const completedScenes = new Set(
    dailyPlan.sceneResults.filter((entry) => entry.completed).map((entry) => entry.sceneId),
  );
  const todayBestScores = new Map(
    dailyPlan.sceneResults.map((entry) => [entry.sceneId, entry.score]),
  );
  const completedCount = dailyPlan.completed;
  const activeIndex = todayScenes.findIndex((scene) => !completedScenes.has(scene.id));
  const currentDay = Math.min(7, Math.max(1, dailyPlan.programDay || 1));
  const completedProgramDays = getCompletedProgramDays(habit);
  const isAllDone = completedCount >= todayScenes.length;

  return (
    <section className={`screen theme-screen today-plan-screen challenge-v3-screen ${isEntering ? 'is-paper-entering' : ''}`}>
      <main className="challenge-v3-shell" aria-label="Today’s Face Reset challenge">
        <header className="challenge-v3-hero">
          <h1>Face Reset Challenge</h1>
        </header>

        <div className="challenge-v3-days" aria-label={`Program day ${currentDay}`}>
          {Array.from({ length: 7 }, (_, index) => {
            const day = index + 1;
            const isCurrent = day === currentDay;
            const isComplete = completedProgramDays.has(day);
            return (
              <span
                key={day}
                className={`challenge-v3-day ${isCurrent ? 'is-current' : ''} ${isComplete ? 'is-past' : ''}`}
              >
                {isCurrent ? `DAY ${day}` : day}
                {isComplete && <i aria-hidden="true">✓</i>}
              </span>
            );
          })}
        </div>

        <section className="challenge-v3-plan" aria-label="Today’s focus">
          <div className="challenge-v3-plan-header">
            <div>
              <p>TODAY’S FOCUS</p>
              <h2>FACIAL WARM-UP</h2>
            </div>
            <div
              className="challenge-v3-progress"
              aria-label={`${completedCount} of ${todayScenes.length} complete`}
            >
              <span className="challenge-v3-progress-rail">
                <span
                  className="challenge-v3-progress-fill"
                  style={{ width: `${(completedCount / todayScenes.length) * 100}%` }}
                />
              </span>
              <strong>{completedCount} / {todayScenes.length}</strong>
            </div>
          </div>

          <div className="challenge-v3-sessions">
            {todayScenes.map((scene, index) => {
              const isDone = completedScenes.has(scene.id);
              const isActive = activeIndex === index;
              const isLocked = activeIndex !== -1 && index > activeIndex;
              const canStart = isDone || (!isLocked && !isAllDone);
              const bestScore = todayBestScores.get(scene.id) || 0;
              const rowClassName = [
                'challenge-v3-session',
                selectedScene === scene.id ? 'is-selected' : '',
                isDone ? 'is-done' : '',
                isActive ? 'is-active' : '',
                isLocked ? 'is-locked' : '',
              ].filter(Boolean).join(' ');

              return (
                <button
                  key={scene.id}
                  className={rowClassName}
                  type="button"
                  onClick={() => canStart && onSelect(scene.id)}
                  disabled={!canStart}
                  aria-label={isDone
                    ? `Replay ${scene.title}. Today's best score ${bestScore}`
                    : undefined}
                >
                  <span className="challenge-v3-art-wrap">
                    <img src={scene.planArt} alt="" className="challenge-v3-art" />
                  </span>

                  <span className="challenge-v3-session-copy">
                    {isActive && !isDone && <small>START HERE</small>}
                    <strong>{scene.title}</strong>
                    <span>30 sec · {scene.planPhase}</span>
                  </span>

                  {isActive && !isDone && <span className="challenge-v3-start-hint">Tap to start</span>}
                  {isDone && (
                    <span className="challenge-v3-done-actions">
                      <span className="challenge-v3-done">DONE | {bestScore}</span>
                      <span className="challenge-v3-replay" aria-hidden="true">↻</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {isAllDone && (
            <div className="challenge-v3-complete" role="status">
              <p>TODAY’S RESET COMPLETE</p>
              <button className="challenge-v3-continue" type="button" onClick={onContinue}>
                CONTINUE
              </button>
            </div>
          )}
        </section>
      </main>
    </section>
  );
}
