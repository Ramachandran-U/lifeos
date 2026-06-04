import { load, save } from './_io';
import { MEMORY_FACTS_KEY } from './_keys';

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
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string | null;
}

export function webGetFactsByUser(userId: string): WebMemoryFact[] {
  return load<WebMemoryFact>(MEMORY_FACTS_KEY).filter((r) => r.userId === userId);
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
