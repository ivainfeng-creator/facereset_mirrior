export const RAW_SCENE_SCORE_MAX = 1000;
export const SCENE_SCORE_MAX = 100;
export const DAILY_SCENE_COUNT = 3;
export const DAILY_SCORE_MAX = SCENE_SCORE_MAX * DAILY_SCENE_COUNT;
export const SCORE_CURVE_EXPONENT = 1.3;

export function clampRawSceneScore(score) {
  const numeric = Number(score);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(RAW_SCENE_SCORE_MAX, numeric));
}

export function clampSceneScore(score) {
  const numeric = Number(score);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(SCENE_SCORE_MAX, Math.round(numeric)));
}

// Converts the internal interaction score into the one canonical score used by UI and storage.
export function toFinalSceneScore(rawScore) {
  const normalized = clampRawSceneScore(rawScore) / RAW_SCENE_SCORE_MAX;
  return clampSceneScore(SCENE_SCORE_MAX * Math.pow(normalized, SCORE_CURVE_EXPONENT));
}

export function migrateLegacyRawSceneScore(rawScore) {
  return toFinalSceneScore(rawScore);
}
