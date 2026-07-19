const STORAGE_KEY = 'face-reset-mirror-habit';

const defaultHabit = {
  streak: 0,
  latestScore: null,
  latestDate: null,
  history: [],
};

const todayKey = () => new Date().toISOString().slice(0, 10);

const dateDiffDays = (fromDate, toDate) => {
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  return Math.round((to - from) / 86400000);
};

export function loadHabit() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? { ...defaultHabit, ...JSON.parse(stored) } : defaultHabit;
  } catch {
    return defaultHabit;
  }
}

export function saveResult(result) {
  const current = loadHabit();
  const date = todayKey();
  const previousDate = current.latestDate;
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
    date,
    streak,
  };

  const nextHabit = {
    streak,
    latestScore: result.score,
    latestDate: date,
    history: [saved, ...(current.history || [])].slice(0, 14),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextHabit));
  return saved;
}
