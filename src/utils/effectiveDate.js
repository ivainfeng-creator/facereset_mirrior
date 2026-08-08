const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

let hasWarnedAboutInvalidDebugDate = false;

export function toLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isValidLocalDateKey(value) {
  if (typeof value !== 'string') return false;

  const match = value.match(LOCAL_DATE_PATTERN);
  if (!match) return false;

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const localDate = new Date(year, month - 1, day);

  return localDate.getFullYear() === year
    && localDate.getMonth() === month - 1
    && localDate.getDate() === day;
}

export function getEffectiveLocalDateKey(now = new Date()) {
  const realLocalDate = toLocalDateKey(now);

  // Vite replaces DEV at build time, so production never reads debugDate.
  if (!import.meta.env.DEV || typeof window === 'undefined') return realLocalDate;

  const debugDate = new URLSearchParams(window.location.search).get('debugDate');
  if (!debugDate) return realLocalDate;
  if (isValidLocalDateKey(debugDate)) return debugDate;

  if (!hasWarnedAboutInvalidDebugDate) {
    hasWarnedAboutInvalidDebugDate = true;
    console.warn('[Face Reset] Ignoring invalid debugDate. Use a real YYYY-MM-DD local date.', { debugDate });
  }

  return realLocalDate;
}

export function getActiveDebugDate() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const debugDate = new URLSearchParams(window.location.search).get('debugDate');
  return isValidLocalDateKey(debugDate) ? debugDate : null;
}
