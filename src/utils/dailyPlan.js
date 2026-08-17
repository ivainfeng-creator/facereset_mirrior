import { getDailySceneIdsForProgramDay, getSceneById } from '../data/scenes.js';
import { DAILY_SCENE_COUNT, SCENE_SCORE_MAX, clampSceneScore } from './scoring.js';
import { getEffectiveLocalDateKey, toLocalDateKey } from './effectiveDate.js';
import { getCurrentProgramDay } from './programDay.js';

export const SCENE_MAX_SCORE = SCENE_SCORE_MAX;
// Every Program Day is required to define exactly DAILY_SCENE_COUNT scenes
// (enforced by scheduleConfig.js's dev-only validation), so this stays a
// flat constant rather than varying per day.
export const DAILY_TOTAL_MAX_SCORE = DAILY_SCENE_COUNT * SCENE_MAX_SCORE;

export const getLocalDateKey = toLocalDateKey;

export function buildDailyPlanSummary(habit, { date = getEffectiveLocalDateKey() } = {}) {
  const programDay = getCurrentProgramDay({
    programDayByDate: habit?.programDayByDate,
    history: habit?.history,
    date,
  });
  const todaySceneIds = getDailySceneIdsForProgramDay(programDay);
  const bestByScene = new Map();

  (habit?.history || []).forEach((entry) => {
    if (entry.date !== date || !todaySceneIds.includes(entry.sceneId)) return;
    const current = bestByScene.get(entry.sceneId);
    if (!current || clampScore(entry.score) > clampScore(current.score)) {
      bestByScene.set(entry.sceneId, entry);
    }
  });

  const sceneResults = todaySceneIds.map((sceneId) => {
    const scene = getSceneById(sceneId);
    const entry = bestByScene.get(sceneId);
    return {
      ...entry,
      sceneId,
      sceneTitle: scene.title,
      area: scene.area,
      score: entry ? clampScore(entry.score) : 0,
      completed: Boolean(entry) && entry.completed !== false,
    };
  });
  const completed = sceneResults.filter((entry) => entry.completed).length;
  const score = sceneResults.reduce((total, entry) => total + entry.score, 0);

  return {
    type: 'daily-plan',
    date,
    programDay,
    completed,
    total: todaySceneIds.length,
    isComplete: completed === todaySceneIds.length,
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

export function getCompletedProgramDays(habit) {
  const scenesByDate = new Map();

  (habit?.history || []).forEach((entry) => {
    if (!entry?.date || entry.completed === false) return;
    const completedScenes = scenesByDate.get(entry.date) || new Set();
    completedScenes.add(entry.sceneId);
    scenesByDate.set(entry.date, completedScenes);
  });

  const completedProgramDays = new Set();

  scenesByDate.forEach((completedScenes, date) => {
    const programDay = getCurrentProgramDay({
      programDayByDate: habit?.programDayByDate,
      history: habit?.history,
      date,
    });
    const scheduledSceneIds = getDailySceneIdsForProgramDay(programDay);
    const matchedCount = scheduledSceneIds.filter((sceneId) => completedScenes.has(sceneId)).length;
    if (matchedCount === scheduledSceneIds.length) completedProgramDays.add(programDay);
  });

  return completedProgramDays;
}

// Cloud daily_progress/session_results are merged into habit.history during startup
// hydration, so this reads the same merged cache whether the user is online or offline.
export function buildProgramDayPlanSummary(habit, programDay) {
  const currentPlan = buildDailyPlanSummary(habit);
  const selectedProgramDay = Number(programDay);

  if (!Number.isInteger(selectedProgramDay) || selectedProgramDay < 1 || selectedProgramDay === currentPlan.programDay) {
    return currentPlan;
  }

  const dates = new Set();
  Object.entries(habit?.programDayByDate || {}).forEach(([date, assignedDay]) => {
    if (Number(assignedDay) === selectedProgramDay) dates.add(date);
  });
  (habit?.history || []).forEach((entry) => {
    if (entry?.date && Number(entry.programDay) === selectedProgramDay) dates.add(entry.date);
  });

  const matchingPlans = [...dates]
    .map((date) => buildDailyPlanSummary(habit, { date }))
    .filter((plan) => plan.programDay === selectedProgramDay)
    .sort((left, right) => {
      if (left.isComplete !== right.isComplete) return Number(right.isComplete) - Number(left.isComplete);
      return right.date.localeCompare(left.date);
    });

  return matchingPlans[0] || currentPlan;
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
  return clampSceneScore(score);
}
