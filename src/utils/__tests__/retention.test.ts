import { _internal } from '../retention';

describe('retention.daysSince', () => {
  test('returns 0 for null install date', () => {
    expect(_internal.daysSince(null)).toBe(0);
  });

  test('returns 0 for malformed install date', () => {
    expect(_internal.daysSince('not-a-date')).toBe(0);
  });

  test('returns 0 for same-day install', () => {
    const now = new Date('2026-05-30T15:00:00Z');
    expect(_internal.daysSince('2026-05-30T08:00:00Z', now)).toBe(0);
  });

  test('returns 7 after a week', () => {
    const now = new Date('2026-06-06T08:00:00Z');
    expect(_internal.daysSince('2026-05-30T08:00:00Z', now)).toBe(7);
  });

  test('floors partial days', () => {
    const now = new Date('2026-05-31T07:00:00Z'); // 23h after install
    expect(_internal.daysSince('2026-05-30T08:00:00Z', now)).toBe(0);
  });

  test('never returns negative for future install dates', () => {
    const now = new Date('2026-05-30T00:00:00Z');
    expect(_internal.daysSince('2026-06-30T00:00:00Z', now)).toBe(0);
  });
});
