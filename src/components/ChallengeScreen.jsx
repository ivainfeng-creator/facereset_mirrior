import ResultScreen from './ResultScreen.jsx';
import ThemeScreen from './ThemeScreen.jsx';
import ProgramDaySelector from './ProgramDaySelector.jsx';
import { buildDailyPlanSummary } from '../utils/dailyPlan.js';

export default function ChallengeScreen({
  view,
  selectedScene,
  habit,
  result,
  selectedDate,
  isEntering,
  newlyCompletedSceneId,
  onCompletionStampAnimationEnd,
  onSelect,
  onSelectDay,
  onRestart,
  onViewHistory,
  canViewHistory,
  onTodayPlan,
  onPassport,
  onLeaderboard,
  onProgressChanged,
  shouldPromptForDisplayName,
  shouldAnimateResultCards,
  resultAnimationKey,
}) {
  const currentPlan = buildDailyPlanSummary(habit);
  const dailyPlan = selectedDate
    ? buildDailyPlanSummary(habit, { date: selectedDate })
    : currentPlan;
  const selectedDay = Math.min(7, Math.max(1, dailyPlan.programDay || 1));
  const daySelector = (
    <ProgramDaySelector
      habit={habit}
      selectedDay={selectedDay}
      onSelectDay={(date) => onSelectDay(buildDailyPlanSummary(habit, { date }))}
    />
  );

  if (view === 'result') {
    return (
      <ResultScreen
        result={result}
        habit={habit}
        onRestart={onRestart}
        onTodayPlan={onTodayPlan}
        onPassport={onPassport}
        onLeaderboard={onLeaderboard}
        onProgressChanged={onProgressChanged}
        shouldPromptForDisplayName={shouldPromptForDisplayName}
        shouldAnimateCardLayout={shouldAnimateResultCards}
        cardLayoutAnimationKey={resultAnimationKey}
        daySelector={daySelector}
      />
    );
  }

  return (
    <ThemeScreen
      selectedScene={selectedScene}
      habit={habit}
      dailyPlan={dailyPlan}
      daySelector={daySelector}
      onSelect={onSelect}
      onViewHistory={canViewHistory ? onViewHistory : undefined}
      isEntering={isEntering}
      newlyCompletedSceneId={newlyCompletedSceneId}
      onCompletionStampAnimationEnd={onCompletionStampAnimationEnd}
    />
  );
}
