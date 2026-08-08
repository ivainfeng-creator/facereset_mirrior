import { getSceneById, TODAY_SCENE_IDS } from '../data/scenes.js';

export const SCENE_MAX_SCORE = 1000;
export const DAILY_TOTAL_MAX_SCORE = TODAY_SCENE_IDS.length * SCENE_MAX_SCORE;

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildDailyPlanSummary(habit, { date = getLocalDateKey() } = {}) {
  const bestByScene = new Map();

  (habit?.history || []).forEach((entry) => {
    if (entry.date !== date || !TODAY_SCENE_IDS.includes(entry.sceneId)) return;
    const current = bestByScene.get(entry.sceneId);
    if (!current || clampScore(entry.score) > clampScore(current.score)) {
      bestByScene.set(entry.sceneId, entry);
    }
  });

  const sceneResults = TODAY_SCENE_IDS.map((sceneId) => {
    const scene = getSceneById(sceneId);
    const entry = bestByScene.get(sceneId);
    return {
      ...entry,
      sceneId,
      sceneTitle: scene.title,
      area: scene.area,
      score: entry ? clampScore(entry.score) : 0,
      completed: Boolean(entry),
    };
  });
  const completed = sceneResults.filter((entry) => entry.completed).length;
  const score = sceneResults.reduce((total, entry) => total + entry.score, 0);

  return {
    type: 'daily-plan',
    date,
    completed,
    total: TODAY_SCENE_IDS.length,
    isComplete: completed === TODAY_SCENE_IDS.length,
    score,
    maxScore: DAILY_TOTAL_MAX_SCORE,
    holdSeconds: sceneResults.reduce(
      (total, entry) => total + Math.max(0, Number(entry.holdSeconds || entry.durationSeconds) || 0),
      0,
    ),
    sceneId: null,
    sceneTitle: 'FULL RESET COMPLETE',
    area: 'ALL 3 SESSIONS',
    sceneResults,
    radar: buildDailyRadar(sceneResults),
  };
}

function buildDailyRadar(sceneResults) {
  const ratios = sceneResults.map((entry) => entry.score / SCENE_MAX_SCORE);
  const [mouth = 0, temples = 0, nose = 0] = ratios;
  const average = ratios.reduce((total, value) => total + value, 0) / Math.max(1, ratios.length);
  const toPercent = (value) => Math.round(Math.max(0, Math.min(1, value)) * 100);

  return [
    { label: 'flowy', value: toPercent(average * 0.55 + mouth * 0.45) },
    { label: 'rhythm', value: toPercent(average * 0.55 + temples * 0.45) },
    { label: 'glowy', value: toPercent(average * 0.6 + nose * 0.4) },
    { label: 'soft', value: toPercent(average * 0.7 + temples * 0.3) },
    { label: 'playful', value: toPercent(average * 0.5 + mouth * 0.25 + nose * 0.25) },
  ];
}

function clampScore(score) {
  const numeric = Number(score);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(SCENE_MAX_SCORE, Math.round(numeric)));
}
