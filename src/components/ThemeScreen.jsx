import { useEffect, useRef, useState } from 'react';
import TodayPlanCard from './TodayPlanCard.jsx';
import { buildDailyPlanSummary, getCompletedProgramDays } from '../utils/dailyPlan.js';
import { playSceneEffect } from '../utils/audioManager.js';

const DAY_SELECT_EFFECT = Object.freeze({
  source: '/audio/Overall/Ding.mp3',
  volume: 0.7,
});

export default function ThemeScreen({
  habit,
  selectedScene,
  onSelect,
  onViewReport,
  isEntering = false,
  newlyCompletedSceneId = null,
  onCompletionStampAnimationEnd,
}) {
  const [preparingSceneId, setPreparingSceneId] = useState(null);
  const preparingTimerRef = useRef(null);
  const currentDailyPlan = buildDailyPlanSummary(habit);
  const currentDay = Math.min(7, Math.max(1, currentDailyPlan.programDay || 1));
  const [selectedDay, setSelectedDay] = useState(currentDay);
  const completedProgramDays = getCompletedProgramDays(habit);
  const datesByProgramDay = getDatesByProgramDay(habit);
  const selectedDate = datesByProgramDay.get(selectedDay);
  const dailyPlan = selectedDate
    ? buildDailyPlanSummary(habit, { date: selectedDate })
    : currentDailyPlan;
  const isHistoryView = selectedDay !== currentDay;

  useEffect(() => () => window.clearTimeout(preparingTimerRef.current), []);

  useEffect(() => {
    setSelectedDay(currentDay);
  }, [currentDay]);

  const startSession = (sceneId) => {
    if (preparingSceneId) return;
    setPreparingSceneId(sceneId);
    preparingTimerRef.current = window.setTimeout(() => {
      setPreparingSceneId(null);
      onSelect(sceneId);
    }, 900);
  };

  const selectDay = (day) => {
    if (day === selectedDay) return;
    playSceneEffect(DAY_SELECT_EFFECT);
    const date = datesByProgramDay.get(day);
    const plan = date ? buildDailyPlanSummary(habit, { date }) : null;
    if (plan?.isComplete) {
      onViewReport?.(plan);
      return;
    }
    setSelectedDay(day);
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
            const isSelected = day === selectedDay;
            const isComplete = completedProgramDays.has(day);
            const canView = datesByProgramDay.has(day);
            const isAvailableHistory = canView && !isSelected;
            return (
              <button
                key={day}
                className={`challenge-v3-day ${isSelected ? 'is-current' : ''} ${isComplete ? 'is-past' : ''} ${isAvailableHistory ? 'is-available' : ''}`}
                type="button"
                onClick={() => selectDay(day)}
                disabled={!canView}
                aria-current={isSelected ? 'step' : undefined}
                aria-label={canView ? `View Day ${day}` : `Day ${day} is not available yet`}
              >
                {isSelected ? `DAY ${day}` : day}
                {isComplete && <i aria-hidden="true">✓</i>}
              </button>
            );
          })}
        </div>

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

function getDatesByProgramDay(habit) {
  const datesByProgramDay = new Map();

  Object.entries(habit?.programDayByDate || {}).forEach(([date, programDay]) => {
    const day = Number(programDay);
    if (date && Number.isInteger(day) && day >= 1) datesByProgramDay.set(day, date);
  });

  (habit?.history || []).forEach((entry) => {
    const day = Number(entry?.programDay);
    if (entry?.date && Number.isInteger(day) && day >= 1 && !datesByProgramDay.has(day)) {
      datesByProgramDay.set(day, entry.date);
    }
  });

  return datesByProgramDay;
}
