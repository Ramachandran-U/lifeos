import {
  evaluateComeback,
  COMEBACK_MIN_GAP_DAYS,
  COMEBACK_MAX_GAP_DAYS,
} from '../retention';

const TODAY = '2026-06-10';
const daysAgo = (n: number): string => {
  const d = new Date(`${TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

describe('evaluateComeback — pure gap rule with injected dates', () => {
  test('first-ever open is a welcome, not a comeback', () => {
    expect(evaluateComeback({ lastOpenDay: null, lastComebackDay: null, today: TODAY })).toBeNull();
  });

  test('gap below the floor (2 days) → null', () => {
    expect(
      evaluateComeback({ lastOpenDay: daysAgo(COMEBACK_MIN_GAP_DAYS - 1), lastComebackDay: null, today: TODAY }),
    ).toBeNull();
  });

  test('gap exactly at the floor (3 days) fires', () => {
    expect(
      evaluateComeback({ lastOpenDay: daysAgo(COMEBACK_MIN_GAP_DAYS), lastComebackDay: null, today: TODAY }),
    ).toBe(COMEBACK_MIN_GAP_DAYS);
  });

  test('gap exactly at the ceiling (90 days) fires', () => {
    expect(
      evaluateComeback({ lastOpenDay: daysAgo(COMEBACK_MAX_GAP_DAYS), lastComebackDay: null, today: TODAY }),
    ).toBe(COMEBACK_MAX_GAP_DAYS);
  });

  test('gap beyond the ceiling (91 days) is a fresh start, not a comeback', () => {
    expect(
      evaluateComeback({ lastOpenDay: daysAgo(COMEBACK_MAX_GAP_DAYS + 1), lastComebackDay: null, today: TODAY }),
    ).toBeNull();
  });

  test('dedupe: already handled today → null even with a qualifying gap', () => {
    expect(
      evaluateComeback({ lastOpenDay: daysAgo(7), lastComebackDay: TODAY, today: TODAY }),
    ).toBeNull();
  });

  test("yesterday's mark does not block today's genuine comeback", () => {
    // (Only reachable if storage drifted, but the rule should still be sound.)
    expect(
      evaluateComeback({ lastOpenDay: daysAgo(7), lastComebackDay: daysAgo(1), today: TODAY }),
    ).toBe(7);
  });

  test('garbage stored date → null, never NaN propagation', () => {
    expect(
      evaluateComeback({ lastOpenDay: 'not-a-date', lastComebackDay: null, today: TODAY }),
    ).toBeNull();
  });
});
