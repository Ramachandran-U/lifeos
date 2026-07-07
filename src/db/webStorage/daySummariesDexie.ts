/**
 * Web (Dexie/IndexedDB) persistence for day summaries — the episodic-memory
 * record. Deliberately NOT the localStorage per-entity shim: a narrative
 * paragraph per day accumulates for years and must not eat the shared ~5MB
 * quota, and nothing in the render path needs synchronous reads from it (the
 * consumers — day-summary generation, consolidation, agent tools — are all
 * async). Mirrors the finance store's Dexie pattern
 * (src/finance/db/transactionDb.ts), in its own database so finance schema
 * versioning stays untangled.
 */
import Dexie, { type Table } from 'dexie';

export interface WebDaySummary {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  summary: string;
  statsJson: string;
  source: string; // 'ai' | 'fallback'
  createdAt: string;
  updatedAt: string;
}

class EpisodicDb extends Dexie {
  daySummaries!: Table<WebDaySummary, string>;

  constructor() {
    super('lifeos_episodic');
    this.version(1).stores({
      // [userId+date] compound index = the upsert key; date for range scans.
      daySummaries: 'id, [userId+date], userId, date',
    });
  }
}

let dbInstance: EpisodicDb | null = null;

function getDb(): EpisodicDb {
  if (!dbInstance) dbInstance = new EpisodicDb();
  return dbInstance;
}

export async function webGetDaySummary(userId: string, date: string): Promise<WebDaySummary | null> {
  const row = await getDb().daySummaries.where('[userId+date]').equals([userId, date]).first();
  return row ?? null;
}

export async function webGetRecentDaySummaries(userId: string, sinceDate: string): Promise<WebDaySummary[]> {
  const rows = await getDb().daySummaries.where('userId').equals(userId).toArray();
  return rows
    .filter((r) => r.date >= sinceDate)
    .sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first
}

/** Insert-or-replace keyed by (userId, date) — preserves id/createdAt on update. */
export async function webUpsertDaySummary(row: Omit<WebDaySummary, 'id' | 'createdAt'> & { id: string; createdAt: string }): Promise<string> {
  const existing = await webGetDaySummary(row.userId, row.date);
  if (existing) {
    await getDb().daySummaries.update(existing.id, {
      summary: row.summary,
      statsJson: row.statsJson,
      source: row.source,
      updatedAt: row.updatedAt,
    });
    return existing.id;
  }
  await getDb().daySummaries.put(row);
  return row.id;
}

export async function webDeleteAllDaySummariesForUser(userId: string): Promise<void> {
  await getDb().daySummaries.where('userId').equals(userId).delete();
}

/** Tests only — swap the Dexie instance (e.g. fake-indexeddb). */
export function _setEpisodicDbForTests(db: unknown): void {
  dbInstance = db as EpisodicDb;
}
