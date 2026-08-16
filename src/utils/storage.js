import { getSceneById, SCENE_IDS, TODAY_SCENE_IDS } from '../data/scenes.js';
import { clampSceneScore, migrateLegacyRawSceneScore } from './scoring.js';
import { getEffectiveLocalDateKey, toLocalDateKey as formatLocalDateKey } from './effectiveDate.js';
import {
  assignProgramDayForActivity,
  getProgramDayForDate,
  isValidProgramDay,
  normalizeProgramDayHistory,
} from './programDay.js';

const STORAGE_KEY = 'face-reset-mirror-habit';
const DEVICE_KEY = 'face-reset-mirror-device-id';
const GUIDE_KEY = 'face-reset-mirror-seen-guides-v1';
const SYNC_QUEUE_KEY = 'face-reset-mirror-supabase-sync-v1';
const STORAGE_VERSION = 5;
const MAX_STORED_SCORE = 100;

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
  displayName: '',
  streak: 0,
  bestScore: null,
  latestScore: null,
  latestDate: null,
  totalSessions: 0,
  completedDates: [],
  dailyResults: {},
  sceneStats: {},
  areaDates: {},
  programDayByDate: {},
  history: [],
  areaCounts: {},
};

export const toLocalDateKey = formatLocalDateKey;

const todayKey = () => getEffectiveLocalDateKey();

const dateDiffDays = (fromDate, toDate) => {
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  return Math.round((to - from) / 86400000);
};

function assignCurrentProgramDay(habit) {
  const date = todayKey();
  const existingDay = getProgramDayForDate({
    programDayByDate: habit?.programDayByDate,
    date,
    fallback: null,
  });
  if (isValidProgramDay(existingDay)) {
    return { programDayByDate: habit.programDayByDate, didAssignProgramDay: false };
  }

  const assigned = assignProgramDayForActivity({
    programDayByDate: habit?.programDayByDate,
    history: habit?.history,
    date,
  });
  return { ...assigned, didAssignProgramDay: true };
}

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
    const storedVersion = Number(parsed.version || 0);
    const needsScoreMigration = storedVersion < 4;
    const needsProgramDayMigration = storedVersion < STORAGE_VERSION;
    const habit = migrateHabit({
      ...defaultHabit,
      ...parsed,
      deviceId: parsed.deviceId || getDeviceId(),
      history: parsed.history || [],
      areaCounts: parsed.areaCounts || {},
    }, { needsScoreMigration, needsProgramDayMigration });
    const { programDayByDate, didAssignProgramDay } = assignCurrentProgramDay(habit);
    const habitWithCurrentDay = didAssignProgramDay
      ? { ...habit, programDayByDate }
      : habit;

    if (needsScoreMigration || needsProgramDayMigration || didAssignProgramDay) {
      persistHabit(habitWithCurrentDay);
      migrateQueuedSessions({
        needsScoreMigration,
        needsProgramDayMigration,
        programDayByDate: habitWithCurrentDay.programDayByDate,
      });
    }
    return habitWithCurrentDay;
  } catch {
    return {
      ...defaultHabit,
      deviceId: getDeviceId(),
    };
  }
}

export function normalizeDisplayName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 24);
}

export function getDisplayName(habit = loadHabit()) {
  return normalizeDisplayName(habit?.displayName);
}

export function saveDisplayName(value) {
  const current = loadHabit();
  const displayName = normalizeDisplayName(value);
  const next = {
    ...current,
    displayName,
    updatedAt: new Date().toISOString(),
  };
  persistHabit(next);
  return next;
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
  const { programDay, programDayByDate } = assignProgramDayForActivity({
    programDayByDate: current.programDayByDate,
    history: current.history,
    date,
  });

  const { snapshots, ...shareSafeResult } = result;
  const saved = {
    ...shareSafeResult,
    id: createSessionId(),
    sceneId,
    sceneTitle: scene.title,
    areaKey: scene.areaKey,
    area: scene.area,
    stamp: scene.stamp,
    date,
    programDay,
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
  const history = [saved, ...(current.history || [])].slice(0, 250);
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
    programDayByDate,
    history,
  };

  persistHabit(nextHabit);
  enqueueSessionForSync(saved);
  return saved;
}

export function getSessionSyncQueue() {
  try {
    const entries = JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]');
    return Array.isArray(entries) ? entries.filter((entry) => entry?.id) : [];
  } catch {
    return [];
  }
}

export function removeSessionFromSyncQueue(sessionId) {
  const nextQueue = getSessionSyncQueue().filter((entry) => entry.id !== sessionId);
  persistSessionSyncQueue(nextQueue);
  return nextQueue;
}

export function enqueueSessionForSync(session) {
  if (!session?.id) return getSessionSyncQueue();
  const queue = getSessionSyncQueue();
  if (queue.some((entry) => entry.id === session.id)) return queue;
  const nextQueue = [...queue, session].slice(-250);
  persistSessionSyncQueue(nextQueue);
  return nextQueue;
}

export function buildDailyProgressPayload(habit = loadHabit(), date = todayKey()) {
  const bestByScene = new Map();
  (habit.history || []).forEach((entry) => {
    if (entry?.date !== date || !entry?.sceneId) return;
    const previous = bestByScene.get(entry.sceneId);
    if (!previous || clampScore(entry.score) > clampScore(previous.score)) {
      bestByScene.set(entry.sceneId, entry);
    }
  });

  const sceneScores = Object.fromEntries(
    [...bestByScene.entries()].map(([sceneId, entry]) => [sceneId, clampScore(entry.score)]),
  );
  const completedSessions = TODAY_SCENE_IDS.filter((sceneId) => sceneScores[sceneId] > 0).length;
  const totalScore = TODAY_SCENE_IDS.reduce((total, sceneId) => total + (sceneScores[sceneId] || 0), 0);
  const programDay = getStoredProgramDayForDate(habit, date);

  return {
    progress_date: date,
    program_day: programDay,
    total_score: totalScore,
    completed_sessions: completedSessions,
    is_complete: completedSessions === TODAY_SCENE_IDS.length,
    scene_scores: sceneScores,
    streak_days: Math.max(0, Number(habit.streak) || 0),
  };
}

export function toCloudSessionResult(session) {
  if (!session?.id || !session?.sceneId || !session?.date || !isValidProgramDay(session.programDay)) return null;
  return {
    id: session.id,
    progress_date: session.date,
    program_day: Number(session.programDay),
    scene_id: session.sceneId,
    score: clampScore(session.score),
    duration_seconds: toNullableInteger(session.durationSeconds ?? session.holdSeconds),
    interaction_summary: {
      completedAt: session.completedAt || null,
      completion: toNullableNumber(session.completion),
      holdSeconds: toNullableNumber(session.holdSeconds),
      feedback: session.feedback || null,
      metrics: session.metrics || {},
      radar: session.radar || [],
    },
  };
}

export function mergeHabitWithCloud({ habit = loadHabit(), progressRows = [], sessionRows = [] } = {}) {
  const entriesById = new Map();
  (habit.history || []).forEach((entry) => {
    if (entry?.id) entriesById.set(entry.id, entry);
  });

  (sessionRows || []).forEach((row) => {
    const entry = cloudSessionToHistoryEntry(row);
    if (!entry) return;
    const current = entriesById.get(entry.id);
    entriesById.set(entry.id, chooseMoreCompleteEntry(current, entry));
  });

  const bestScoreByDateScene = new Map();
  [...entriesById.values()].forEach((entry) => {
    if (!entry?.date || !entry?.sceneId) return;
    const key = `${entry.date}:${entry.sceneId}`;
    bestScoreByDateScene.set(key, Math.max(bestScoreByDateScene.get(key) || 0, clampScore(entry.score)));
  });

  (progressRows || []).forEach((row) => {
    const date = row?.progress_date;
    const sceneScores = row?.scene_scores && typeof row.scene_scores === 'object' ? row.scene_scores : {};
    Object.entries(sceneScores).forEach(([sceneId, rawScore]) => {
      const score = clampScore(rawScore);
      const key = `${date}:${sceneId}`;
      if (!date || !score || (bestScoreByDateScene.get(key) || 0) >= score) return;
      const scene = getSceneById(sceneId);
      entriesById.set(`cloud-summary-${date}-${sceneId}`, {
        id: `cloud-summary-${date}-${sceneId}`,
        isCloudSummary: true,
        sceneId,
        sceneTitle: scene.title,
        areaKey: scene.areaKey,
        area: scene.area,
        stamp: scene.stamp,
        date,
        programDay: row.program_day,
        completedAt: row.updated_at || `${date}T12:00:00.000Z`,
        score,
        metrics: { [sceneId]: score },
      });
      bestScoreByDateScene.set(key, score);
    });
  });

  const merged = rebuildHabitFromHistory(habit, [...entriesById.values()]);
  const cloudCompletedDates = (progressRows || [])
    .filter((row) => Number(row?.completed_sessions) > 0 && row?.progress_date)
    .map((row) => row.progress_date);
  const completedDates = uniqueStrings([...(merged.completedDates || []), ...cloudCompletedDates]).sort();

  const nextHabit = {
    ...merged,
    authMode: habit.authMode || 'guest',
    deviceId: habit.deviceId || getDeviceId(),
    completedDates,
    streak: calculateCurrentStreak(completedDates),
    totalSessions: merged.history.filter((entry) => !entry.isCloudSummary).length,
  };
  persistHabit(nextHabit);
  return nextHabit;
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
    const score = Math.min(99, 70 + index * 3 + (index % 3) * 4);
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

export function seedSessionOneCompleteProgress() {
  clearTodayProgress();
  const sceneId = TODAY_SCENE_IDS[0];
  return saveResult({
    sceneId,
    score: 92,
    holdSeconds: 30,
    metrics: { [sceneId]: 92 },
  });
}

export function seedDayOneCompleteProgress() {
  const current = loadHabit();
  const date = toLocalDateKey(new Date());
  const history = (current.history || []).filter((entry) => entry.date !== date);
  const completedSessions = TODAY_SCENE_IDS.map((sceneId, index) => {
    const scene = getSceneById(sceneId);
    const score = 96 - index * 3;
    return {
      id: `seed-day-one-complete-${date}-${sceneId}`,
      sceneId,
      sceneTitle: scene.title,
      areaKey: scene.areaKey,
      area: scene.area,
      stamp: scene.stamp,
      date,
      programDay: 1,
      completedAt: `${date}T${String(12 + index).padStart(2, '0')}:00:00.000Z`,
      score,
      holdSeconds: 30,
      streak: 1,
      metrics: { [sceneId]: score },
    };
  });
  const nextHabit = rebuildHabitFromHistory({
    ...current,
    programDayByDate: {
      ...(current.programDayByDate || {}),
      [date]: 1,
    },
  }, [...completedSessions, ...history]);
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
    { name: 'Soft Orbit', score: 96, detail: 'Whale Mouth' },
    { name: 'Puffer Club', score: 91, detail: 'Whale Dream 2' },
    { name: 'Face Garden', score: 88, detail: 'Cloud Garden' },
    { name: 'Bubble Hero', score: 84, detail: 'Bubble Gum Bunny' },
    { name: 'Popcorn Crew', score: 79, detail: 'Popcorn Collector' },
    { name: 'Soda Sprout', score: 74, detail: 'Lemon Squeeze' },
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

function createSessionId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const randomHex = () => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
  return `${randomHex()}-${randomHex().slice(0, 4)}-4${randomHex().slice(0, 3)}-8${randomHex().slice(0, 3)}-${randomHex()}${randomHex().slice(0, 4)}`;
}

function persistSessionSyncQueue(entries) {
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(entries));
  } catch {
    // Offline syncing is optional. Gameplay progress remains in the habit record.
  }
}

function persistHabit(habit) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(habit));
  } catch {
    // localStorage may be unavailable in private or embedded browsers.
  }
}

function rebuildHabitFromHistory(current, history) {
  const scoredHistory = [...history]
    .filter((entry) => entry?.date)
    .map((entry) => ({
      ...entry,
      score: clampScore(entry.score),
      sceneTitle: entry.sceneTitle || getSceneById(entry.sceneId)?.title,
    }))
    .sort((a, b) => new Date(b.completedAt || `${b.date}T23:59:59`) - new Date(a.completedAt || `${a.date}T23:59:59`));
  const { history: normalizedHistory, programDayByDate } = normalizeProgramDayHistory({
    history: scoredHistory,
    programDayByDate: current.programDayByDate,
  });
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
    displayName: normalizeDisplayName(current.displayName),
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
    programDayByDate,
    history: normalizedHistory.slice(0, 250),
  };
}

function cloudSessionToHistoryEntry(row) {
  if (!row?.id || !row?.progress_date || !row?.scene_id) return null;
  const scene = getSceneById(row.scene_id);
  const summary = row.interaction_summary && typeof row.interaction_summary === 'object'
    ? row.interaction_summary
    : {};
  return {
    id: row.id,
    sceneId: row.scene_id,
    sceneTitle: scene.title,
    areaKey: scene.areaKey,
    area: scene.area,
    stamp: scene.stamp,
    date: row.progress_date,
    programDay: row.program_day,
    completedAt: summary.completedAt || row.created_at || `${row.progress_date}T12:00:00.000Z`,
    score: clampScore(row.score),
    durationSeconds: row.duration_seconds ?? null,
    holdSeconds: summary.holdSeconds ?? null,
    completion: summary.completion ?? null,
    feedback: summary.feedback || null,
    metrics: summary.metrics || { [row.scene_id]: clampScore(row.score) },
    radar: summary.radar || [],
  };
}

function chooseMoreCompleteEntry(localEntry, cloudEntry) {
  if (!localEntry) return cloudEntry;
  if (!cloudEntry) return localEntry;
  if (clampScore(cloudEntry.score) > clampScore(localEntry.score)) return { ...localEntry, ...cloudEntry };
  if (clampScore(cloudEntry.score) < clampScore(localEntry.score)) return { ...cloudEntry, ...localEntry };
  const localTime = Date.parse(localEntry.completedAt || '') || 0;
  const cloudTime = Date.parse(cloudEntry.completedAt || '') || 0;
  return cloudTime > localTime ? { ...localEntry, ...cloudEntry } : { ...cloudEntry, ...localEntry };
}

function migrateHabit(habit, { needsScoreMigration = false, needsProgramDayMigration = false } = {}) {
  const scoredHistory = (habit.history || []).map((entry) => ({
    ...entry,
    score: needsScoreMigration ? migrateLegacyRawSceneScore(entry.score) : clampScore(entry.score),
    sceneTitle: entry.sceneTitle || getSceneById(entry.sceneId)?.title,
  }));
  const { history, programDayByDate } = normalizeProgramDayHistory({
    history: scoredHistory,
    programDayByDate: habit.programDayByDate,
    legacyProgramDay: needsProgramDayMigration ? 1 : 1,
  });
  const completedDates = uniqueStrings([...(habit.completedDates || []), ...history.map((entry) => entry.date).filter(Boolean)]).sort();
  const areaDates = normalizeAreaDates(habit.areaDates, history);
  const areaCounts = {
    ...Object.fromEntries(faceAreas.map((area) => [area.key, areaDates[area.key]?.length || habit.areaCounts?.[area.key] || 0])),
  };
  const dailyResults = buildDailyResultsFromHistory(history);
  const sceneStats = buildSceneStatsFromHistory(history);
  const bestScore = Math.max(0, ...history.map((entry) => entry.score || 0));

  return {
    ...defaultHabit,
    ...habit,
    version: STORAGE_VERSION,
    deviceId: habit.deviceId || getDeviceId(),
    bestScore,
    latestScore: history[0]?.score ?? null,
    latestDate: habit.latestDate || completedDates[completedDates.length - 1] || null,
    totalSessions: habit.totalSessions || history.length,
    completedDates,
    dailyResults,
    sceneStats,
    areaDates,
    areaCounts,
    programDayByDate,
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
  return Math.min(MAX_STORED_SCORE, clampSceneScore(score));
}

function migrateQueuedSessions({
  needsScoreMigration = false,
  needsProgramDayMigration = false,
  programDayByDate = {},
} = {}) {
  const queue = getSessionSyncQueue();
  if (!queue.length) return;
  persistSessionSyncQueue(queue.map((entry) => ({
    ...entry,
    score: needsScoreMigration ? migrateLegacyRawSceneScore(entry.score) : clampScore(entry.score),
    metrics: Object.fromEntries(Object.entries(entry.metrics || {}).map(([key, score]) => [
      key,
      needsScoreMigration ? migrateLegacyRawSceneScore(score) : clampScore(score),
    ])),
    programDay: needsProgramDayMigration
      ? assignProgramDayForActivity({ programDayByDate, date: entry.date }).programDay
      : entry.programDay,
  })));
}

function getStoredProgramDayForDate(habit, date) {
  const mappedDay = getProgramDayForDate({
    programDayByDate: habit?.programDayByDate,
    date,
    fallback: null,
  });
  if (isValidProgramDay(mappedDay)) return Number(mappedDay);

  const historyEntry = (habit?.history || []).find((entry) => (
    entry?.date === date && isValidProgramDay(entry.programDay)
  ));
  return historyEntry ? Number(historyEntry.programDay) : null;
}

function toNullableNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function toNullableInteger(value) {
  const numeric = toNullableNumber(value);
  return numeric === null ? null : Math.round(numeric);
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
  const [year, month, day] = getEffectiveLocalDateKey().split('-').map(Number);
  const effectiveDate = new Date(year, month - 1, day);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(effectiveDate);
    date.setDate(date.getDate() - (6 - index));
    const key = toLocalDateKey(date);
    return {
      key,
      label: formatter.format(date),
    };
  });
}
