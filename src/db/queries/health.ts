import { Platform } from 'react-native';
import { format } from 'date-fns';
import { eq, desc, isNotNull } from 'drizzle-orm';
import { nanoid } from '@/utils/id';
import { db } from '../index';
import { healthLogs, foodEntries, bloodReports } from '../schema';
import {
  webInsertHealthLog,
  webGetHealthLogsByDate,
  webGetRecentWeightLogs,
  webGetAllHealthLogs,
  webInsertFoodEntry,
  webGetFoodEntriesByDate,
  webUpdateFoodEntry,
  webDeleteFoodEntry,
  webInsertBloodReport,
  webGetBloodReports,
  webGetBloodReportById,
  type WebHealthLog,
  type WebFoodEntry,
  type WebBloodReport,
} from '../webStorage';

const isWeb = Platform.OS === 'web';

// --- Health Logs ---

export function createHealthLog(data: {
  date: string;
  weight?: number;
  sleepHours?: number;
  steps?: number;
  energyLevel?: number;
  waterMl?: number;
  recoveryScore?: number;
  notes?: string;
  source?: string;
}) {
  const id = nanoid();
  if (isWeb) {
    const record: WebHealthLog = {
      id,
      date: data.date,
      weight: data.weight ?? null,
      sleepHours: data.sleepHours ?? null,
      steps: data.steps ?? null,
      energyLevel: data.energyLevel ?? null,
      waterMl: data.waterMl ?? null,
      recoveryScore: data.recoveryScore ?? null,
      notes: data.notes ?? null,
      source: data.source ?? 'manual',
      createdAt: new Date().toISOString(),
    };
    webInsertHealthLog(record);
    return id;
  }
  db.insert(healthLogs).values({ id, ...data }).run();
  return id;
}

/** Total water (ml) logged today — sums the day's `waterMl` increments. */
export function getWaterMlForDate(date: string): number {
  const rows = getHealthLogsByDate(date) as Array<{ waterMl?: number | null }>;
  return rows.reduce((sum, r) => sum + (r.waterMl ?? 0), 0);
}

/** Most recent energy level (1-5) logged today, or null if none. */
export function getLatestEnergyForDate(date: string): number | null {
  const rows = getHealthLogsByDate(date) as Array<{ energyLevel?: number | null; createdAt: string }>;
  const withEnergy = rows
    .filter((r) => r.energyLevel != null)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return withEnergy.length ? withEnergy[0].energyLevel ?? null : null;
}

/**
 * Most recent recovery score (0-100) within `maxAgeDays`, or null. The Routine
 * Builder reads this to decide whether to soften the rest of the day, so a stale
 * score (e.g. last week's) must not count — mirrors getLatestSleepHours.
 */
export function getLatestRecoveryScore(maxAgeDays = 1): number | null {
  const rows = isWeb
    ? webGetAllHealthLogs()
    : (db.select().from(healthLogs).orderBy(desc(healthLogs.date)).all() as Array<{
        date: string;
        recoveryScore: number | null;
      }>);
  const withScore = (rows as Array<{ date: string; recoveryScore?: number | null }>)
    .filter((r) => r.recoveryScore !== null && r.recoveryScore !== undefined)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  if (withScore.length === 0) return null;
  const latest = withScore[0];
  const ageDays = Math.floor((Date.now() - new Date(`${latest.date}T00:00:00`).getTime()) / 86_400_000);
  if (ageDays > maxAgeDays) return null;
  return latest.recoveryScore ?? null;
}

export function getHealthLogsByDate(date: string) {
  if (isWeb) return webGetHealthLogsByDate(date);
  return db.select().from(healthLogs).where(eq(healthLogs.date, date)).all();
}

export function getRecentWeightLogs(limit = 7) {
  if (isWeb) return webGetRecentWeightLogs(limit);
  // Filter to weight-bearing rows in SQL BEFORE the limit. Filtering after
  // .limit() (the old bug) took `limit` rows of ANY kind — water/steps/sleep
  // entries with null weight — then dropped them, so a user who logs water more
  // often than weight got an empty weight history on native. This matches the
  // web path (webGetRecentWeightLogs filters non-null weight, then slices).
  return db.select().from(healthLogs)
    .where(isNotNull(healthLogs.weight))
    .orderBy(desc(healthLogs.date))
    .limit(limit)
    .all();
}

/**
 * Most recent sleep_hours value across all health logs (manual + Fit). Returns
 * null if the latest entry is older than `maxAgeDays`. Used by the recovery
 * heuristic — stale data shouldn't soften today's plan.
 */
export function getLatestSleepHours(maxAgeDays = 3): number | null {
  const rows = isWeb
    ? webGetAllHealthLogs()
    : (db.select().from(healthLogs).orderBy(desc(healthLogs.date)).all() as Array<{
        date: string;
        sleepHours: number | null;
      }>);
  const withSleep = rows
    .filter((r) => r.sleepHours !== null && r.sleepHours !== undefined && r.sleepHours > 0)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  if (withSleep.length === 0) return null;
  const latest = withSleep[0];
  const ageDays = Math.floor((Date.now() - new Date(`${latest.date}T00:00:00`).getTime()) / 86_400_000);
  if (ageDays > maxAgeDays) return null;
  return latest.sleepHours ?? null;
}

/**
 * Sleep as a queryable time series (oldest first) over the last `days` days.
 * One point per date (latest log wins); dates without sleep data are omitted.
 */
export function getSleepSeries(days: number): Array<{ date: string; sleepHours: number }> {
  // Local formatting, not toISOString — UTC conversion shifts local dates back
  // a day in positive-offset timezones (IST).
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = format(cutoff, 'yyyy-MM-dd');
  const rows = isWeb
    ? webGetAllHealthLogs()
    : (db.select().from(healthLogs).orderBy(desc(healthLogs.date)).all() as Array<{
        date: string;
        sleepHours: number | null;
      }>);
  const byDate = new Map<string, number>();
  for (const r of rows) {
    if (r.date < cutoffStr) continue;
    if (r.sleepHours === null || r.sleepHours === undefined || r.sleepHours <= 0) continue;
    if (!byDate.has(r.date)) byDate.set(r.date, r.sleepHours);
  }
  return Array.from(byDate.entries())
    .map(([date, sleepHours]) => ({ date, sleepHours }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

// --- Food Entries ---

export function createFoodEntry(data: {
  date: string;
  mealType: string;
  foodName: string;
  quantityG: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre?: number;
  source?: string;
}) {
  const id = nanoid();
  if (isWeb) {
    const record: WebFoodEntry = {
      id,
      date: data.date,
      mealType: data.mealType,
      foodName: data.foodName,
      quantityG: data.quantityG,
      calories: data.calories,
      protein: data.protein,
      carbs: data.carbs,
      fat: data.fat,
      fibre: data.fibre,
      source: data.source ?? 'manual',
      createdAt: new Date().toISOString(),
    };
    webInsertFoodEntry(record);
    return id;
  }
  db.insert(foodEntries).values({ id, ...data }).run();
  return id;
}

export function getFoodEntriesByDate(date: string) {
  if (isWeb) return webGetFoodEntriesByDate(date);
  return db.select().from(foodEntries).where(eq(foodEntries.date, date)).all();
}

export function updateFoodEntry(
  id: string,
  data: Partial<{
    mealType: string;
    foodName: string;
    quantityG: number;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fibre: number;
  }>,
) {
  if (isWeb) {
    webUpdateFoodEntry(id, data);
    return;
  }
  db.update(foodEntries).set(data).where(eq(foodEntries.id, id)).run();
}

// Food entries are transient daily-log rows with no `deletedAt` column, so we
// hard-delete (same as routine blocks). The soft-delete rule applies to durable
// user data like goals and contacts.
export function deleteFoodEntry(id: string) {
  if (isWeb) {
    webDeleteFoodEntry(id);
    return;
  }
  db.delete(foodEntries).where(eq(foodEntries.id, id)).run();
}

// --- Blood Reports ---

export function createBloodReport(data: {
  date: string;
  reportName: string;
  parsedMarkers?: string;
  aiSummary?: string;
  aiSuggestions?: string;
  rawFileUri?: string;
}) {
  const id = nanoid();
  if (isWeb) {
    const record: WebBloodReport = {
      id,
      date: data.date,
      reportName: data.reportName,
      parsedMarkers: data.parsedMarkers,
      aiSummary: data.aiSummary,
      aiSuggestions: data.aiSuggestions,
      rawFileUri: data.rawFileUri,
      createdAt: new Date().toISOString(),
    };
    webInsertBloodReport(record);
    return id;
  }
  db.insert(bloodReports).values({ id, ...data }).run();
  return id;
}

export function getBloodReports() {
  if (isWeb) return webGetBloodReports();
  return db.select().from(bloodReports).orderBy(desc(bloodReports.date)).all();
}

export function getBloodReportById(id: string) {
  if (isWeb) return webGetBloodReportById(id);
  return db.select().from(bloodReports).where(eq(bloodReports.id, id)).get();
}
