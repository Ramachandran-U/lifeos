import { Platform } from 'react-native';
import { desc, eq, gte } from 'drizzle-orm';
import { nanoid } from '@/utils/id';
import { db } from '../index';
import { dailyReflections } from '../schema';
import {
  webUpsertReflection,
  webGetReflectionByDate,
  webGetRecentReflections,
  type WebDailyReflection,
} from '../webStorage';
import { recordMutation } from '@/sync/runtime';

const isWeb = Platform.OS === 'web';

export type BlockReview = 'did' | 'skipped' | 'rescheduled';

export interface ReflectionInput {
  date: string;
  mood: number | null;
  blockReviews: Record<string, BlockReview>;
  tweakAccepted: boolean | null;
  tweakPayload: unknown;
  notes?: string;
}

export interface Reflection {
  id: string;
  date: string;
  mood: number | null;
  blockReviews: Record<string, BlockReview>;
  tweakAccepted: boolean | null;
  tweakPayload: unknown;
  notes: string | null;
  createdAt: string;
}

function fromWeb(r: WebDailyReflection): Reflection {
  let blockReviews: Record<string, BlockReview> = {};
  try { blockReviews = JSON.parse(r.blockReviews) as Record<string, BlockReview>; } catch { /* ignore */ }
  let tweakPayload: unknown = null;
  if (r.tweakPayload) { try { tweakPayload = JSON.parse(r.tweakPayload); } catch { /* ignore */ } }
  return {
    id: r.id,
    date: r.date,
    mood: r.mood,
    blockReviews,
    tweakAccepted: r.tweakAccepted,
    tweakPayload,
    notes: r.notes,
    createdAt: r.createdAt,
  };
}

export function upsertReflection(input: ReflectionInput): string {
  const existing = getReflectionByDate(input.date);
  const id = existing?.id ?? nanoid();
  const now = new Date().toISOString();
  const blockReviewsJson = JSON.stringify(input.blockReviews);
  const tweakPayloadJson = input.tweakPayload ? JSON.stringify(input.tweakPayload) : null;

  const afterSnapshot = {
    id,
    date: input.date,
    mood: input.mood,
    blockReviews: blockReviewsJson,
    tweakAccepted: input.tweakAccepted,
    tweakPayload: tweakPayloadJson,
    notes: input.notes ?? null,
    createdAt: existing?.createdAt ?? now,
  };

  if (isWeb) {
    webUpsertReflection(afterSnapshot);
  } else if (existing) {
    db.update(dailyReflections).set({
      mood: input.mood,
      blockReviews: blockReviewsJson,
      tweakAccepted: input.tweakAccepted,
      tweakPayload: tweakPayloadJson,
      notes: input.notes ?? null,
    }).where(eq(dailyReflections.id, existing.id)).run();
  } else {
    db.insert(dailyReflections).values({
      id,
      date: input.date,
      mood: input.mood,
      blockReviews: blockReviewsJson,
      tweakAccepted: input.tweakAccepted,
      tweakPayload: tweakPayloadJson,
      notes: input.notes ?? null,
      createdAt: now,
    }).run();
  }

  if (existing) {
    recordMutation({
      entity: 'daily_reflections',
      entityId: id,
      op: 'update',
      before: { id, date: existing.date, mood: existing.mood, blockReviews: JSON.stringify(existing.blockReviews), tweakAccepted: existing.tweakAccepted, tweakPayload: existing.tweakPayload ? JSON.stringify(existing.tweakPayload) : null, notes: existing.notes, createdAt: existing.createdAt },
      after: afterSnapshot,
    });
  } else {
    recordMutation({ entity: 'daily_reflections', entityId: id, op: 'insert', before: null, after: afterSnapshot });
  }

  return id;
}

export function getReflectionByDate(date: string): Reflection | undefined {
  if (isWeb) {
    const r = webGetReflectionByDate(date);
    return r ? fromWeb(r) : undefined;
  }
  const row = db.select().from(dailyReflections).where(eq(dailyReflections.date, date)).get();
  if (!row) return undefined;
  return fromWeb({
    id: row.id,
    date: row.date,
    mood: row.mood ?? null,
    blockReviews: row.blockReviews,
    tweakAccepted: (row.tweakAccepted as boolean | null) ?? null,
    tweakPayload: row.tweakPayload ?? null,
    notes: row.notes ?? null,
    createdAt: row.createdAt,
  });
}

export function getRecentReflections(days: number): Reflection[] {
  if (isWeb) return webGetRecentReflections(days).map(fromWeb);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const rows = db.select().from(dailyReflections)
    .where(gte(dailyReflections.date, cutoffStr))
    .orderBy(desc(dailyReflections.date))
    .all();
  return rows.map((row) => fromWeb({
    id: row.id,
    date: row.date,
    mood: row.mood ?? null,
    blockReviews: row.blockReviews,
    tweakAccepted: (row.tweakAccepted as boolean | null) ?? null,
    tweakPayload: row.tweakPayload ?? null,
    notes: row.notes ?? null,
    createdAt: row.createdAt,
  }));
}

/**
 * Mood as a queryable time series (oldest first) — the reflection data was
 * always per-day, but nothing read it AS a series until the trend tools.
 * Days without a mood are omitted, not zero-filled.
 */
export function getMoodSeries(days: number): Array<{ date: string; mood: number }> {
  return getRecentReflections(days)
    .filter((r): r is Reflection & { mood: number } => r.mood !== null)
    .map((r) => ({ date: r.date, mood: r.mood }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function getReflectionStreak(): number {
  const reflections = isWeb
    ? webGetRecentReflections(60).map(fromWeb)
    : getRecentReflections(60);
  const dates = new Set(reflections.map((r) => r.date));
  let streak = 0;
  const d = new Date();
  while (true) {
    const key = d.toISOString().slice(0, 10);
    if (!dates.has(key)) break;
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}
