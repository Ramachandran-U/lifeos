import { load, save } from './_io';
import { MEMORY_FACTS_KEY, MEMORY_SUPPRESSIONS_KEY } from './_keys';

/**
 * Web (localStorage) persistence for durable memory facts — the web counterpart
 * of the native SQLite `memory_facts` table, so "What LifeOS remembers" works on
 * the web/PWA build too (previously native-only). JSON columns (embedding) are
 * stored as strings, mirroring the SQLite row shape.
 */
export interface WebMemoryFact {
  id: string;
  userId: string;
  kind: string;
  text: string;
  embedding: string | null; // JSON number[]
  salience: number;
  sourceWindow: string | null;
  pinned?: boolean; // optional for rows written before pinning shipped
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string | null;
}

export function webGetFactsByUser(userId: string): WebMemoryFact[] {
  return load<WebMemoryFact>(MEMORY_FACTS_KEY).filter((r) => r.userId === userId);
}

export function webGetFactById(id: string): WebMemoryFact | null {
  return load<WebMemoryFact>(MEMORY_FACTS_KEY).find((r) => r.id === id) ?? null;
}

/** Insert-or-replace by id — the sync reducer's echo-safe write path. */
export function webUpsertFactById(row: WebMemoryFact): void {
  const all = load<WebMemoryFact>(MEMORY_FACTS_KEY);
  const idx = all.findIndex((r) => r.id === row.id);
  if (idx === -1) all.push(row);
  else all[idx] = row;
  save(MEMORY_FACTS_KEY, all);
}

export function webInsertFact(row: WebMemoryFact): void {
  const all = load<WebMemoryFact>(MEMORY_FACTS_KEY);
  all.push(row);
  save(MEMORY_FACTS_KEY, all);
}

/** Patch fields on a fact in place (salience bump, edit, pin). No-op if absent. */
export function webUpdateFact(id: string, patch: Partial<Omit<WebMemoryFact, 'id'>>): void {
  const all = load<WebMemoryFact>(MEMORY_FACTS_KEY);
  const idx = all.findIndex((r) => r.id === id);
  if (idx === -1) return;
  all[idx] = { ...all[idx]!, ...patch };
  save(MEMORY_FACTS_KEY, all);
}

export function webDeleteFact(id: string): void {
  save(MEMORY_FACTS_KEY, load<WebMemoryFact>(MEMORY_FACTS_KEY).filter((r) => r.id !== id));
}

export function webDeleteAllFactsForUser(userId: string): void {
  save(MEMORY_FACTS_KEY, load<WebMemoryFact>(MEMORY_FACTS_KEY).filter((r) => r.userId !== userId));
}

/** Tombstone for a deleted fact (so consolidation won't re-derive it). */
export interface WebMemorySuppression {
  id: string;
  userId: string;
  text: string;
  embedding: string | null; // JSON number[]
  createdAt: string;
}

export function webGetSuppressionsByUser(userId: string): WebMemorySuppression[] {
  return load<WebMemorySuppression>(MEMORY_SUPPRESSIONS_KEY).filter((r) => r.userId === userId);
}

export function webInsertSuppression(row: WebMemorySuppression): void {
  const all = load<WebMemorySuppression>(MEMORY_SUPPRESSIONS_KEY);
  all.push(row);
  save(MEMORY_SUPPRESSIONS_KEY, all);
}

/** Insert-or-replace by id — the sync reducer's echo-safe write path. */
export function webUpsertSuppressionById(row: WebMemorySuppression): void {
  const all = load<WebMemorySuppression>(MEMORY_SUPPRESSIONS_KEY);
  const idx = all.findIndex((r) => r.id === row.id);
  if (idx === -1) all.push(row);
  else all[idx] = row;
  save(MEMORY_SUPPRESSIONS_KEY, all);
}

export function webDeleteSuppression(id: string): void {
  save(
    MEMORY_SUPPRESSIONS_KEY,
    load<WebMemorySuppression>(MEMORY_SUPPRESSIONS_KEY).filter((r) => r.id !== id),
  );
}
