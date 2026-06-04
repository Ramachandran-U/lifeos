/**
 * Small date-key helpers shared by the planning-context + finance modules, so
 * the same logic isn't re-implemented in each. Pure.
 */

/** A Date's LOCAL calendar date as YYYY-MM-DD (no UTC shift). */
export function localYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Local calendar date as YYYY-MM-DD (how transaction/calendar dates are keyed). */
export function todayKey(now: Date = new Date()): string {
  return localYmd(now);
}

/**
 * Whole UTC days since the epoch for a YYYY-MM-DD string, or null if malformed.
 * Timezone-invariant, so day-difference math is stable across machines.
 */
export function isoToUtcDays(iso: string): number | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000;
}
