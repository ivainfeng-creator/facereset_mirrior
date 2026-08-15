import { SCENE_IDS } from '../data/scenes.js';
import { getEffectiveLocalDateKey, toLocalDateKey } from './effectiveDate.js';

const DEBUG_HISTORY_DAYS = [
  { day: 1, scores: [56, 48, 61], complete: true },
  { day: 2, scores: [72, 64, 58], complete: true },
  { day: 3, scores: [80, 75, 69], complete: true },
  { day: 4, scores: [88, 61, 23], complete: true },
  { day: 5, scores: [45, 52, 39], complete: false },
];

const DEBUG_SCENE_IDS = [
  SCENE_IDS.whaleDream,
  SCENE_IDS.templeGarden,
  SCENE_IDS.flowerCollector,
];

export function isDebugHistoryEnabled() {
  return import.meta.env.DEV
    && typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('debugHistory') === '1';
}

// This only derives view data for the Challenge screen. It never writes localStorage
// or schedules a cloud sync, and production builds always receive the original habit.
export function withDebugHistory(habit) {
  if (!isDebugHistoryEnabled()) return habit;

  const currentDate = new Date(`${getEffectiveLocalDateKey()}T12:00:00`);
  const programDayByDate = {};
  const history = DEBUG_HISTORY_DAYS.flatMap(({ day, scores, complete }) => {
    const date = new Date(currentDate);
    date.setDate(currentDate.getDate() - (DEBUG_HISTORY_DAYS.length - day));
    const dateKey = toLocalDateKey(date);
    programDayByDate[dateKey] = day;

    return DEBUG_SCENE_IDS.map((sceneId, index) => ({
      id: `debug-history-day-${day}-${sceneId}`,
      date: dateKey,
      programDay: day,
      sceneId,
      score: scores[index],
      // Day 5 intentionally shows all three scores while retaining an unfinished
      // third session, which lets the read-only/current-day UI be tested together.
      completed: complete || index < DEBUG_SCENE_IDS.length - 1,
      isDebugFixture: true,
    }));
  });

  return {
    ...habit,
    history,
    programDayByDate,
  };
}
