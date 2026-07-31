import { getSceneById, SCENE_IDS } from '../data/scenes.js';

const STORAGE_KEY = 'face-reset-mirror-habit';
const DEVICE_KEY = 'face-reset-mirror-device-id';

const faceAreas = [
  { key: 'underEye', label: 'Under-eye', target: 2 },
  { key: 'mouth', label: 'Mouth + jaw', target: 2 },
  { key: 'temples', label: 'Temples', target: 2 },
  { key: 'nose', label: 'Nose', target: 1 },
  { key: 'cheeks', label: 'Cheeks', target: 2 },
];

const defaultHabit = {
  authMode: 'guest',
  deviceId: '',
  streak: 0,
  latestScore: null,
  latestDate: null,
  history: [],
  areaCounts: {},
};

const todayKey = () => new Date().toISOString().slice(0, 10);

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
    return {
      ...defaultHabit,
      ...parsed,
      deviceId: parsed.deviceId || getDeviceId(),
      history: parsed.history || [],
      areaCounts: parsed.areaCounts || {},
    };
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
  const previousDate = current.latestDate;
  const sceneId = result.sceneId || Object.keys(result.metrics || {})[0] || SCENE_IDS.whaleDream;
  const scene = getSceneById(sceneId);
  let streak = current.streak || 0;

  if (!previousDate) {
    streak = 1;
  } else if (previousDate === date) {
    streak = Math.max(1, streak);
  } else if (dateDiffDays(previousDate, date) === 1) {
    streak += 1;
  } else {
    streak = 1;
  }

  const { snapshots, ...shareSafeResult } = result;
  const saved = {
    ...shareSafeResult,
    sceneId,
    areaKey: scene.areaKey,
    area: scene.area,
    stamp: scene.stamp,
    date,
    streak,
  };
  const areaCounts = {
    ...(current.areaCounts || {}),
    [scene.areaKey]: (current.areaCounts?.[scene.areaKey] || 0) + (previousDate === date && current.history?.[0]?.sceneId === sceneId ? 0 : 1),
  };

  const nextHabit = {
    ...current,
    authMode: current.authMode || 'guest',
    deviceId: current.deviceId || getDeviceId(),
    streak,
    latestScore: result.score,
    latestDate: date,
    areaCounts,
    history: [saved, ...(current.history || [])].slice(0, 30),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextHabit));
  return saved;
}

export function buildPassport(habit = loadHabit()) {
  const history = habit.history || [];
  const weekDays = getLastSevenDays();
  const completedDates = new Set(history.map((entry) => entry.date));
  const areaProgress = faceAreas.map((area) => {
    const count = habit.areaCounts?.[area.key] || 0;
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
    latestDate: habit.latestDate,
    weeklyCompletion,
    faceCompletion,
    completedAreas,
    weekDays: weekDays.map((day) => ({
      ...day,
      entry: history.find((item) => item.date === day.key),
      completed: completedDates.has(day.key),
    })),
    areaProgress,
    recentHistory: history.slice(0, 8),
  };
}

export function buildLeaderboard(habit = loadHabit()) {
  const score = habit.latestScore || 78;
  const streak = habit.streak || 0;
  const rows = [
    { name: 'You', score, detail: `${streak || 1} day streak`, isUser: true },
    { name: 'Soft Orbit', score: Math.min(99, score + 7), detail: 'Whale Dream' },
    { name: 'Face Garden', score: Math.min(98, score + 4), detail: 'Cloud Garden' },
    { name: 'Bubble Hero', score: Math.max(64, score - 2), detail: 'Bubble Gum Bunny' },
    { name: 'Rain Calm', score: Math.max(60, score - 7), detail: 'Rain Wiper' },
  ].sort((a, b) => b.score - a.score);

  return rows.map((row, index) => ({
    ...row,
    rank: index + 1,
  }));
}

export function getSceneAreaSummary(sceneId) {
  const scene = getSceneById(sceneId);
  return {
    area: scene.area,
    stamp: scene.stamp,
  };
}

export { faceAreas };

function getLastSevenDays() {
  const formatter = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    return {
      key,
      label: formatter.format(date),
    };
  });
}
