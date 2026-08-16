import ResultScreen from './ResultScreen.jsx';
import ThemeScreen from './ThemeScreen.jsx';

export default function ChallengeScreen({
  view,
  selectedScene,
  habit,
  result,
  isEntering,
  newlyCompletedSceneId,
  onCompletionStampAnimationEnd,
  onSelect,
  onViewReport,
  onRestart,
  onTodayPlan,
  onPassport,
  onLeaderboard,
  onProgressChanged,
  shouldPromptForDisplayName,
  shouldAnimateResultCards,
  resultAnimationKey,
}) {
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
      />
    );
  }

  return (
    <ThemeScreen
      selectedScene={selectedScene}
      onSelect={onSelect}
      onViewReport={onViewReport}
      habit={habit}
      isEntering={isEntering}
      newlyCompletedSceneId={newlyCompletedSceneId}
      onCompletionStampAnimationEnd={onCompletionStampAnimationEnd}
    />
  );
}
