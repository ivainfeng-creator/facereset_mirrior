// Display-only starter rows for the Program Day leaderboard.
// These entries exist purely to keep an early-launch leaderboard from looking empty.
// They are never persisted, never submitted, and never counted in real scoring:
// every consumer must go through buildLeaderboardDisplayRows() in utils/leaderboardDisplay.js.

// How many rows each early Program Day should show once real users and starter rows
// are combined. Program Days beyond this map only ever show starter rows when the
// real leaderboard is completely empty.
const SEED_TARGET_ROWS_BY_DAY = Object.freeze({
  1: 10,
  2: 8,
  3: 6,
  4: 4,
});

// Program Day 5+ falls back to a fixed pair of starter rows, and only when empty.
const LATER_DAY_SEED_TARGET_ROWS = 2;

function seedRow(name, score) {
  return Object.freeze({ name, score, isSeed: true });
}

const SEED_ROWS_BY_DAY = Object.freeze({
  1: Object.freeze([
    seedRow('Mika88', 205),
    seedRow('sora.27', 198),
    seedRow('Lani_102', 192),
    seedRow('Kai77', 187),
    seedRow('Yuna1996', 181),
    seedRow('Nori_5', 176),
    seedRow('tom_a13', 170),
    seedRow('MinaLee', 164),
    seedRow('Remy_21', 158),
    seedRow('aki.03', 151),
  ]),
  2: Object.freeze([
    seedRow('JessK_91', 199),
    seedRow('LeoSun7', 192),
    seedRow('sora.27', 186),
    seedRow('Mika88', 180),
    seedRow('MayChen', 174),
    seedRow('Yuna1996', 168),
    seedRow('Nori_5', 162),
    seedRow('rina.6', 155),
  ]),
  3: Object.freeze([
    seedRow('Noah_808', 194),
    seedRow('Yuna1996', 187),
    seedRow('Lani_102', 181),
    seedRow('tom_a13', 174),
    seedRow('Mika88', 167),
    seedRow('Remy_21', 160),
  ]),
  4: Object.freeze([
    seedRow('MinaLee', 188),
    seedRow('Kai77', 180),
    seedRow('JessK_91', 172),
    seedRow('aki.03', 164),
  ]),
});

const LATER_DAY_SEED_ROWS = Object.freeze([
  seedRow('LeoSun7', 181),
  seedRow('Nori_5', 169),
]);

const EMPTY_SEED_ROWS = Object.freeze([]);

function toProgramDay(programDay) {
  const value = Number(programDay);
  return Number.isInteger(value) && value >= 1 ? value : null;
}

/**
 * Fixed starter rows for a Program Day, highest score first.
 * Always returns the same rows for the same Program Day.
 */
export function getLeaderboardSeedRows(programDay) {
  const day = toProgramDay(programDay);
  if (!day) return EMPTY_SEED_ROWS;
  return SEED_ROWS_BY_DAY[day] || LATER_DAY_SEED_ROWS;
}

/**
 * How many starter rows may be appended for a Program Day, given how many real
 * users already rank there. Program Day 5+ stays untouched once anyone is real.
 */
export function getLeaderboardSeedCount(programDay, realRowCount = 0) {
  const day = toProgramDay(programDay);
  if (!day) return 0;
  const realCount = Math.max(0, Number(realRowCount) || 0);
  const target = SEED_TARGET_ROWS_BY_DAY[day];
  if (target) return Math.max(0, target - realCount);
  return realCount > 0 ? 0 : LATER_DAY_SEED_TARGET_ROWS;
}
