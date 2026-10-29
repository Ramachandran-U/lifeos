/**
 * Regression: the reflection streak must count a reflection logged after local
 * midnight in a timezone ahead of UTC.
 *
 * `app/evening-reflect.tsx` writes a reflection under its LOCAL calendar day
 * (date-fns `format`), and the web store filters by a LOCAL cutoff. But
 * `getReflectionStreak()` used to walk the streak with
 * `d.toISOString().slice(0, 10)` — a UTC key. In IST (UTC+5:30) every instant
 * between 00:00 and 05:30 local formats as YESTERDAY in UTC, so a reflection
 * logged at, say, 02:00 did not count: the walk started one day behind and
 * broke immediately on the freshly-written row.
 *
 * User-visible symptom: "I just reflected and my streak still says 0."
 *
 * Pinned to 2026-09-14T20:30:00Z == 2026-09-15 02:00 IST, the window where the
 * old code was wrong. Forces the web branch (that is the build that ships to
 * Cloudflare Pages, and the branch that read local-keyed rows with a UTC walk).
 */

process.env.TZ = 'Asia/Kolkata';

jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('@/sync/runtime', () => ({ recordMutation: jest.fn() }));

beforeAll(() => {
  const store: Record<string, string> = {};
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
  };
});

import { upsertReflection, getReflectionStreak } from '../reflections';
import { localYmd } from '@/utils/dateKeys';

/** 02:00 IST on 2026-09-15 — inside the 00:00–05:30 window the old key got wrong. */
const AFTER_LOCAL_MIDNIGHT_IST = new Date('2026-09-14T20:30:00Z');

function write(date: string): void {
  upsertReflection({
    date,
    mood: 4,
    blockReviews: {},
    tweakAccepted: null,
    tweakPayload: null,
  });
}

describe('getReflectionStreak — timezone boundary (IST)', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.useFakeTimers();
    jest.setSystemTime(AFTER_LOCAL_MIDNIGHT_IST);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('the fixture really is 02:00 on the NEXT local day (guards the test itself)', () => {
    const now = new Date();
    expect(now.getTimezoneOffset()).toBe(-330); // IST
    expect(localYmd(now)).toBe('2026-09-15');
    // The bug this test defends against, stated explicitly:
    expect(now.toISOString().slice(0, 10)).toBe('2026-09-14');
  });

  it("counts today's reflection when it was logged after local midnight", () => {
    write('2026-09-15'); // today, local — written at 02:00 IST
    write('2026-09-14');
    write('2026-09-13');

    // Old (UTC-keyed) walk started at 2026-09-14 and returned 2.
    expect(getReflectionStreak()).toBe(3);
  });

  it('a lone post-midnight reflection is a streak of 1, not 0', () => {
    write('2026-09-15');

    expect(getReflectionStreak()).toBe(1);
  });

  it('still breaks the streak correctly on a genuine gap', () => {
    write('2026-09-15');
    write('2026-09-13'); // 14th missing

    expect(getReflectionStreak()).toBe(1);
  });
});
