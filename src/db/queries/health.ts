import { Platform } from 'react-native';
import { eq, desc } from 'drizzle-orm';
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
  heightCm?: number;
  sleepHours?: number;
  steps?: number;
  energyLevel?: number;
  notes?: string;
  source?: string;
}) {
  const id = nanoid();
  const source = data.source ?? 'manual';
  if (isWeb) {
    const record: WebHealthLog = {
      id,
      date: data.date,
      weight: data.weight ?? null,
      heightCm: data.heightCm ?? null,
      sleepHours: data.sleepHours ?? null,
      steps: data.steps ?? null,
      energyLevel: data.energyLevel ?? null,
      notes: data.notes ?? null,
      source,
      createdAt: new Date().toISOString(),
    };
    webInsertHealthLog(record);
    return id;
  }
  db.insert(healthLogs).values({
    id,
    date: data.date,
    weight: data.weight ?? null,
    heightCm: data.heightCm ?? null,
    sleepHours: data.sleepHours ?? null,
    steps: data.steps ?? null,
    energyLevel: data.energyLevel ?? null,
    notes: data.notes ?? null,
    source,
  }).run();
  return id;
}

export interface BodyMeasurementRow {
  id: string;
  date: string;
  weight: number | null;
  heightCm: number | null;
  createdAt: string;
}

/** Weight and/or height entries, newest first (by `createdAt`). */
export function getRecentBodyMeasurements(limit = 40): BodyMeasurementRow[] {
  if (isWeb) {
    return webGetAllHealthLogs()
      .filter(
        (l) =>
          (l.weight != null && l.weight > 0) ||
          (l.heightCm != null && l.heightCm > 0),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map((l) => ({
        id: l.id,
        date: l.date,
        weight: l.weight ?? null,
        heightCm: l.heightCm ?? null,
        createdAt: l.createdAt,
      }));
  }
  const rows = db
    .select()
    .from(healthLogs)
    .orderBy(desc(healthLogs.createdAt))
    .limit(Math.max(limit * 4, 40))
    .all() as Array<{
      id: string;
      date: string;
      weight: number | null;
      heightCm: number | null;
      createdAt: string;
    }>;
  return rows
    .filter(
      (l) =>
        (l.weight != null && l.weight > 0) ||
        (l.heightCm != null && l.heightCm > 0),
    )
    .slice(0, limit)
    .map((l) => ({
      id: l.id,
      date: l.date,
      weight: l.weight ?? null,
      heightCm: l.heightCm ?? null,
      createdAt: l.createdAt,
    }));
}

export function getHealthLogsByDate(date: string) {
  if (isWeb) return webGetHealthLogsByDate(date);
  return db.select().from(healthLogs).where(eq(healthLogs.date, date)).all();
}

export function getRecentWeightLogs(limit = 7) {
  if (isWeb) return webGetRecentWeightLogs(limit);
  return db.select().from(healthLogs)
    .orderBy(desc(healthLogs.date))
    .limit(limit)
    .all()
    .filter((l) => l.weight !== null);
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
