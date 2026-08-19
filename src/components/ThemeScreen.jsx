import { useEffect, useRef, useState } from 'react';
import TodayPlanCard from './TodayPlanCard.jsx';
import ResultScreen from './ResultScreen.jsx';
import { buildDailyPlanSummary } from '../utils/dailyPlan.js';

export default function ThemeScreen({
  habit,
  dailyPlan,
  result,
  daySelector,
  selectedScene,
  onSelect,
  isEntering = false,
  newlyCompletedSceneId = null,
  onCompletionStampAnimationEnd,
  onViewHistory,
  shouldAnimateHistoryCards = false,
  shouldAnimateCompletionFlow = false,
  historyAnimationKey = 0,
}) {
  const [preparingSceneId, setPreparingSceneId] = useState(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [shouldAnimateHistoryEntry, setShouldAnimateHistoryEntry] = useState(false);
  const preparingTimerRef = useRef(null);
  const currentDailyPlan = buildDailyPlanSummary(habit);
  const selectedDay = Math.min(7, Math.max(1, dailyPlan.programDay || 1));
  const isHistoryView = dailyPlan.date !== currentDailyPlan.date;
  // The Today's Plan "view history" card reads from `dailyPlan`, which comes
  // from buildDailyPlanSummary and never carries snapshots (they aren't
  // persisted to habit history). For the day the user is actively viewing
  // right now, `result` (App.jsx's latestResult) is the one place real
  // in-memory camera captures from the just-completed sessions actually live
  // (see App.jsx's sessionSnapshotsRef), so thread them onto the plan here
  // rather than losing them. Any other day correctly falls through to the
  // snapshot-less dailyPlan and the Share Card's existing no-photo fallback.
  const resultForHistoryCard = !isHistoryView
    && result?.type === 'daily-plan'
    && result.programDay === dailyPlan.programDay
    && result.snapshots?.length
    ? { ...dailyPlan, snapshots: result.snapshots }
    : dailyPlan;

  useEffect(() => () => window.clearTimeout(preparingTimerRef.current), []);

  useEffect(() => {
    if (shouldAnimateHistoryCards) {
      setIsHistoryOpen(true);
      setShouldAnimateHistoryEntry(true);
    }
  }, [historyAnimationKey, shouldAnimateHistoryCards]);

  const toggleHistory = () => {
    setIsHistoryOpen((isOpen) => {
      const nextIsOpen = !isOpen;
      setShouldAnimateHistoryEntry(nextIsOpen);
      return nextIsOpen;
    });
  };

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
          onViewHistory={onViewHistory ? toggleHistory : undefined}
          isHistoryOpen={isHistoryOpen}
          shouldAnimateCompletionFlow={shouldAnimateCompletionFlow}
          newlyCompletedSceneId={newlyCompletedSceneId}
          onCompletionStampAnimationEnd={onCompletionStampAnimationEnd}
          isReadOnly={false}
          focusLabel={isHistoryView ? `DAY ${selectedDay} RECORD` : 'TODAY\'S FOCUS'}
        />
        {isHistoryOpen && (
          <ResultScreen
            result={resultForHistoryCard}
            habit={habit}
            onRestart={startSession}
            isHistoryOnly
            onCloseHistory={() => setIsHistoryOpen(false)}
            shouldPromptForDisplayName={false}
            shouldAnimateCardLayout={shouldAnimateHistoryCards || shouldAnimateHistoryEntry}
            cardLayoutAnimationKey={historyAnimationKey}
          />
        )}
      </main>
    </section>
  );
}
