/**
 * Google Fit REST client — aggregateCore metric mapping (steps / heart_rate
 * [avg,max,min] / sleep stages), fetchWorkouts (skips the sleep activity,
 * labels known activity types), and the per-call error accumulation that turns
 * an upstream failure into result.errors rather than a throw.
 */

jest.mock('../oauth', () => ({
  getFitAccessToken: jest.fn().mockResolvedValue('fit-tok'),
}));

import { syncFitDailyData, type DailyFitPoint } from '../client';

const CLIENT_ID = 'fake-client.apps.googleusercontent.com';
const DAY_MS = 24 * 60 * 60 * 1000;

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as unknown as Response;
}

// Mirror the client's own local-day bucketing so our mock buckets land on a
// pre-seeded day key (only matched keys get populated).
function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function dateKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const TODAY_START = startOfLocalDay(Date.now());
const TODAY_KEY = dateKey(TODAY_START);

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

function dayFor(result: { days: DailyFitPoint[] }, key: string): DailyFitPoint {
  const day = result.days.find((d) => d.date === key);
  if (!day) throw new Error(`no bucket for ${key}`);
  return day;
}

describe('aggregateCore metric mapping', () => {
  it('maps steps, heart_rate [avg,max,min], spo2 and blood pressure into the day point', async () => {
    const coreBucket = {
      bucket: [
        {
          startTimeMillis: String(TODAY_START),
          dataset: [
            {
              dataSourceId: 'derived:com.google.step_count.delta:aggregated',
              point: [{ value: [{ intVal: 8421 }] }],
            },
            {
              dataSourceId: 'derived:com.google.heart_rate.bpm:aggregated',
              point: [{ value: [{ fpVal: 72.5 }, { fpVal: 140 }, { fpVal: 55 }] }],
            },
            {
              dataSourceId: 'derived:com.google.oxygen_saturation:aggregated',
              point: [{ value: [{ fpVal: 97 }] }],
            },
            {
              dataSourceId: 'derived:com.google.blood_pressure:aggregated',
              point: [{ value: [{ fpVal: 118 }, { fpVal: 76 }] }],
            },
          ],
        },
      ],
    };
    fetchMock
      .mockResolvedValueOnce(jsonResponse(coreBucket)) // aggregateCore
      .mockResolvedValueOnce(jsonResponse({ bucket: [] })) // sleep stages
      .mockResolvedValueOnce(jsonResponse({ session: [] })); // workouts

    const result = await syncFitDailyData(CLIENT_ID, 3);
    const today = dayFor(result, TODAY_KEY);

    expect(today.steps).toBe(8421);
    expect(today.avgHeartRate).toBe(72.5);
    expect(today.maxHeartRate).toBe(140);
    expect(today.minHeartRate).toBe(55);
    expect(today.spo2).toBe(97);
    expect(today.systolic).toBe(118);
    expect(today.diastolic).toBe(76);
    expect(result.errors).toEqual([]);
  });

  it('accumulates an aggregate failure into result.errors instead of throwing', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, false, 401)) // aggregateCore fails
      .mockResolvedValueOnce(jsonResponse({ bucket: [] })) // sleep stages ok
      .mockResolvedValueOnce(jsonResponse({ session: [] })); // workouts ok

    const result = await syncFitDailyData(CLIENT_ID, 2);

    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.errors.some((e) => e.includes('aggregate failed') && e.includes('401'))).toBe(true);
    // Buckets still come back (zeroed), the sync did not throw.
    expect(result.days.length).toBeGreaterThan(0);
  });
});

describe('sleep stage mapping', () => {
  it('buckets segment stages (awake/light/deep/rem) and totals sleep minutes', async () => {
    const min = (n: number) => n * 60 * 1e9; // minutes → nanoseconds
    const seg = (stage: number, startMin: number, lenMin: number) => ({
      startTimeNanos: String(min(startMin)),
      endTimeNanos: String(min(startMin + lenMin)),
      value: [{ intVal: stage }],
    });
    const sleepBucket = {
      bucket: [
        {
          startTimeMillis: String(TODAY_START),
          dataset: [
            {
              point: [
                seg(4, 0, 30), // light 30
                seg(5, 30, 90), // deep 90
                seg(6, 120, 60), // rem 60
                seg(1, 180, 10), // awake 10 (excluded from total)
                seg(2, 190, 20), // generic → bucketed as light
              ],
            },
          ],
        },
      ],
    };
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ bucket: [] })) // core
      .mockResolvedValueOnce(jsonResponse(sleepBucket)) // sleep
      .mockResolvedValueOnce(jsonResponse({ session: [] })); // workouts

    const result = await syncFitDailyData(CLIENT_ID, 2);
    const today = dayFor(result, TODAY_KEY);

    expect(today.sleep.light).toBe(50); // 30 + 20 generic
    expect(today.sleep.deep).toBe(90);
    expect(today.sleep.rem).toBe(60);
    expect(today.sleep.awake).toBe(10);
    expect(today.sleep.total).toBe(200); // light + deep + rem, awake excluded
  });
});

describe('fetchWorkouts', () => {
  it('skips the sleep activity (type 72) and labels known activity types', async () => {
    const runStart = TODAY_START + 7 * 60 * 60 * 1000; // 07:00 today
    const sessions = {
      session: [
        {
          id: 'sess-run',
          activityType: 8, // Running
          startTimeMillis: String(runStart),
          endTimeMillis: String(runStart + 30 * 60 * 1000), // 30 min
        },
        {
          id: 'sess-sleep',
          activityType: 72, // sleep — must be skipped
          startTimeMillis: String(TODAY_START),
          endTimeMillis: String(TODAY_START + 8 * 60 * 60 * 1000),
        },
      ],
    };
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ bucket: [] })) // core
      .mockResolvedValueOnce(jsonResponse({ bucket: [] })) // sleep
      .mockResolvedValueOnce(jsonResponse(sessions)); // workouts

    const result = await syncFitDailyData(CLIENT_ID, 2);

    expect(result.workouts).toHaveLength(1);
    const w = result.workouts[0];
    expect(w.id).toBe('sess-run');
    expect(w.name).toBe('Running');
    expect(w.iconName).toBe('pulse');
    expect(w.activityType).toBe(8);
    expect(w.durationMinutes).toBe(30);
  });

  it('falls back to a generic label for an unknown activity type', async () => {
    const start = TODAY_START + 6 * 60 * 60 * 1000;
    const sessions = {
      session: [
        {
          id: 'sess-misc',
          name: 'Mystery Activity',
          activityType: 999, // not in ACTIVITY_LABELS
          startTimeMillis: String(start),
          endTimeMillis: String(start + 15 * 60 * 1000),
        },
      ],
    };
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ bucket: [] }))
      .mockResolvedValueOnce(jsonResponse({ bucket: [] }))
      .mockResolvedValueOnce(jsonResponse(sessions));

    const result = await syncFitDailyData(CLIENT_ID, 2);

    expect(result.workouts).toHaveLength(1);
    expect(result.workouts[0].name).toBe('Mystery Activity');
    expect(result.workouts[0].iconName).toBe('fitness');
  });

  it('accumulates a sessions failure into result.errors instead of throwing', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ bucket: [] }))
      .mockResolvedValueOnce(jsonResponse({ bucket: [] }))
      .mockResolvedValueOnce(jsonResponse({}, false, 500)); // workouts fail

    const result = await syncFitDailyData(CLIENT_ID, 2);

    expect(result.workouts).toEqual([]);
    expect(result.errors.some((e) => e.includes('sessions failed') && e.includes('500'))).toBe(true);
  });
});
