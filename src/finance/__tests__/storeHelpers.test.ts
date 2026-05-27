import { currentMonthKey } from '../store/useMoneyReviewStore';

describe('currentMonthKey', () => {
  it('returns YYYY-MM for a mid-year date', () => {
    expect(currentMonthKey(new Date('2026-05-15'))).toBe('2026-05');
  });

  it('pads single-digit months', () => {
    expect(currentMonthKey(new Date('2026-03-01'))).toBe('2026-03');
  });

  it('handles December → January rollover', () => {
    expect(currentMonthKey(new Date('2026-12-31'))).toBe('2026-12');
    expect(currentMonthKey(new Date('2027-01-01'))).toBe('2027-01');
  });

  it('handles year boundary at midnight', () => {
    expect(currentMonthKey(new Date('2027-01-01T00:00:00'))).toBe('2027-01');
  });
});
