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

// Inverse of toFinalSceneScore. Scenes that award a fixed number of points on
// the canonical 0-100 scale need to translate that back into an internal score,
// and the curve exponent must not be re-implemented at the call site.
export function toRawSceneScore(finalScore) {
  const normalized = clampSceneScore(finalScore) / SCENE_SCORE_MAX;
  return clampRawSceneScore(RAW_SCENE_SCORE_MAX * Math.pow(normalized, 1 / SCORE_CURVE_EXPONENT));
}

// Adds `finalPoints` on the canonical 0-100 scale to an internal score. The
// curve is convex, so a flat final-scale award is not a flat internal award -
// this converts, adds, and converts back. Never lowers the score.
export function awardFinalScenePoints(rawScore, finalPoints) {
  const current = toFinalSceneScore(rawScore);
  const rewarded = clampSceneScore(current + finalPoints);
  return Math.max(clampRawSceneScore(rawScore), toRawSceneScore(rewarded));
}

export function migrateLegacyRawSceneScore(rawScore) {
  return toFinalSceneScore(rawScore);
}
