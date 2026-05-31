import { load, save } from './_io';
import { HEALTH_LOGS_KEY, FOOD_ENTRIES_KEY, BLOOD_REPORTS_KEY } from './_keys';

export interface WebHealthLog {
  id: string;
  date: string;
  weight?: number | null;
  sleepHours?: number | null;
  steps?: number | null;
  energyLevel?: number | null;
  waterMl?: number | null;
  recoveryScore?: number | null;
  notes?: string | null;
  source: string;
  createdAt: string;
}

export function webInsertHealthLog(log: WebHealthLog): void {
  const all = load<WebHealthLog>(HEALTH_LOGS_KEY);
  all.push(log);
  save(HEALTH_LOGS_KEY, all);
}

export function webGetHealthLogsByDate(date: string): WebHealthLog[] {
  return load<WebHealthLog>(HEALTH_LOGS_KEY).filter((l) => l.date === date);
}

export function webGetAllHealthLogs(): WebHealthLog[] {
  return load<WebHealthLog>(HEALTH_LOGS_KEY);
}

export function webGetRecentWeightLogs(limit: number): WebHealthLog[] {
  return load<WebHealthLog>(HEALTH_LOGS_KEY)
    .filter((l) => l.weight !== null && l.weight !== undefined)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

export interface WebFoodEntry {
  id: string;
  date: string;
  mealType: string;
  foodName: string;
  quantityG: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre?: number;
  source: string;
  createdAt: string;
}

export function webInsertFoodEntry(entry: WebFoodEntry): void {
  const all = load<WebFoodEntry>(FOOD_ENTRIES_KEY);
  all.push(entry);
  save(FOOD_ENTRIES_KEY, all);
}

export function webGetFoodEntriesByDate(date: string): WebFoodEntry[] {
  return load<WebFoodEntry>(FOOD_ENTRIES_KEY).filter((e) => e.date === date);
}

export function webUpdateFoodEntry(id: string, data: Partial<WebFoodEntry>): void {
  const all = load<WebFoodEntry>(FOOD_ENTRIES_KEY);
  const next = all.map((e) => (e.id === id ? { ...e, ...data, id: e.id } : e));
  save(FOOD_ENTRIES_KEY, next);
}

export function webDeleteFoodEntry(id: string): void {
  const all = load<WebFoodEntry>(FOOD_ENTRIES_KEY);
  save(FOOD_ENTRIES_KEY, all.filter((e) => e.id !== id));
}

export interface WebBloodReport {
  id: string;
  date: string;
  reportName: string;
  parsedMarkers?: string;
  aiSummary?: string;
  aiSuggestions?: string;
  rawFileUri?: string;
  createdAt: string;
}

export function webInsertBloodReport(report: WebBloodReport): void {
  const all = load<WebBloodReport>(BLOOD_REPORTS_KEY);
  all.push(report);
  save(BLOOD_REPORTS_KEY, all);
}

export function webGetBloodReports(): WebBloodReport[] {
  return load<WebBloodReport>(BLOOD_REPORTS_KEY).sort((a, b) => b.date.localeCompare(a.date));
}

export function webGetBloodReportById(id: string): WebBloodReport | undefined {
  return load<WebBloodReport>(BLOOD_REPORTS_KEY).find((r) => r.id === id);
}
