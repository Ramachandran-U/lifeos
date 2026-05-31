/**
 * Format a minute count for human display.
 *
 * Under an hour → plain minutes ("45 min"). An hour or more → "Xh Ymin"
 * ("3h 35min"), dropping the minute part when it's zero ("2h"). Negatives and
 * fractional inputs are clamped/rounded so callers can pass raw aggregates.
 */
export function formatDuration(totalMinutes: number): string {
  const mins = Math.max(0, Math.round(totalMinutes));
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remainder = mins % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}min`;
}
