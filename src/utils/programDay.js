export const FIRST_PROGRAM_DAY = 1;

export function isValidProgramDay(value) {
  return Number.isInteger(Number(value)) && Number(value) >= FIRST_PROGRAM_DAY;
}

export function normalizeProgramDay(value, fallback = FIRST_PROGRAM_DAY) {
  return isValidProgramDay(value) ? Number(value) : fallback;
}

export function getProgramDayForDate({ programDayByDate = {}, date, fallback = FIRST_PROGRAM_DAY } = {}) {
  if (!date) return fallback;
  return normalizeProgramDay(programDayByDate?.[date], fallback);
}

export function getProgramDayForActivityDate({ programDayByDate = {}, history = [], date } = {}) {
  if (!date) return FIRST_PROGRAM_DAY;
  return assignProgramDayForActivity({ programDayByDate, history, date }).programDay;
}

// A screen may show the latest assigned Program Day, but viewing the app must not
// manufacture the next day before a completed session assigns it.
export function getCurrentProgramDay({ programDayByDate = {}, history = [], date } = {}) {
  const assignedDay = getProgramDayForDate({
    programDayByDate,
    date,
    fallback: null,
  });
  if (isValidProgramDay(assignedDay)) return Number(assignedDay);

  const historyDay = (history || []).find((entry) => (
    entry?.date === date && isValidProgramDay(entry.programDay)
  ))?.programDay;
  if (isValidProgramDay(historyDay)) return Number(historyDay);

  return Math.max(
    FIRST_PROGRAM_DAY,
    ...Object.values(programDayByDate || {}).map(Number).filter(isValidProgramDay),
    ...(history || []).map((entry) => Number(entry?.programDay)).filter(isValidProgramDay),
  );
}

export function assignProgramDayForActivity({ programDayByDate = {}, history = [], date } = {}) {
  const nextMap = normalizeProgramDayMap(programDayByDate);
  if (!date) {
    return { programDay: FIRST_PROGRAM_DAY, programDayByDate: nextMap };
  }

  if (isValidProgramDay(nextMap[date])) {
    return { programDay: nextMap[date], programDayByDate: nextMap };
  }

  const highestAssignedDay = Math.max(
    FIRST_PROGRAM_DAY - 1,
    ...Object.values(nextMap).map(Number).filter(isValidProgramDay),
    ...(history || []).map((entry) => Number(entry?.programDay)).filter(isValidProgramDay),
  );
  const programDay = highestAssignedDay + 1;

  return {
    programDay,
    programDayByDate: {
      ...nextMap,
      [date]: programDay,
    },
  };
}

export function normalizeProgramDayHistory({ history = [], programDayByDate = {}, legacyProgramDay = FIRST_PROGRAM_DAY } = {}) {
  const nextMap = normalizeProgramDayMap(programDayByDate);
  const normalizedHistory = (history || []).map((entry) => {
    if (!entry?.date) return entry;
    const existingDay = getProgramDayForDate({
      programDayByDate: nextMap,
      date: entry.date,
      fallback: null,
    });
    const programDay = normalizeProgramDay(existingDay, normalizeProgramDay(entry.programDay, legacyProgramDay));
    nextMap[entry.date] = programDay;
    return { ...entry, programDay };
  });

  return { history: normalizedHistory, programDayByDate: nextMap };
}

function normalizeProgramDayMap(programDayByDate = {}) {
  return Object.fromEntries(
    Object.entries(programDayByDate || {}).filter(([date, programDay]) => Boolean(date) && isValidProgramDay(programDay)),
  );
}
