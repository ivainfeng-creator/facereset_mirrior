import { SCENE_IDS } from './sceneIds.js';
import { DAILY_SCENE_COUNT } from '../utils/scoring.js';

// ---------------------------------------------------------------------------
// SCENE SCHEDULE — the single source of truth for which 3 scenes run on each
// Program Day, and in what order.
//
// This is manually edited. Nothing in the app randomizes, reshuffles, or
// auto-optimizes these lists — the array order IS the session order.
//
// Every consumer resolves "today's scenes" through getScheduledSceneIds(
// programDay), so changing an entry here is the only edit needed — no other
// file duplicates this list.
//
// The Day 1-7 lineups below are the finalized combinations. Day 1 and Day 2
// are curated for the competition/demo; Day 3-7 are arranged so no two days
// share the same 3-scene combination (order-independent) and all six
// scheduled scenes are spread across the cycle — whaleDream, templeGarden and
// flowerCollector appear 4x each, penguinFishing, bubbleGumBunny and
// lemonSqueeze 3x each, filling all 21 slots. Note whaleDream2 is registered
// in scenes.js but intentionally not scheduled here.
//
// CAUTION: if a Program Day someone has already started/completed has its
// scene IDs changed here later, their existing history/session results for
// that day (keyed by date + sceneId, not by "day schedule version") will be
// reinterpreted against the new lineup — e.g. a scene they completed may no
// longer count toward that day's 3-scene total, or the plan may show a scene
// they never played. No schedule versioning/migration exists for this yet;
// changing a day's scenes after users have played it is safe to do (nothing
// crashes and nothing else in the app is affected) but changes how that
// day's past progress is read. Prefer finalizing a day's lineup before it
// ships rather than editing it after users have played it.
// ---------------------------------------------------------------------------

export const FIRST_SCHEDULED_DAY = 1;
export const LAST_SCHEDULED_DAY = 7;

export const SCENE_SCHEDULE = Object.freeze({
  1: [SCENE_IDS.whaleDream, SCENE_IDS.penguinFishing, SCENE_IDS.flowerCollector],
  2: [SCENE_IDS.templeGarden, SCENE_IDS.bubbleGumBunny, SCENE_IDS.lemonSqueeze],
  3: [SCENE_IDS.whaleDream, SCENE_IDS.templeGarden, SCENE_IDS.penguinFishing],
  4: [SCENE_IDS.flowerCollector, SCENE_IDS.bubbleGumBunny, SCENE_IDS.lemonSqueeze],
  5: [SCENE_IDS.whaleDream, SCENE_IDS.bubbleGumBunny, SCENE_IDS.flowerCollector],
  6: [SCENE_IDS.templeGarden, SCENE_IDS.penguinFishing, SCENE_IDS.lemonSqueeze],
  7: [SCENE_IDS.whaleDream, SCENE_IDS.templeGarden, SCENE_IDS.flowerCollector],
});

const VALID_SCENE_IDS = new Set(Object.values(SCENE_IDS));

// Resolves the ordered scene ID list for a given Program Day. Days beyond
// LAST_SCHEDULED_DAY are not part of this 7-day program's schedule and are
// not auto-cycled back to Day 1 — they defensively fall back to Day 7's
// lineup (with a dev-only warning) rather than throwing or returning nothing.
export function getScheduledSceneIds(programDay) {
  const requestedDay = Number(programDay);
  let resolvedDay = Number.isInteger(requestedDay) && requestedDay >= FIRST_SCHEDULED_DAY
    ? requestedDay
    : FIRST_SCHEDULED_DAY;

  if (resolvedDay > LAST_SCHEDULED_DAY) {
    if (import.meta.env?.DEV) {
      console.warn(
        `[scheduleConfig] Program Day ${resolvedDay} has no configured schedule `
        + `(only Day ${FIRST_SCHEDULED_DAY}-${LAST_SCHEDULED_DAY} are defined). `
        + `Falling back to Day ${LAST_SCHEDULED_DAY}'s scenes.`,
      );
    }
    resolvedDay = LAST_SCHEDULED_DAY;
  }

  return SCENE_SCHEDULE[resolvedDay] || SCENE_SCHEDULE[FIRST_SCHEDULED_DAY];
}

// Dev-only, warn-only validation. Never mutates SCENE_SCHEDULE.
export function validateSceneSchedule() {
  const duplicateComboGroups = new Map();

  Object.entries(SCENE_SCHEDULE).forEach(([day, sceneIds]) => {
    if (!Array.isArray(sceneIds) || sceneIds.length !== DAILY_SCENE_COUNT) {
      console.warn(
        `[scheduleConfig] Day ${day} must define exactly ${DAILY_SCENE_COUNT} scenes, `
        + `found ${Array.isArray(sceneIds) ? sceneIds.length : 0}.`,
      );
      return;
    }

    const duplicatesWithinDay = sceneIds.filter((id, index) => sceneIds.indexOf(id) !== index);
    if (duplicatesWithinDay.length) {
      console.warn(`[scheduleConfig] Day ${day} has duplicate scene IDs: ${sceneIds.join(', ')}.`);
    }

    const invalidIds = sceneIds.filter((id) => !VALID_SCENE_IDS.has(id));
    if (invalidIds.length) {
      console.warn(`[scheduleConfig] Day ${day} references unknown scene ID(s): ${invalidIds.join(', ')}.`);
    }

    const comboKey = [...sceneIds].sort().join('|');
    const days = duplicateComboGroups.get(comboKey) || [];
    days.push(day);
    duplicateComboGroups.set(comboKey, days);
  });

  // Aggregate into a single warning so a temporary all-days-identical
  // placeholder schedule doesn't spam the console with one line per pair.
  const duplicateGroups = [...duplicateComboGroups.values()].filter((days) => days.length > 1);
  if (duplicateGroups.length) {
    const summary = duplicateGroups.map((days) => `[Day ${days.join(', Day ')}]`).join(', ');
    console.warn(
      '[scheduleConfig] Multiple Program Days share the exact same 3-scene combination '
      + `(order-independent): ${summary}. Expected while the schedule still uses temporary `
      + 'defaults — update SCENE_SCHEDULE in src/data/scheduleConfig.js with the final lineups.',
    );
  }
}

if (import.meta.env?.DEV) {
  validateSceneSchedule();
}
