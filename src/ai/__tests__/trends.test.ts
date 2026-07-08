/**
 * Trend math (pure) + the storage-bound assemblers behind the agent's trend
 * tools (flag `agent_trend_tools`).
 */
jest.mock('@/db/queries/health', () => ({ getSleepSeries: jest.fn(() => []) }));
jest.mock('@/db/queries/reflections', () => ({ getMoodSeries: jest.fn(() => []) }));
jest.mock('@/db/queries/behaviour', () => ({ getEventsLastNDays: jest.fn(() => []) }));

import {
  summarizeSeries,
  weekStart,
  bucketByWeek,
  buildSleepTrend,
  buildMoodTrend,
  buildCompletionTrend,
} from '../agent/trends';
import { getSleepSeries } from '@/db/queries/health';
import { getMoodSeries } from '@/db/queries/reflections';
import { getEventsLastNDays } from '@/db/queries/behaviour';

const mSleep = getSleepSeries as jest.Mock;
const mMood = getMoodSeries as jest.Mock;
const mEvents = getEventsLastNDays as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('summarizeSeries', () => {
  it('empty series is flat with null average', () => {
    expect(summarizeSeries([])).toEqual({ count: 0, average: null, direction: 'flat', changePct: null });
  });

  it('short series (<4) reports the average but no direction', () => {
    const s = summarizeSeries([6, 8, 7]);
    expect(s.average).toBe(7);
    expect(s.direction).toBe('flat');
    expect(s.changePct).toBeNull();
  });

  it('detects an upward move between half-means', () => {
    const s = summarizeSeries([5, 5, 5, 7, 7, 7]);
    expect(s.direction).toBe('up');
    expect(s.changePct).toBeCloseTo(40, 0);
  });

  it('detects a decline', () => {
    expect(summarizeSeries([8, 8, 8, 6, 6, 6]).direction).toBe('down');
  });

  it('treats a <5% wiggle as flat', () => {
    expect(summarizeSeries([7, 7, 7, 7.2, 7.1, 7.05]).direction).toBe('flat');
  });
});

describe('weekStart / bucketByWeek', () => {
  it('maps any date to its Monday', () => {
    expect(weekStart('2026-07-07')).toBe('2026-07-06'); // Tue → Mon
    expect(weekStart('2026-07-06')).toBe('2026-07-06'); // Mon → itself
    expect(weekStart('2026-07-12')).toBe('2026-07-06'); // Sun → prior Mon
  });

  it('buckets counts per week, oldest first', () => {
    expect(bucketByWeek(['2026-07-07', '2026-07-08', '2026-06-30'])).toEqual([
      { weekOf: '2026-06-29', count: 1 },
      { weekOf: '2026-07-06', count: 2 },
    ]);
  });
});

describe('assemblers', () => {
  it('buildSleepTrend summarises the series and notes an empty window', () => {
    mSleep.mockReturnValue([
      { date: '2026-07-01', sleepHours: 6 },
      { date: '2026-07-02', sleepHours: 6 },
      { date: '2026-07-03', sleepHours: 8 },
      { date: '2026-07-04', sleepHours: 8 },
    ]);
    const t = buildSleepTrend(14);
    expect(t.direction).toBe('up');
    expect(t.series).toHaveLength(4);
    expect(t.note).toBeUndefined();

    mSleep.mockReturnValue([]);
    expect(buildSleepTrend(14).note).toMatch(/No sleep data/);
  });

  it('buildMoodTrend mirrors the same shape over reflections', () => {
    mMood.mockReturnValue([
      { date: '2026-07-01', mood: 4 },
      { date: '2026-07-02', mood: 4 },
      { date: '2026-07-03', mood: 2 },
      { date: '2026-07-04', mood: 2 },
    ]);
    expect(buildMoodTrend(14).direction).toBe('down');
  });

  it('buildCompletionTrend counts weekly and excludes the current partial week from direction', () => {
    const today = new Date().toISOString().slice(0, 10);
    mEvents.mockReturnValue([
      // 4 full weeks of completions (1, 2, 4, 6 → up; direction needs ≥4
      // points), plus one lonely completion in the CURRENT week that must not
      // read as a crash (partial weeks are excluded from direction).
      ...['2026-06-08'],
      ...['2026-06-15', '2026-06-16'],
      ...['2026-06-22', '2026-06-23', '2026-06-24', '2026-06-25'],
      ...['2026-06-29', '2026-06-30', '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04'],
      today,
    ].map((d) => ({ eventType: 'block_completed', module: 'goal', createdAt: `${d}T10:00:00.000Z` })));

    const t = buildCompletionTrend(60);
    expect(t.totalCompleted).toBe(14);
    expect(t.direction).toBe('up');
  });

  it('assemblers never throw on a broken store', () => {
    mSleep.mockImplementation(() => { throw new Error('boom'); });
    mMood.mockImplementation(() => { throw new Error('boom'); });
    mEvents.mockImplementation(() => { throw new Error('boom'); });
    expect(buildSleepTrend(14).series).toEqual([]);
    expect(buildMoodTrend(14).series).toEqual([]);
    expect(buildCompletionTrend(28).weekly).toEqual([]);
  });
});
