// Content pools for the Share Card. Slogans are hand-authored, never generated at runtime.
// Each slogan is an intentional two-line pair (not relying on CSS auto-wrap), so the
// headline layout is designed rather than incidental.
export const SHARE_CARD_SLOGANS = [
  ['FACE RESTED.', 'MOOD BOOSTED.'],
  ['PRESSED. RELEASED.', 'RESET.'],
  ['LESS TENSE,', 'MORE ME.'],
  ['CALM FACE,', 'CLEAR MIND.'],
  ['TENSION OUT.', 'GLOW ON.'],
  ['RESET COMPLETE.', 'SLAY ON.'],
  ['FACE FRESH.', 'BRAIN FED.'],
  ['THREE MOVES.', 'BIG RELIEF.'],
  ['UNCRUNCH. UNWIND.', 'UNLOCK.'],
  ['POWERED BY', 'TINY BREAKS.'],
];

export const SHARE_CARD_SUBTITLE = 'Face lighter. Mind brighter.';

export const SHARE_CARD_MASCOTS = [
  '/assets/landing/bluecloud_openmouth_1.png',
  '/assets/landing/bluecloud_relax_1.png',
  '/assets/landing/bluecloud_blow_1.png',
];

// The three photo captions, keyed by session position (not scene identity): the
// 7-day schedule rotates through six different scenes (see scheduleConfig.js),
// so a per-sceneId label would go blank on any day whose lineup isn't exactly
// [whaleDream, templeGarden, flowerCollector]. Position-based labels guarantee
// all three captions always show, for every Program Day.
export const SHARE_CARD_SESSION_LABELS = ['FOCUS', 'PRESS', 'RELEASE'];

export function getShareCardSessionLabel(sessionIndex) {
  return SHARE_CARD_SESSION_LABELS[sessionIndex] || '';
}

export function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}
