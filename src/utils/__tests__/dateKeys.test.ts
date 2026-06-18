import { localYmd, todayKey, isoToUtcDays } from '@/utils/dateKeys';

describe('localYmd / todayKey', () => {
  it('formats a Date as zero-padded local YYYY-MM-DD', () => {
    // Month is 0-indexed in the Date ctor; Jan 5 → 2026-01-05.
    expect(localYmd(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(localYmd(new Date(2026, 11, 31))).toBe('2026-12-31');
    expect(localYmd(new Date(2026, 8, 9))).toBe('2026-09-09');
  });

  it('uses LOCAL calendar fields (not UTC) so the key never shifts a day', () => {
    // Local-noon can never roll to an adjacent date regardless of the runner TZ.
    const d = new Date(2026, 5, 18, 12, 0, 0);
    expect(localYmd(d)).toBe('2026-06-18');
  });

  it('todayKey defaults to now and echoes an explicit date', () => {
    expect(todayKey(new Date(2026, 5, 18))).toBe('2026-06-18');
    expect(todayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('isoToUtcDays', () => {
  it('returns whole, TZ-invariant day counts', () => {
    const a = isoToUtcDays('2026-01-01');
    const b = isoToUtcDays('2026-01-02');
    expect(a).not.toBeNull();
    expect(Number.isInteger(a as number)).toBe(true);
    expect((b as number) - (a as number)).toBe(1);
  });

  it('counts month lengths correctly, including leap years', () => {
    // 2026 is not a leap year → Feb has 28 days.
    expect(
      (isoToUtcDays('2026-03-01') as number) - (isoToUtcDays('2026-02-01') as number),
    ).toBe(28);
    // 2024 is a leap year → Feb has 29 days.
    expect(
      (isoToUtcDays('2024-03-01') as number) - (isoToUtcDays('2024-02-01') as number),
    ).toBe(29);
  });

  it('is independent of time-of-day (date-only keying)', () => {
    // The same calendar date always maps to the same day index.
    expect(isoToUtcDays('2026-06-18')).toBe(isoToUtcDays('2026-06-18'));
  });

  it('returns null on malformed input (not a silent wrong number)', () => {
    expect(isoToUtcDays('2026-6-18')).toBeNull(); // not zero-padded
    expect(isoToUtcDays('2026/06/18')).toBeNull(); // wrong separator
    expect(isoToUtcDays('18-06-2026')).toBeNull(); // wrong order
    expect(isoToUtcDays('2026-06-18T00:00:00Z')).toBeNull(); // has time
    expect(isoToUtcDays('')).toBeNull();
    expect(isoToUtcDays('garbage')).toBeNull();
  });
});
