import {
  buildLeaderboard,
  buildPassport,
  hasSeenGuide,
  loadHabit,
  markGuideSeen,
  saveResult,
} from './storage.js';

export const PROGRESS_PROVIDER = {
  local: 'local',
  viverse: 'viverse',
};

export const activeProgressProvider = PROGRESS_PROVIDER.local;

export function loadHabitProgress() {
  return loadHabit();
}

export function saveSessionResult(result) {
  const saved = saveResult(result);
  return {
    provider: activeProgressProvider,
    saved,
  };
}

export function loadPassportProgress(habit = loadHabitProgress()) {
  return buildPassport(habit);
}

export function loadLeaderboardRows(habit = loadHabitProgress()) {
  return buildLeaderboard(habit);
}

export function submitLeaderboardScore(result, habit = loadHabitProgress()) {
  return {
    provider: activeProgressProvider,
    submitted: false,
    reason: 'local-prototype',
    leaderboard: loadLeaderboardRows(habit),
    score: result?.score || habit.latestScore || 0,
  };
}

export function getPlayerIdentity(habit = loadHabitProgress()) {
  return {
    authMode: habit.authMode || 'guest',
    deviceId: habit.deviceId || '',
    provider: activeProgressProvider,
  };
}

export { hasSeenGuide, markGuideSeen };
