import { eq, desc } from 'drizzle-orm';
import { nanoid } from '@/utils/id';
import { db } from '../index';
import { healthLogs, foodEntries, bloodReports } from '../schema';

// --- Health Logs ---

export function createHealthLog(data: {
  date: string;
  weight?: number;
  sleepHours?: number;
  steps?: number;
  energyLevel?: number;
  notes?: string;
  source?: string;
}) {
  const id = nanoid();
  db.insert(healthLogs).values({ id, ...data }).run();
  return id;
}

export function getHealthLogsByDate(date: string) {
  return db.select().from(healthLogs).where(eq(healthLogs.date, date)).all();
}

export function getRecentWeightLogs(limit = 7) {
  return db.select().from(healthLogs)
    .orderBy(desc(healthLogs.date))
    .limit(limit)
    .all()
    .filter((l) => l.weight !== null);
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
  db.insert(foodEntries).values({ id, ...data }).run();
  return id;
}

export function getFoodEntriesByDate(date: string) {
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
  db.insert(bloodReports).values({ id, ...data }).run();
  return id;
}

export function getBloodReports() {
  return db.select().from(bloodReports).orderBy(desc(bloodReports.date)).all();
}

export function getBloodReportById(id: string) {
  return db.select().from(bloodReports).where(eq(bloodReports.id, id)).get();
}
