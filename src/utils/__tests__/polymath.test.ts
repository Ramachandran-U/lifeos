import { format, startOfWeek, addDays, subDays } from 'date-fns';
import {
  weeklyMinutesByInterest,
  actualForInterest,
  progressRatio,
} from '../polymath';

const ANCHOR = new Date(2026, 3, 22); // Wed Apr 22, 2026
const mondayOfWeek = startOfWeek(ANCHOR, { weekStartsOn: 1 });
const d = (date: Date) => format(date, 'yyyy-MM-dd');

describe('weeklyMinutesByInterest', () => {
  it('sums minutes per interest inside the ISO week', () => {
    const log = [
      { interestId: 'a', date: d(mondayOfWeek), minutesSpent: 30 },
      { interestId: 'a', date: d(addDays(mondayOfWeek, 2)), minutesSpent: 20 },
      { interestId: 'b', date: d(addDays(mondayOfWeek, 1)), minutesSpent: 45 },
    ];
    expect(weeklyMinutesByInterest(log, ANCHOR)).toEqual({ a: 50, b: 45 });
  });

  it('excludes entries from previous week', () => {
    const log = [
      { interestId: 'a', date: d(subDays(mondayOfWeek, 1)), minutesSpent: 999 },
      { interestId: 'a', date: d(addDays(mondayOfWeek, 3)), minutesSpent: 10 },
    ];
    expect(weeklyMinutesByInterest(log, ANCHOR)).toEqual({ a: 10 });
  });

  it('returns empty object for empty log', () => {
    expect(weeklyMinutesByInterest([], ANCHOR)).toEqual({});
  });
});

describe('actualForInterest', () => {
  it('returns 0 when interest has no entries', () => {
    expect(actualForInterest('x', [], ANCHOR)).toBe(0);
  });
  it('sums only the requested interest', () => {
    const log = [
      { interestId: 'a', date: d(mondayOfWeek), minutesSpent: 15 },
      { interestId: 'b', date: d(mondayOfWeek), minutesSpent: 99 },
    ];
    expect(actualForInterest('a', log, ANCHOR)).toBe(15);
  });
});

describe('progressRatio', () => {
  it('returns 0 when target is 0', () => {
    expect(progressRatio(50, 0)).toBe(0);
  });
  it('returns a normal ratio', () => {
    expect(progressRatio(60, 120)).toBe(0.5);
  });
  it('caps at 1.5 on overshoot', () => {
    expect(progressRatio(600, 100)).toBe(1.5);
  });
});
