import { getLeaderboardSeedCount, getLeaderboardSeedRows } from '../data/leaderboardSeeds.js';
import { normalizeDisplayName } from './storage.js';

// Single place where real `daily_leaderboard` rows are turned into the rows a screen
// renders. Starter rows are added here and nowhere else, so nothing downstream of a
// fetch (saving, syncing, scoring) can ever see them.

function toDisplayRow(row) {
  return {
    name: row.display_name || 'Anonymous',
    score: Math.max(0, Number(row.total_score) || 0),
    completedSessions: Math.max(0, Number(row.completed_sessions) || 0),
    isComplete: row.is_complete !== false,
    isSeed: false,
  };
}

function toSeedDisplayRow(seed) {
  return {
    name: seed.name,
    score: seed.score,
    completedSessions: 3,
    isComplete: true,
    isSeed: true,
  };
}

/**
 * Merge real leaderboard rows with the fixed starter rows for a Program Day.
 *
 * @param {number} programDay
 * @param {Array} realRows raw `daily_leaderboard` rows, already ordered by the view
 * @returns {Array<{rank:number,name:string,score:number,completedSessions:number,isComplete:boolean,isSeed:boolean}>}
 */
export function buildLeaderboardDisplayRows(programDay, realRows = []) {
  const realDisplayRows = (Array.isArray(realRows) ? realRows : []).filter(Boolean).map(toDisplayRow);
  const takenNames = new Set(realDisplayRows.map((row) => normalizeDisplayName(row.name).toLowerCase()));

  // A starter name that a real player already uses would read as a duplicate entry.
  const availableSeeds = getLeaderboardSeedRows(programDay)
    .filter((seed) => !takenNames.has(normalizeDisplayName(seed.name).toLowerCase()));
  const seedRows = availableSeeds
    .slice(0, getLeaderboardSeedCount(programDay, realDisplayRows.length))
    .map(toSeedDisplayRow);

  return [...realDisplayRows, ...seedRows]
    // Score decides the order for real and starter rows alike; a tie keeps the real
    // player ahead so the merged list stays stable across renders.
    .sort((left, right) => (right.score - left.score) || (Number(left.isSeed) - Number(right.isSeed)))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}
