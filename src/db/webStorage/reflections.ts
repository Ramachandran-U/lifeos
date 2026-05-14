import { subDays, format } from 'date-fns';
import { load, save } from './_io';
import { REFLECTIONS_KEY } from './_keys';

export interface WebDailyReflection {
  id: string;
  date: string;
  mood: number | null;
  blockReviews: string; // JSON
  tweakAccepted: boolean | null;
  tweakPayload: string | null;
  notes: string | null;
  createdAt: string;
}

export function webUpsertReflection(r: WebDailyReflection): void {
  const all = load<WebDailyReflection>(REFLECTIONS_KEY);
  const idx = all.findIndex((x) => x.date === r.date);
  if (idx === -1) all.push(r);
  else all[idx] = r;
  save(REFLECTIONS_KEY, all);
}

export function webGetReflectionByDate(date: string): WebDailyReflection | undefined {
  return load<WebDailyReflection>(REFLECTIONS_KEY).find((r) => r.date === date);
}

export function webGetRecentReflections(days: number): WebDailyReflection[] {
  const cutoff = format(subDays(new Date(), days), 'yyyy-MM-dd');
  return load<WebDailyReflection>(REFLECTIONS_KEY)
    .filter((r) => r.date >= cutoff)
    .sort((a, b) => a.date.localeCompare(b.date));
}
