/** Returns ISO week number and year for the given date (defaults to today). */
export function getCurrentWeek(date = new Date()): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // make Sunday = 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { week, year: d.getUTCFullYear() };
}

/** Returns ISO date string (YYYY-MM-DD) for the given date. */
export function toISODate(date = new Date()): string {
  return date.toISOString().split('T')[0];
}
