import { useEffect, useRef, useState } from 'react';
import TodayPlanCard from './TodayPlanCard.jsx';
import { buildDailyPlanSummary } from '../utils/dailyPlan.js';

export default function ThemeScreen({
  habit,
  dailyPlan,
  daySelector,
  selectedScene,
  onSelect,
  isEntering = false,
  newlyCompletedSceneId = null,
  onCompletionStampAnimationEnd,
}) {
  const [preparingSceneId, setPreparingSceneId] = useState(null);
  const preparingTimerRef = useRef(null);
  const currentDailyPlan = buildDailyPlanSummary(habit);
  const selectedDay = Math.min(7, Math.max(1, dailyPlan.programDay || 1));
  const isHistoryView = dailyPlan.date !== currentDailyPlan.date;

  useEffect(() => () => window.clearTimeout(preparingTimerRef.current), []);

  const startSession = (sceneId) => {
    if (preparingSceneId) return;
    setPreparingSceneId(sceneId);
    preparingTimerRef.current = window.setTimeout(() => {
      setPreparingSceneId(null);
      onSelect(sceneId, dailyPlan.date);
    }, 900);
  };

  return (
    <section className={`screen theme-screen today-plan-screen challenge-v3-screen ${isEntering ? 'is-paper-entering' : ''}`}>
      <main className="challenge-v3-shell" aria-label="Today’s Face Reset challenge">
        <header className="challenge-v3-hero">
          <h1>Face Reset Challenge</h1>
        </header>

        {daySelector}

        <TodayPlanCard
          sceneResults={dailyPlan.sceneResults}
          programDay={selectedDay}
          selectedScene={selectedScene}
          preparingSceneId={preparingSceneId}
          onStart={startSession}
          onSessionSelect={startSession}
          showCompletion
          newlyCompletedSceneId={newlyCompletedSceneId}
          onCompletionStampAnimationEnd={onCompletionStampAnimationEnd}
          isReadOnly={false}
          focusLabel={isHistoryView ? `DAY ${selectedDay} RECORD` : 'TODAY\'S FOCUS'}
        />
      </main>
    </section>
  );
}
