/**
 * Google Fit REST client — pulls all tiered health metrics in one sync call.
 *
 * Tier 1: steps, active minutes, heart points, calories burned, distance, avg HR, workouts
 * Tier 2: sleep stages, SpO2, body fat %, blood pressure
 *
 * Everything below 1-day granularity is aggregated server-side via
 * `dataset:aggregate`. Workouts and sleep sessions come from the sessions API.
 * Sleep *stages* are a separate aggregate call against the sleep.segment type.
 */

import type { Ionicons } from '@expo/vector-icons';
import { getFitAccessToken } from './oauth';

type IoniconName = keyof typeof Ionicons.glyphMap;

const AGGREGATE_URL = 'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate';
const SESSIONS_URL = 'https://www.googleapis.com/fitness/v1/users/me/sessions';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface SleepStages {
  /** minutes by stage: 1=awake-in-bed, 2=sleep-generic, 4=light, 5=deep, 6=REM */
  awake: number;
  light: number;
  deep: number;
  rem: number;
  total: number;
}

export interface DailyFitPoint {
  /** YYYY-MM-DD (local date of the bucket) */
  date: string;
  steps: number;
  activeMinutes: number;
  heartPoints: number;
  caloriesBurned: number;
  distanceMeters: number;
  /** avg bpm across all samples; null if none */
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  minHeartRate: number | null;
  sleep: SleepStages;
  spo2: number | null;
  bodyFatPct: number | null;
  systolic: number | null;
  diastolic: number | null;
  weightKg: number | null;
}

const ACTIVITY_LABELS: Record<number, { name: string; icon: IoniconName }> = {
  1: { name: 'Cycling', icon: 'bicycle' },
  7: { name: 'Walking', icon: 'walk' },
  8: { name: 'Running', icon: 'pulse' },
  9: { name: 'Aerobics', icon: 'flame' },
  10: { name: 'Badminton', icon: 'tennisball' },
  11: { name: 'Baseball', icon: 'baseball' },
  12: { name: 'Basketball', icon: 'basketball' },
  24: { name: 'Dancing', icon: 'musical-notes' },
  56: { name: 'Football', icon: 'football' },
  79: { name: 'Weightlifting', icon: 'barbell' },
  80: { name: 'Strength Training', icon: 'barbell' },
  82: { name: 'Swimming', icon: 'water' },
  97: { name: 'Swimming', icon: 'water' },
  100: { name: 'Yoga', icon: 'leaf' },
  112: { name: 'Hiking', icon: 'trail-sign' },
  119: { name: 'HIIT', icon: 'flash' },
  169: { name: 'Crossfit', icon: 'fitness' },
};

export interface WorkoutSession {
  id: string;
  /** YYYY-MM-DD (start) */
  date: string;
  name: string;
  iconName: IoniconName;
  activityType: number;
  durationMinutes: number;
  startTimeMs: number;
  endTimeMs: number;
}

export interface FitSyncResult {
  days: DailyFitPoint[];
  workouts: WorkoutSession[];
  errors: string[];
}

function dateKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function emptyPoint(date: string): DailyFitPoint {
  return {
    date,
    steps: 0,
    activeMinutes: 0,
    heartPoints: 0,
    caloriesBurned: 0,
    distanceMeters: 0,
    avgHeartRate: null,
    maxHeartRate: null,
    minHeartRate: null,
    sleep: { awake: 0, light: 0, deep: 0, rem: 0, total: 0 },
    spo2: null,
    bodyFatPct: null,
    systolic: null,
    diastolic: null,
    weightKg: null,
  };
}

async function authedPost(clientId: string, url: string, body: unknown): Promise<Response> {
  const token = await getFitAccessToken(clientId);
  if (!token) throw new Error('Google Fit is not connected');
  return fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function authedGet(clientId: string, url: string): Promise<Response> {
  const token = await getFitAccessToken(clientId);
  if (!token) throw new Error('Google Fit is not connected');
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
}

async function aggregateCore(
  clientId: string,
  startMs: number,
  endMs: number,
  buckets: Record<string, DailyFitPoint>,
  errors: string[],
) {
  const body = {
    aggregateBy: [
      { dataTypeName: 'com.google.step_count.delta' },
      { dataTypeName: 'com.google.active_minutes' },
      { dataTypeName: 'com.google.heart_minutes' },
      { dataTypeName: 'com.google.calories.expended' },
      { dataTypeName: 'com.google.distance.delta' },
      { dataTypeName: 'com.google.heart_rate.bpm' },
      { dataTypeName: 'com.google.weight' },
      { dataTypeName: 'com.google.body.fat.percentage' },
      { dataTypeName: 'com.google.oxygen_saturation' },
      { dataTypeName: 'com.google.blood_pressure' },
    ],
    bucketByTime: { durationMillis: DAY_MS },
    startTimeMillis: startMs,
    endTimeMillis: endMs,
  };
  try {
    const res = await authedPost(clientId, AGGREGATE_URL, body);
    if (!res.ok) throw new Error(`aggregate failed: ${res.status} ${await res.text()}`);
    const json = await res.json();
    for (const bucket of json.bucket ?? []) {
      const key = dateKey(Number(bucket.startTimeMillis));
      const day = buckets[key];
      if (!day) continue;
      for (const ds of bucket.dataset ?? []) {
        const typeName = ds.dataSourceId as string;
        for (const point of ds.point ?? []) {
          const v = point.value ?? [];
          if (typeName.includes('step_count')) day.steps += Number(v[0]?.intVal ?? 0);
          else if (typeName.includes('active_minutes')) day.activeMinutes += Number(v[0]?.intVal ?? 0);
          else if (typeName.includes('heart_minutes')) day.heartPoints += Number(v[0]?.fpVal ?? 0);
          else if (typeName.includes('calories.expended')) day.caloriesBurned += Number(v[0]?.fpVal ?? 0);
          else if (typeName.includes('distance.delta')) day.distanceMeters += Number(v[0]?.fpVal ?? 0);
          else if (typeName.includes('heart_rate')) {
            // aggregate heart_rate returns [avg, max, min]
            const avg = Number(v[0]?.fpVal);
            const max = Number(v[1]?.fpVal);
            const min = Number(v[2]?.fpVal);
            if (Number.isFinite(avg)) day.avgHeartRate = avg;
            if (Number.isFinite(max)) day.maxHeartRate = max;
            if (Number.isFinite(min)) day.minHeartRate = min;
          } else if (typeName.includes('body.fat.percentage')) {
            const f = Number(v[0]?.fpVal);
            if (Number.isFinite(f)) day.bodyFatPct = f;
          } else if (typeName.includes('oxygen_saturation')) {
            const s = Number(v[0]?.fpVal);
            if (Number.isFinite(s)) day.spo2 = s;
          } else if (typeName.includes('blood_pressure')) {
            const sys = Number(v[0]?.fpVal);
            const dia = Number(v[1]?.fpVal);
            if (Number.isFinite(sys)) day.systolic = sys;
            if (Number.isFinite(dia)) day.diastolic = dia;
          } else if (typeName.includes('weight')) {
            const w = Number(v[0]?.fpVal);
            if (Number.isFinite(w)) day.weightKg = w;
          }
        }
      }
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }
}

async function aggregateSleepStages(
  clientId: string,
  startMs: number,
  endMs: number,
  buckets: Record<string, DailyFitPoint>,
  errors: string[],
) {
  const body = {
    aggregateBy: [{ dataTypeName: 'com.google.sleep.segment' }],
    bucketByTime: { durationMillis: DAY_MS },
    startTimeMillis: startMs,
    endTimeMillis: endMs,
  };
  try {
    const res = await authedPost(clientId, AGGREGATE_URL, body);
    if (!res.ok) throw new Error(`sleep segments failed: ${res.status} ${await res.text()}`);
    const json = await res.json();
    for (const bucket of json.bucket ?? []) {
      const key = dateKey(Number(bucket.startTimeMillis));
      const day = buckets[key];
      if (!day) continue;
      for (const ds of bucket.dataset ?? []) {
        for (const point of ds.point ?? []) {
          const stage = Number(point.value?.[0]?.intVal ?? 0);
          const mins = (Number(point.endTimeNanos) - Number(point.startTimeNanos)) / 1e9 / 60;
          if (!Number.isFinite(mins) || mins <= 0) continue;
          if (stage === 1) day.sleep.awake += mins;
          else if (stage === 4) day.sleep.light += mins;
          else if (stage === 5) day.sleep.deep += mins;
          else if (stage === 6) day.sleep.rem += mins;
          else day.sleep.light += mins; // stage 2 = generic sleep, bucket as light
        }
      }
      day.sleep.total = day.sleep.light + day.sleep.deep + day.sleep.rem;
      day.sleep.light = Math.round(day.sleep.light);
      day.sleep.deep = Math.round(day.sleep.deep);
      day.sleep.rem = Math.round(day.sleep.rem);
      day.sleep.awake = Math.round(day.sleep.awake);
      day.sleep.total = Math.round(day.sleep.total);
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }
}

async function fetchWorkouts(
  clientId: string,
  startMs: number,
  endMs: number,
  errors: string[],
): Promise<WorkoutSession[]> {
  const out: WorkoutSession[] = [];
  try {
    const url = `${SESSIONS_URL}?startTime=${new Date(startMs).toISOString()}&endTime=${new Date(endMs).toISOString()}`;
    const res = await authedGet(clientId, url);
    if (!res.ok) throw new Error(`sessions failed: ${res.status} ${await res.text()}`);
    const json = await res.json();
    for (const s of json.session ?? []) {
      const activityType = Number(s.activityType);
      if (activityType === 72) continue; // sleep handled elsewhere
      const start = Number(s.startTimeMillis);
      const end = Number(s.endTimeMillis);
      const meta = ACTIVITY_LABELS[activityType] ?? {
        name: (s.name as string | undefined) || 'Workout',
        icon: 'fitness' as IoniconName,
      };
      out.push({
        id: s.id ?? `${activityType}-${start}`,
        date: dateKey(start),
        name: meta.name,
        iconName: meta.icon,
        activityType,
        durationMinutes: Math.max(0, Math.round((end - start) / 60000)),
        startTimeMs: start,
        endTimeMs: end,
      });
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }
  return out.sort((a, b) => b.startTimeMs - a.startTimeMs);
}

export async function syncFitDailyData(
  clientId: string,
  days = 14,
): Promise<FitSyncResult> {
  const errors: string[] = [];
  const endMs = startOfLocalDay(Date.now()) + DAY_MS;
  const startMs = endMs - days * DAY_MS;

  const buckets: Record<string, DailyFitPoint> = {};
  for (let t = startMs; t < endMs; t += DAY_MS) {
    const key = dateKey(t);
    buckets[key] = emptyPoint(key);
  }

  await aggregateCore(clientId, startMs, endMs, buckets, errors);
  await aggregateSleepStages(clientId, startMs, endMs, buckets, errors);
  const workouts = await fetchWorkouts(clientId, startMs, endMs, errors);

  return {
    days: Object.values(buckets).sort((a, b) => a.date.localeCompare(b.date)),
    workouts,
    errors,
  };
}
