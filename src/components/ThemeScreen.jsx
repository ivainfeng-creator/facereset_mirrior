import { useEffect, useRef, useState } from 'react';
import TodayPlanCard from './TodayPlanCard.jsx';
import { buildDailyPlanSummary, getCompletedProgramDays } from '../utils/dailyPlan.js';

export default function ThemeScreen({
  habit,
  selectedScene,
  onSelect,
  isEntering = false,
}) {
  const [preparingSceneId, setPreparingSceneId] = useState(null);
  const preparingTimerRef = useRef(null);
  const dailyPlan = buildDailyPlanSummary(habit);
  const currentDay = Math.min(7, Math.max(1, dailyPlan.programDay || 1));
  const completedProgramDays = getCompletedProgramDays(habit);

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

        <TodayPlanCard
          sceneResults={dailyPlan.sceneResults}
          programDay={currentDay}
          selectedScene={selectedScene}
          preparingSceneId={preparingSceneId}
          onStart={startSession}
          onSessionSelect={startSession}
          showCompletion
        />
      </main>
    </section>
  );
}
