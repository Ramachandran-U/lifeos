/**
 * Day summaries — episodic memory queries.
 *
 * ASYNC ON BOTH PLATFORMS, deliberately: web storage is Dexie/IndexedDB (a
 * paragraph per day for years outgrows the localStorage quota), so unlike the
 * per-entity localStorage stores there is no synchronous-read contract here.
 * Native wraps the sync Drizzle calls in promises so callers see one API.
 * (Do NOT add this entity to syncReadContract-style sync readers.)
 *
 * LOCAL ONLY v1 — no recordMutation: summaries are derived from already-synced
 * reflections + routine blocks and are regenerable, so they bypass the
 * mutation log (same posture as behaviour_events). Revisit for cross-device
 * episodic recall.
 */
import { Platform } from 'react-native';
import { and, eq, gte, desc } from 'drizzle-orm';
import { format, subDays } from 'date-fns';
import { nanoid } from '@/utils/id';
import { db } from '../index';
import { daySummaries } from '../schema';
import {
  webGetDaySummary,
  webGetRecentDaySummaries,
  webUpsertDaySummary,
} from '../webStorage/daySummariesDexie';

const isWeb = Platform.OS === 'web';

export interface DaySummaryStats {
  blocksTotal: number;
  blocksCompleted: number;
  blocksSkipped: number;
  mood: number | null;
  /** Decision actions taken that day, e.g. ['goal_paused', 'tweak_accepted']. */
  decisions: string[];
  /** First ~200 chars of the user's journal entry, if they wrote one. */
  journalExcerpt: string | null;
}

export interface DaySummary {
  id: string;
  userId: string;
  date: string;
  summary: string;
  stats: DaySummaryStats;
  source: 'ai' | 'fallback';
  createdAt: string;
  updatedAt: string;
}

const EMPTY_STATS: DaySummaryStats = {
  blocksTotal: 0,
  blocksCompleted: 0,
  blocksSkipped: 0,
  mood: null,
  decisions: [],
  journalExcerpt: null,
};

function parseStats(raw: string): DaySummaryStats {
  try {
    const parsed = JSON.parse(raw) as Partial<DaySummaryStats>;
    return { ...EMPTY_STATS, ...parsed };
  } catch {
    return { ...EMPTY_STATS };
  }
}

function decode(r: {
  id: string;
  userId: string;
  date: string;
  summary: string;
  statsJson: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}): DaySummary {
  return {
    id: r.id,
    userId: r.userId,
    date: r.date,
    summary: r.summary,
    stats: parseStats(r.statsJson),
    source: r.source === 'ai' ? 'ai' : 'fallback',
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function getDaySummary(userId: string, date: string): Promise<DaySummary | null> {
  if (isWeb) {
    const row = await webGetDaySummary(userId, date);
    return row ? decode(row) : null;
  }
  const row = db
    .select()
    .from(daySummaries)
    .where(and(eq(daySummaries.userId, userId), eq(daySummaries.date, date)))
    .get();
  return row ? decode(row) : null;
}

/** The last `days` days of summaries, newest first. */
export async function getRecentDaySummaries(userId: string, days: number): Promise<DaySummary[]> {
  const sinceDate = format(subDays(new Date(), days), 'yyyy-MM-dd');
  if (isWeb) {
    return (await webGetRecentDaySummaries(userId, sinceDate)).map(decode);
  }
  return db
    .select()
    .from(daySummaries)
    .where(and(eq(daySummaries.userId, userId), gte(daySummaries.date, sinceDate)))
    .orderBy(desc(daySummaries.date))
    .all()
    .map(decode);
}

export interface UpsertDaySummaryInput {
  userId: string;
  date: string;
  summary: string;
  stats: DaySummaryStats;
  source: 'ai' | 'fallback';
}

/** Insert-or-replace keyed by (userId, date). Returns the row id. */
export async function upsertDaySummary(input: UpsertDaySummaryInput): Promise<string> {
  const now = new Date().toISOString();
  const statsJson = JSON.stringify(input.stats);

  if (isWeb) {
    return webUpsertDaySummary({
      id: nanoid(),
      userId: input.userId,
      date: input.date,
      summary: input.summary,
      statsJson,
      source: input.source,
      createdAt: now,
      updatedAt: now,
    });
  }

  const existing = db
    .select()
    .from(daySummaries)
    .where(and(eq(daySummaries.userId, input.userId), eq(daySummaries.date, input.date)))
    .get();
  if (existing) {
    db.update(daySummaries)
      .set({ summary: input.summary, statsJson, source: input.source, updatedAt: now })
      .where(eq(daySummaries.id, existing.id))
      .run();
    return existing.id;
  }
  const id = nanoid();
  db.insert(daySummaries)
    .values({
      id,
      userId: input.userId,
      date: input.date,
      summary: input.summary,
      statsJson,
      source: input.source,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return id;
}
