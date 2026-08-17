import { useEffect, useRef, useState } from 'react';
import TodayPlanCard from './TodayPlanCard.jsx';
import { buildDailyPlanSummary, getCompletedProgramDays } from '../utils/dailyPlan.js';

export default function ThemeScreen({
  habit,
  selectedScene,
  onSelect,
  onViewResult,
  isEntering = false,
}) {
  const [preparingSceneId, setPreparingSceneId] = useState(null);
  const preparingTimerRef = useRef(null);
  const dailyPlan = buildDailyPlanSummary(habit);
  const currentDay = Math.min(7, Math.max(1, dailyPlan.programDay || 1));
  const completedProgramDays = getCompletedProgramDays(habit);
  const latestCompletedDay = [...completedProgramDays]
    .filter((day) => day <= currentDay)
    .sort((left, right) => right - left)[0] || null;
  const historyTargetDay = dailyPlan.isComplete ? currentDay : latestCompletedDay;

  useEffect(() => () => window.clearTimeout(preparingTimerRef.current), []);

  const startSession = (sceneId) => {
    if (preparingSceneId) return;
    setPreparingSceneId(sceneId);
    preparingTimerRef.current = window.setTimeout(() => {
      setPreparingSceneId(null);
      onSelect(sceneId);
    }, 900);
  };

  return (
    <section className={`screen theme-screen today-plan-screen challenge-v3-screen ${isEntering ? 'is-paper-entering' : ''}`}>
      <main className="challenge-v3-shell" aria-label="Today’s Face Reset challenge">
        <header className="challenge-v3-hero">
          <h1>Face Reset Challenge</h1>
        </header>

        <div className="challenge-v3-days" aria-label={`Program day ${currentDay} progress`}>
          {Array.from({ length: 7 }, (_, index) => {
            const day = index + 1;
            const isCurrent = day === currentDay;
            const isComplete = completedProgramDays.has(day);
            return (
              <span
                key={day}
                className={`challenge-v3-day ${isCurrent ? 'is-current' : ''} ${isComplete ? 'is-past' : ''} ${!isCurrent && !isComplete ? 'is-disabled' : ''}`}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={isCurrent ? `Current Program Day ${day}` : isComplete ? `Completed Program Day ${day}` : `Program Day ${day} locked`}
              >
                {isCurrent ? `DAY ${day}` : day}
                {isComplete && <i aria-hidden="true">✓</i>}
              </span>
            );
          })}
        </div>

        <TodayPlanCard
          sceneResults={dailyPlan.sceneResults}
          programDay={currentDay}
          selectedScene={selectedScene}
          preparingSceneId={preparingSceneId}
          onStart={startSession}
          onSessionSelect={startSession}
          showCompletion
          onViewResult={dailyPlan.isComplete ? () => onViewResult?.(currentDay) : undefined}
        />

        {historyTargetDay && (
          <button
            className="challenge-v3-view-history"
            type="button"
            onClick={() => onViewResult?.(historyTargetDay)}
          >
            View history <span aria-hidden="true">→</span>
          </button>
        )}
      </main>
    </section>
  );
}
