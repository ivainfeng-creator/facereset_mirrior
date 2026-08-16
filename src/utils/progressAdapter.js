import { localProgressAdapter } from './localProgressAdapter.js';
import { viverseProgressAdapter } from './viverseProgressAdapter.js';
import { initializeSupabaseProgress, queueSupabaseSession } from './supabaseProgressAdapter.js';

export const PROGRESS_PROVIDER = {
  local: 'local',
  viverse: 'viverse',
};

export const activeProgressProvider = PROGRESS_PROVIDER.local;
export const progressAdapters = {
  [PROGRESS_PROVIDER.local]: localProgressAdapter,
  [PROGRESS_PROVIDER.viverse]: viverseProgressAdapter,
};

export const activeAdapter = progressAdapters[activeProgressProvider] || localProgressAdapter;

export function loadHabitProgress() {
  return activeAdapter.loadHabit();
}

export function saveSessionResult(result, { onMerged } = {}) {
  const saved = activeAdapter.saveSessionResult(result);
  // Deliberately do not await cloud work: gameplay uses localStorage immediately.
  void queueSupabaseSession(saved, { onMerged });
  return {
    provider: activeProgressProvider,
    saved,
  };
}

export function initializeProgressSync({ onMerged } = {}) {
  return initializeSupabaseProgress({ onMerged });
}

export function loadPassportProgress(habit = loadHabitProgress()) {
  return activeAdapter.loadPassport(habit);
}

export function loadLeaderboardRows(habit = loadHabitProgress()) {
  return activeAdapter.loadLeaderboard(habit);
}

export function submitLeaderboardScore(result, habit = loadHabitProgress()) {
  return activeAdapter.submitLeaderboardScore(result, habit);
}

export function getPlayerIdentity(habit = loadHabitProgress()) {
  return activeAdapter.getIdentity(habit);
}

export function hasSeenGuide(sceneId) {
  return activeAdapter.hasSeenGuide?.(sceneId) ?? localProgressAdapter.hasSeenGuide(sceneId);
}

export function markGuideSeen(sceneId) {
  return activeAdapter.markGuideSeen?.(sceneId) ?? localProgressAdapter.markGuideSeen(sceneId);
}

export function loadProgressDebugSnapshot() {
  return activeAdapter.debug?.loadSnapshot?.() ?? localProgressAdapter.debug.loadSnapshot();
}

export function clearAllProgress() {
  return activeAdapter.debug?.clearAll?.() ?? localProgressAdapter.debug.clearAll();
}

export function clearTodayProgressDebug() {
  return activeAdapter.debug?.clearToday?.() ?? localProgressAdapter.debug.clearToday();
}

export function seedProgressDebug(days = 7) {
  return activeAdapter.debug?.seed?.({ days }) ?? localProgressAdapter.debug.seed({ days });
}

export function seedSessionOneCompleteDebug() {
  return activeAdapter.debug?.seedSessionOneComplete?.()
    ?? localProgressAdapter.debug.seedSessionOneComplete();
}

export function seedDayOneCompleteDebug() {
  return activeAdapter.debug?.seedDayOneComplete?.()
    ?? localProgressAdapter.debug.seedDayOneComplete();
}
