import { getSceneById, SCENE_IDS } from '../data/scenes.js';

const STORAGE_KEY = 'face-reset-mirror-habit';
const DEVICE_KEY = 'face-reset-mirror-device-id';
const GUIDE_KEY = 'face-reset-mirror-seen-guides-v1';
const STORAGE_VERSION = 2;
const MAX_STORED_SCORE = 1000;

const faceAreas = [
  { key: 'underEye', label: 'Under-eye', target: 2 },
  { key: 'mouth', label: 'Mouth + jaw', target: 2 },
  { key: 'temples', label: 'Temples', target: 2 },
  { key: 'nose', label: 'Nose', target: 1 },
  { key: 'cheeks', label: 'Cheeks', target: 2 },
];

const defaultHabit = {
  version: STORAGE_VERSION,
  authMode: 'guest',
  deviceId: '',
  streak: 0,
  bestScore: null,
  latestScore: null,
  latestDate: null,
  totalSessions: 0,
  completedDates: [],
  dailyResults: {},
  sceneStats: {},
  areaDates: {},
  history: [],
  areaCounts: {},
};

const toLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const todayKey = () => toLocalDateKey();

const dateDiffDays = (fromDate, toDate) => {
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  return Math.round((to - from) / 86400000);
};

function getDeviceId() {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const next = globalThis.crypto?.randomUUID?.() || `guest-${Date.now()}-${Math.round(Math.random() * 100000)}`;
    localStorage.setItem(DEVICE_KEY, next);
    return next;
  } catch {
    return 'guest-local';
  }
}

export function loadHabit() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    return migrateHabit({
      ...defaultHabit,
      ...parsed,
      deviceId: parsed.deviceId || getDeviceId(),
      history: parsed.history || [],
      areaCounts: parsed.areaCounts || {},
    });
  } catch {
    return {
      ...defaultHabit,
      deviceId: getDeviceId(),
    };
  }
}

export function saveResult(result) {
  const current = loadHabit();
  const date = todayKey();
  const completedDates = new Set(current.completedDates || []);
  const previousDate = current.latestDate;
  const hasCheckedInToday = completedDates.has(date);
  const sceneId = result.sceneId || Object.keys(result.metrics || {})[0] || SCENE_IDS.whaleDream;
  const scene = getSceneById(sceneId);
  const score = clampScore(result.score);
  let streak = current.streak || 0;

  if (hasCheckedInToday || previousDate === date) {
    streak = Math.max(1, streak);
  } else if (!previousDate) {
    streak = 1;
  } else if (dateDiffDays(previousDate, date) === 1) {
    streak += 1;
  } else {
    streak = 1;
  }

  completedDates.add(date);

  const { snapshots, ...shareSafeResult } = result;
  const saved = {
    ...shareSafeResult,
    id: `${date}-${Date.now()}`,
    sceneId,
    sceneTitle: scene.title,
    areaKey: scene.areaKey,
    area: scene.area,
    stamp: scene.stamp,
    date,
    completedAt: new Date().toISOString(),
    score,
    streak,
  };
  const areaDates = normalizeAreaDates(current.areaDates, current.history);
  areaDates[scene.areaKey] = uniqueStrings([...(areaDates[scene.areaKey] || []), date]);
  const areaCounts = {
    ...Object.fromEntries(faceAreas.map((area) => [area.key, areaDates[area.key]?.length || 0])),
  };
  const dailyResults = {
    ...(current.dailyResults || {}),
    [date]: buildDailyResult(current.dailyResults?.[date], saved),
  };
  const sceneStats = {
    ...(current.sceneStats || {}),
    [sceneId]: buildSceneStats(current.sceneStats?.[sceneId], saved),
  };
  const history = [saved, ...(current.history || [])].slice(0, 80);
  const bestScore = Math.max(current.bestScore || 0, score);

  const nextHabit = {
    ...current,
    version: STORAGE_VERSION,
    authMode: current.authMode || 'guest',
    deviceId: current.deviceId || getDeviceId(),
    updatedAt: new Date().toISOString(),
    streak,
    bestScore,
    latestScore: score,
    latestDate: date,
    totalSessions: (current.totalSessions || 0) + 1,
    completedDates: Array.from(completedDates).sort(),
    dailyResults,
    sceneStats,
    areaDates,
    areaCounts,
    history,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextHabit));
  return saved;
}

export function clearHabitProgress({ keepDeviceId = true } = {}) {
  try {
    const deviceId = keepDeviceId ? getDeviceId() : '';
    localStorage.removeItem(STORAGE_KEY);
    if (!keepDeviceId) {
      localStorage.removeItem(DEVICE_KEY);
    }
    return {
      ...defaultHabit,
      deviceId: keepDeviceId ? deviceId : getDeviceId(),
    };
  } catch {
    return loadHabit();
  }
}

export function clearTodayProgress() {
  const current = loadHabit();
  const date = todayKey();
  const history = (current.history || []).filter((entry) => entry.date !== date);
  const nextHabit = rebuildHabitFromHistory(current, history);
  persistHabit(nextHabit);
  return nextHabit;
}

export function seedDemoProgress({ days = 7 } = {}) {
  const current = loadHabit();
  const history = Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - index));
    const dateKey = toLocalDateKey(date);
    const sceneId = Object.values(SCENE_IDS)[index % Object.values(SCENE_IDS).length];
    const scene = getSceneById(sceneId);
    const score = Math.min(990, 700 + index * 30 + (index % 3) * 40);
    return {
      id: `seed-${dateKey}-${sceneId}`,
      sceneId,
      sceneTitle: scene.title,
      areaKey: scene.areaKey,
      area: scene.area,
      stamp: scene.stamp,
      date: dateKey,
      completedAt: `${dateKey}T12:00:00.000Z`,
      score,
      streak: index + 1,
      radar: {},
      metrics: { [sceneId]: score },
    };
  });
  const existingHistory = (current.history || []).filter((entry) => !history.some((seed) => seed.date === entry.date));
  const nextHabit = rebuildHabitFromHistory(current, [...history.reverse(), ...existingHistory]);
  persistHabit(nextHabit);
  return nextHabit;
}

export function buildPassport(habit = loadHabit()) {
  const history = habit.history || [];
  const weekDays = getLastSevenDays();
  const completedDates = new Set(habit.completedDates || history.map((entry) => entry.date));
  const areaDates = normalizeAreaDates(habit.areaDates, history);
  const areaProgress = faceAreas.map((area) => {
    const count = areaDates[area.key]?.length || habit.areaCounts?.[area.key] || 0;
    return {
      ...area,
      count,
      progress: Math.min(1, count / area.target),
      completed: count >= area.target,
    };
  });
  const completedAreas = areaProgress.filter((area) => area.completed).length;
  const weeklyCompletion = Math.round((weekDays.filter((day) => completedDates.has(day.key)).length / 7) * 100);
  const faceCompletion = Math.round((areaProgress.reduce((total, area) => total + area.progress, 0) / areaProgress.length) * 100);

  return {
    authMode: habit.authMode || 'guest',
    deviceId: habit.deviceId || getDeviceId(),
    streak: habit.streak || 0,
    latestScore: habit.latestScore || 0,
    bestScore: habit.bestScore || habit.latestScore || 0,
    totalSessions: habit.totalSessions || history.length,
    latestDate: habit.latestDate,
    weeklyCompletion,
    faceCompletion,
    completedAreas,
    weekDays: weekDays.map((day) => ({
      ...day,
      entry: habit.dailyResults?.[day.key] || history.find((item) => item.date === day.key),
      completed: completedDates.has(day.key),
    })),
    areaProgress,
    recentHistory: history.slice(0, 8),
  };
}

export function buildLeaderboard(habit = loadHabit()) {
  const score = habit.bestScore || habit.latestScore || 0;
  const streak = habit.streak || 0;
  const history = habit.history || [];
  const bestEntry = history.reduce((best, entry) => ((entry.score || 0) > (best?.score || 0) ? entry : best), history[0]);
  const sceneLabel = bestEntry?.sceneTitle || getSceneById(bestEntry?.sceneId)?.title || 'Today reset';
  const totalSessions = habit.totalSessions || history.length || 0;
  const rows = [
    { name: 'You', score, detail: `${streak || 0} day streak · ${sceneLabel}`, isUser: true },
    { name: 'Soft Orbit', score: 960, detail: 'Whale Mouth' },
    { name: 'Puffer Club', score: 910, detail: 'Whale Dream 2' },
    { name: 'Face Garden', score: 880, detail: 'Cloud Garden' },
    { name: 'Bubble Hero', score: 840, detail: 'Bubble Gum Bunny' },
    { name: 'Bloom Crew', score: 790, detail: 'Flower Collector' },
    { name: 'Soda Sprout', score: 740, detail: 'Lemon Squeeze' },
  ].sort((a, b) => b.score - a.score);

  return rows.map((row, index) => ({
    ...row,
    rank: index + 1,
    percentile: Math.max(4, 100 - Math.round(((rows.length - index) / rows.length) * 100)),
    totalSessions,
  }));
}

export function buildProgressDebugSnapshot(habit = loadHabit()) {
  const passport = buildPassport(habit);
  const leaderboard = buildLeaderboard(habit);
  return {
    provider: 'local',
    storageVersion: STORAGE_VERSION,
    today: todayKey(),
    deviceId: habit.deviceId || getDeviceId(),
    authMode: habit.authMode || 'guest',
    isCheckedInToday: passport.latestDate === todayKey(),
    streak: passport.streak || 0,
    bestScore: passport.bestScore || 0,
    latestScore: passport.latestScore || 0,
    latestDate: passport.latestDate,
    totalSessions: passport.totalSessions || 0,
    completedDates: habit.completedDates || [],
    areaProgress: passport.areaProgress,
    sceneStats: Object.values(habit.sceneStats || {}),
    history: (habit.history || []).slice(0, 12),
    leaderboard,
  };
}

export function getSceneAreaSummary(sceneId) {
  const scene = getSceneById(sceneId);
  return {
    area: scene.area,
    stamp: scene.stamp,
  };
}

export function loadSeenGuides() {
  try {
    return JSON.parse(localStorage.getItem(GUIDE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

export function hasSeenGuide(sceneId) {
  return Boolean(loadSeenGuides()[sceneId]);
}

export function markGuideSeen(sceneId) {
  try {
    const next = {
      ...loadSeenGuides(),
      [sceneId]: true,
    };
    localStorage.setItem(GUIDE_KEY, JSON.stringify(next));
    return next;
  } catch {
    return {};
  }
}

export { faceAreas };

function persistHabit(habit) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(habit));
  } catch {
    // localStorage may be unavailable in private or embedded browsers.
  }
}

function rebuildHabitFromHistory(current, history) {
  const normalizedHistory = [...history]
    .filter((entry) => entry?.date)
    .map((entry) => ({
      ...entry,
      score: clampScore(entry.score),
      sceneTitle: entry.sceneTitle || getSceneById(entry.sceneId)?.title,
    }))
    .sort((a, b) => new Date(b.completedAt || `${b.date}T23:59:59`) - new Date(a.completedAt || `${a.date}T23:59:59`));
  const completedDates = uniqueStrings(normalizedHistory.map((entry) => entry.date)).sort();
  const areaDates = normalizeAreaDates({}, normalizedHistory);
  const areaCounts = {
    ...Object.fromEntries(faceAreas.map((area) => [area.key, areaDates[area.key]?.length || 0])),
  };
  const dailyResults = buildDailyResultsFromHistory(normalizedHistory);
  const sceneStats = buildSceneStatsFromHistory(normalizedHistory);
  const bestScore = Math.max(0, ...normalizedHistory.map((entry) => entry.score || 0));

  return {
    ...defaultHabit,
    authMode: current.authMode || 'guest',
    deviceId: current.deviceId || getDeviceId(),
    updatedAt: new Date().toISOString(),
    streak: calculateCurrentStreak(completedDates),
    bestScore,
    latestScore: normalizedHistory[0]?.score ?? null,
    latestDate: completedDates[completedDates.length - 1] || null,
    totalSessions: normalizedHistory.length,
    completedDates,
    dailyResults,
    sceneStats,
    areaDates,
    areaCounts,
    history: normalizedHistory.slice(0, 80),
  };
}

function migrateHabit(habit) {
  const history = (habit.history || []).map((entry) => ({
    ...entry,
    score: clampScore(entry.score),
    sceneTitle: entry.sceneTitle || getSceneById(entry.sceneId)?.title,
  }));
  const completedDates = uniqueStrings([...(habit.completedDates || []), ...history.map((entry) => entry.date).filter(Boolean)]).sort();
  const areaDates = normalizeAreaDates(habit.areaDates, history);
  const areaCounts = {
    ...Object.fromEntries(faceAreas.map((area) => [area.key, areaDates[area.key]?.length || habit.areaCounts?.[area.key] || 0])),
  };
  const dailyResults = {
    ...buildDailyResultsFromHistory(history),
    ...(habit.dailyResults || {}),
  };
  const sceneStats = {
    ...buildSceneStatsFromHistory(history),
    ...(habit.sceneStats || {}),
  };
  const bestScore = Math.max(habit.bestScore || 0, habit.latestScore || 0, ...history.map((entry) => entry.score || 0));

  return {
    ...defaultHabit,
    ...habit,
    version: STORAGE_VERSION,
    deviceId: habit.deviceId || getDeviceId(),
    bestScore,
    latestScore: habit.latestScore ?? history[0]?.score ?? null,
    latestDate: habit.latestDate || completedDates[completedDates.length - 1] || null,
    totalSessions: habit.totalSessions || history.length,
    completedDates,
    dailyResults,
    sceneStats,
    areaDates,
    areaCounts,
    history,
  };
}

function normalizeAreaDates(areaDates = {}, history = []) {
  const next = Object.fromEntries(faceAreas.map((area) => [area.key, uniqueStrings(areaDates[area.key] || [])]));
  history.forEach((entry) => {
    if (!entry?.date || !entry?.areaKey) return;
    next[entry.areaKey] = uniqueStrings([...(next[entry.areaKey] || []), entry.date]);
  });
  return next;
}

function buildDailyResult(previous, entry) {
  if (!previous) {
    return {
      date: entry.date,
      stamp: entry.stamp,
      sceneId: entry.sceneId,
      sceneTitle: entry.sceneTitle,
      bestScore: entry.score,
      sessionCount: 1,
      lastCompletedAt: entry.completedAt,
    };
  }

  const isNewBest = entry.score >= (previous.bestScore || 0);
  return {
    ...previous,
    stamp: isNewBest ? entry.stamp : previous.stamp,
    sceneId: isNewBest ? entry.sceneId : previous.sceneId,
    sceneTitle: isNewBest ? entry.sceneTitle : previous.sceneTitle,
    bestScore: Math.max(previous.bestScore || 0, entry.score),
    sessionCount: (previous.sessionCount || 0) + 1,
    lastCompletedAt: entry.completedAt,
  };
}

function buildSceneStats(previous, entry) {
  return {
    sceneId: entry.sceneId,
    sceneTitle: entry.sceneTitle,
    areaKey: entry.areaKey,
    area: entry.area,
    stamp: entry.stamp,
    playCount: (previous?.playCount || 0) + 1,
    bestScore: Math.max(previous?.bestScore || 0, entry.score),
    latestScore: entry.score,
    lastPlayedAt: entry.completedAt,
  };
}

function buildDailyResultsFromHistory(history) {
  return history.reduce((results, entry) => {
    if (!entry?.date) return results;
    results[entry.date] = buildDailyResult(results[entry.date], entry);
    return results;
  }, {});
}

function buildSceneStatsFromHistory(history) {
  return history.reduce((stats, entry) => {
    if (!entry?.sceneId) return stats;
    stats[entry.sceneId] = buildSceneStats(stats[entry.sceneId], entry);
    return stats;
  }, {});
}

function clampScore(score) {
  const numeric = Number(score);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(MAX_STORED_SCORE, Math.round(numeric)));
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean).map(String))];
}

function calculateCurrentStreak(dates) {
  const sorted = uniqueStrings(dates).sort();
  if (!sorted.length) return 0;
  let streak = 1;
  for (let index = sorted.length - 1; index > 0; index -= 1) {
    if (dateDiffDays(sorted[index - 1], sorted[index]) === 1) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

function getLastSevenDays() {
  const formatter = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = toLocalDateKey(date);
    return {
      key,
      label: formatter.format(date),
    };
  });
}
