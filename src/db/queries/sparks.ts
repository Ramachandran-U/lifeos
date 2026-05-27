import { Platform } from 'react-native';
import { eq } from 'drizzle-orm';
import { db } from '../index';
import { sparks } from '../schema';
import {
  webInsertSpark,
  webGetSparkByDate,
  webListRecentSparks,
  webUpdateSparkStatus,
  type WebSpark,
} from '../webStorage';
import type { Spark, SparkStatus } from '@/explore/spark';

const isWeb = Platform.OS === 'web';

const toRow = (s: Spark): WebSpark => ({ ...s });
const fromRow = (r: WebSpark): Spark => ({
  id: r.id, userId: r.userId, date: r.date, title: r.title, body: r.body,
  threadStarter: r.threadStarter, seedInterest: r.seedInterest, adjacentField: r.adjacentField,
  status: r.status as SparkStatus, threadId: r.threadId, createdAt: r.createdAt,
});

export function recordSpark(s: Spark): void {
  if (isWeb) { webInsertSpark(toRow(s)); return; }
  db.insert(sparks).values(toRow(s)).run();
}

export function getSparkByDate(userId: string, date: string): Spark | undefined {
  if (isWeb) { const r = webGetSparkByDate(userId, date); return r ? fromRow(r) : undefined; }
  const row = db.select().from(sparks).where(eq(sparks.userId, userId)).all()
    .find((r) => r.date === date);
  return row ? fromRow(row as WebSpark) : undefined;
}

/** Recent spark titles (newest first) — fed to the generator for dedup. */
export function listRecentSparkTitles(userId: string, days = 14): string[] {
  const rows = isWeb
    ? webListRecentSparks(userId, days)
    : db.select().from(sparks).where(eq(sparks.userId, userId)).all() as WebSpark[];
  return rows.map((r) => r.title);
}

export function updateSparkStatus(id: string, status: SparkStatus, threadId?: string | null): void {
  if (isWeb) { webUpdateSparkStatus(id, status, threadId); return; }
  db.update(sparks)
    .set({ status, ...(threadId !== undefined ? { threadId } : {}) })
    .where(eq(sparks.id, id)).run();
}
