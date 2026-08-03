export const viverseProgressAdapter = {
  id: 'viverse',
  label: 'VIVERSE',
  isAvailable: false,

  loadHabit() {
    throw new Error('VIVERSE progress adapter is not connected yet.');
  },

  saveSessionResult() {
    throw new Error('VIVERSE progress adapter is not connected yet.');
  },

  loadPassport() {
    throw new Error('VIVERSE progress adapter is not connected yet.');
  },

  loadLeaderboard() {
    throw new Error('VIVERSE progress adapter is not connected yet.');
  },

  submitLeaderboardScore() {
    throw new Error('VIVERSE leaderboard adapter is not connected yet.');
  },

  getIdentity() {
    return {
      authMode: 'guest',
      deviceId: '',
      provider: 'viverse',
    };
  },
};
