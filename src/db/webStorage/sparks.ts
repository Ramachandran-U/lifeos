import { subDays, format } from 'date-fns';
import { load, save } from './_io';
import { SPARKS_KEY } from './_keys';

export interface WebSpark {
  id: string;
  userId: string;
  date: string;
  title: string;
  body: string;
  threadStarter: string;
  seedInterest: string;
  adjacentField: string;
  status: string;
  threadId: string | null;
  createdAt: string;
}

export function webInsertSpark(row: WebSpark): void {
  const all = load<WebSpark>(SPARKS_KEY);
  all.push(row);
  save(SPARKS_KEY, all);
}

export function webGetSparkByDate(userId: string, date: string): WebSpark | undefined {
  return load<WebSpark>(SPARKS_KEY).find((s) => s.userId === userId && s.date === date);
}

export function webListRecentSparks(userId: string, days: number): WebSpark[] {
  const cutoff = format(subDays(new Date(), days), 'yyyy-MM-dd');
  return load<WebSpark>(SPARKS_KEY)
    .filter((s) => s.userId === userId && s.date >= cutoff)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function webUpdateSparkStatus(id: string, status: string, threadId?: string | null): void {
  const all = load<WebSpark>(SPARKS_KEY);
  const idx = all.findIndex((s) => s.id === id);
  if (idx === -1) return;
  all[idx] = { ...all[idx]!, status, ...(threadId !== undefined ? { threadId } : {}) };
  save(SPARKS_KEY, all);
}
