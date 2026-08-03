import {
  buildLeaderboard,
  buildPassport,
  buildProgressDebugSnapshot,
  clearHabitProgress,
  clearTodayProgress,
  hasSeenGuide,
  loadHabit,
  markGuideSeen,
  saveResult,
  seedDemoProgress,
} from './storage.js';

export const localProgressAdapter = {
  id: 'local',
  label: 'Local device',

  loadHabit() {
    return loadHabit();
  },

  saveSessionResult(result) {
    return saveResult(result);
  },

  loadPassport(habit = loadHabit()) {
    return buildPassport(habit);
  },

  loadLeaderboard(habit = loadHabit()) {
    return buildLeaderboard(habit);
  },

  submitLeaderboardScore(result, habit = loadHabit()) {
    return {
      provider: 'local',
      submitted: false,
      reason: 'local-prototype',
      leaderboard: buildLeaderboard(habit),
      score: result?.score || habit.bestScore || habit.latestScore || 0,
    };
  },

  getIdentity(habit = loadHabit()) {
    return {
      authMode: habit.authMode || 'guest',
      deviceId: habit.deviceId || '',
      provider: 'local',
    };
  },

  hasSeenGuide(sceneId) {
    return hasSeenGuide(sceneId);
  },

  markGuideSeen(sceneId) {
    return markGuideSeen(sceneId);
  },

  debug: {
    loadSnapshot() {
      return buildProgressDebugSnapshot(loadHabit());
    },
    clearAll() {
      return clearHabitProgress();
    },
    clearToday() {
      return clearTodayProgress();
    },
    seed({ days = 7 } = {}) {
      return seedDemoProgress({ days });
    },
  },
};
