/**
 * Durable memory store — persistent, long-horizon facts about the user.
 *
 * Storage: SQLite `memory_facts` on native, the localStorage web shim
 * (`src/db/webStorage/memory.ts`) on web — so "What LifeOS remembers" works on
 * the web/PWA build too. Embeddings are a JSON number[], ranked with JS cosine
 * (no vector DB — fact counts are small, a linear scan is fine).
 *
 * The pure helpers (decay, dedup, ranking) are exported and unit-tested without
 * storage; the storage-bound functions compose them and branch on platform.
 */
import { Platform } from 'react-native';
import { eq } from 'drizzle-orm';
import { nanoid } from '@/utils/id';
import { db } from '@/db';
import { memoryFacts, memorySuppressions } from '@/db/schema';
import {
  webGetFactsByUser,
  webInsertFact,
  webUpdateFact,
  webDeleteFact,
  webDeleteAllFactsForUser,
  webGetSuppressionsByUser,
  webInsertSuppression,
  type WebMemoryFact,
  type WebMemorySuppression,
} from '@/db/webStorage/memory';
import { embedText } from './embed';
import { cosine } from './retrieve';

const isWeb = Platform.OS === 'web';

export type MemoryFactKind = 'preference' | 'pattern' | 'milestone' | 'constraint';

export interface MemoryFact {
  id: string;
  userId: string;
  kind: MemoryFactKind;
  text: string;
  salience: number;
  sourceWindow: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string | null;
  embedding: number[] | null;
}

export interface MemorySuppression {
  id: string;
  userId: string;
  text: string;
  embedding: number[] | null;
  createdAt: string;
}

/** Cosine ≥ this between two facts means they're the same fact (merge, don't duplicate). */
export const DEDUP_THRESHOLD = 0.92;
/** Salience halves after this many days without re-observation. */
export const DEFAULT_HALF_LIFE_DAYS = 30;
/** Re-observing a fact bumps its salience by this much (capped at 1). */
export const SALIENCE_BUMP = 0.2;
/** Facts below this effective salience are treated as forgotten. */
export const MIN_EFFECTIVE_SALIENCE = 0.1;

// --- Pure helpers (no DB) ---

/** Salience decayed by age since it was last seen. Pure. */
export function decayedSalience(
  salience: number,
  lastSeenAt: string,
  now: number,
  halfLifeDays = DEFAULT_HALF_LIFE_DAYS,
): number {
  const ageMs = now - Date.parse(lastSeenAt);
  if (!Number.isFinite(ageMs) || ageMs <= 0) return salience;
  const ageDays = ageMs / 86_400_000;
  return salience * Math.pow(0.5, ageDays / halfLifeDays);
}

/** Is a fact still "remembered" — not hard-expired and above the salience floor? Pure. */
export function isFactLive(fact: MemoryFact, now: number, halfLifeDays = DEFAULT_HALF_LIFE_DAYS): boolean {
  if (fact.expiresAt && Date.parse(fact.expiresAt) <= now) return false;
  return decayedSalience(fact.salience, fact.lastSeenAt, now, halfLifeDays) >= MIN_EFFECTIVE_SALIENCE;
}

/** The existing fact most similar to a new embedding, if above the dedup threshold. Pure. */
export function findDuplicate(
  embedding: number[],
  existing: MemoryFact[],
  threshold = DEDUP_THRESHOLD,
): MemoryFact | null {
  let best: MemoryFact | null = null;
  let bestScore = threshold;
  for (const f of existing) {
    if (!f.embedding) continue;
    const score = cosine(embedding, f.embedding);
    if (score >= bestScore) {
      best = f;
      bestScore = score;
    }
  }
  return best;
}

/** True if an embedding matches any suppression tombstone (≥ threshold). Pure. */
export function isSuppressed(
  embedding: number[],
  suppressions: MemorySuppression[],
  threshold = DEDUP_THRESHOLD,
): boolean {
  for (const s of suppressions) {
    if (s.embedding && cosine(embedding, s.embedding) >= threshold) return true;
  }
  return false;
}

/**
 * Rank live facts by relevance to a query embedding, blended with decayed
 * salience so a strong-but-old fact and a weak-but-fresh fact compete fairly.
 * Pure — takes facts with embeddings already loaded.
 */
export function rankFactsBySimilarity(
  queryEmbedding: number[],
  facts: MemoryFact[],
  k: number,
  now: number,
  halfLifeDays = DEFAULT_HALF_LIFE_DAYS,
): MemoryFact[] {
  return facts
    .filter((f) => f.embedding && isFactLive(f, now, halfLifeDays))
    .map((f) => {
      const sim = cosine(queryEmbedding, f.embedding!);
      const sal = decayedSalience(f.salience, f.lastSeenAt, now, halfLifeDays);
      // Similarity dominates; salience is a gentle tie-breaker / prior.
      return { fact: f, rank: sim * 0.8 + sal * 0.2 };
    })
    .sort((a, b) => b.rank - a.rank)
    .slice(0, k)
    .map((x) => x.fact);
}

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Human label for a consolidation `sourceWindow` ("2026-05-01..2026-05-31" →
 * "1–31 May 2026"), or null when there's no window (e.g. user-added facts).
 * Pure — provenance for the "why do you remember this?" line.
 */
export function formatSourceWindow(sourceWindow: string | null): string | null {
  if (!sourceWindow) return null;
  const m = sourceWindow.match(/^(\d{4})-(\d{2})-(\d{2})\.\.(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y1 = m[1], mo1 = Number(m[2]), d1 = Number(m[3]);
  const y2 = m[4], mo2 = Number(m[5]), d2 = Number(m[6]);
  const mon1 = MONTH_SHORT[mo1 - 1];
  const mon2 = MONTH_SHORT[mo2 - 1];
  if (!mon1 || !mon2) return null;
  if (y1 === y2 && mo1 === mo2) return `${d1}–${d2} ${mon1} ${y1}`;
  if (y1 === y2) return `${d1} ${mon1} – ${d2} ${mon2} ${y1}`;
  return `${d1} ${mon1} ${y1} – ${d2} ${mon2} ${y2}`;
}

/** Coarse relative-time ("today", "3 days ago", "2 months ago"). Pure. */
export function relativeSince(iso: string, now: number): string {
  const ms = now - Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  const days = Math.floor(ms / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'last week';
  if (days < 31) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return 'over a year ago';
}

// --- storage-bound (native SQLite / web localStorage) ---

function decodeRow(r: typeof memoryFacts.$inferSelect): MemoryFact {
  let embedding: number[] | null = null;
  if (r.embedding) {
    try {
      const parsed = JSON.parse(r.embedding);
      if (Array.isArray(parsed)) embedding = parsed as number[];
    } catch {
      embedding = null;
    }
  }
  return {
    id: r.id,
    userId: r.userId,
    kind: r.kind as MemoryFactKind,
    text: r.text,
    salience: r.salience,
    sourceWindow: r.sourceWindow,
    createdAt: r.createdAt,
    lastSeenAt: r.lastSeenAt,
    expiresAt: r.expiresAt,
    embedding,
  };
}

function decodeWebRow(r: WebMemoryFact): MemoryFact {
  let embedding: number[] | null = null;
  if (r.embedding) {
    try {
      const parsed = JSON.parse(r.embedding);
      if (Array.isArray(parsed)) embedding = parsed as number[];
    } catch {
      embedding = null;
    }
  }
  return {
    id: r.id,
    userId: r.userId,
    kind: r.kind as MemoryFactKind,
    text: r.text,
    salience: r.salience,
    sourceWindow: r.sourceWindow,
    createdAt: r.createdAt,
    lastSeenAt: r.lastSeenAt,
    expiresAt: r.expiresAt,
    embedding,
  };
}

export function getFactsByUser(userId: string): MemoryFact[] {
  if (isWeb) return webGetFactsByUser(userId).map(decodeWebRow);
  return db
    .select()
    .from(memoryFacts)
    .where(eq(memoryFacts.userId, userId))
    .all()
    .map(decodeRow);
}

export interface UpsertFactInput {
  userId: string;
  kind: MemoryFactKind;
  text: string;
  sourceWindow?: string;
  /** Optional hard expiry, days from now. */
  ttlDays?: number;
}

/**
 * Insert a fact, or — if a near-identical one already exists — bump its salience
 * and lastSeenAt instead of duplicating. Returns the fact id (existing on merge).
 */
export async function upsertFact(input: UpsertFactInput, nowMs?: number): Promise<string> {
  const embedding = await embedText(input.text);
  const now = nowMs ?? Date.now();
  const nowIso = new Date(now).toISOString();

  const existing = getFactsByUser(input.userId);
  const dup = findDuplicate(embedding, existing);

  if (dup) {
    const bumped = Math.min(1, dup.salience + SALIENCE_BUMP);
    if (isWeb) {
      webUpdateFact(dup.id, { salience: bumped, lastSeenAt: nowIso });
    } else {
      db.update(memoryFacts)
        .set({ salience: bumped, lastSeenAt: nowIso })
        .where(eq(memoryFacts.id, dup.id))
        .run();
    }
    return dup.id;
  }

  const id = nanoid();
  const expiresAt = input.ttlDays ? new Date(now + input.ttlDays * 86_400_000).toISOString() : null;
  const embeddingJson = JSON.stringify(embedding);
  if (isWeb) {
    webInsertFact({
      id,
      userId: input.userId,
      kind: input.kind,
      text: input.text,
      embedding: embeddingJson,
      salience: 1,
      sourceWindow: input.sourceWindow ?? null,
      createdAt: nowIso,
      lastSeenAt: nowIso,
      expiresAt,
    });
  } else {
    db.insert(memoryFacts)
      .values({
        id,
        userId: input.userId,
        kind: input.kind,
        text: input.text,
        embedding: embeddingJson,
        salience: 1,
        sourceWindow: input.sourceWindow ?? null,
        createdAt: nowIso,
        lastSeenAt: nowIso,
        expiresAt,
      })
      .run();
  }
  return id;
}

/** Top-k live facts most relevant to `query` for a user. */
export async function searchFacts(
  userId: string,
  query: string,
  k = 5,
  nowMs?: number,
): Promise<MemoryFact[]> {
  if (isWeb) return [];
  const facts = getFactsByUser(userId);
  if (facts.length === 0) return [];
  const queryEmbedding = await embedText(query);
  return rankFactsBySimilarity(queryEmbedding, facts, k, nowMs ?? Date.now());
}

export function deleteFact(id: string): void {
  if (isWeb) {
    webDeleteFact(id);
    return;
  }
  db.delete(memoryFacts).where(eq(memoryFacts.id, id)).run();
}

export function deleteAllFactsForUser(userId: string): void {
  if (isWeb) {
    webDeleteAllFactsForUser(userId);
    return;
  }
  db.delete(memoryFacts).where(eq(memoryFacts.userId, userId)).run();
}

// --- suppression tombstones (so "forget" sticks across consolidations) ---

function decodeSuppression(r: {
  id: string;
  userId: string;
  text: string;
  embedding: string | null;
  createdAt: string;
}): MemorySuppression {
  let embedding: number[] | null = null;
  if (r.embedding) {
    try {
      const parsed = JSON.parse(r.embedding);
      if (Array.isArray(parsed)) embedding = parsed as number[];
    } catch {
      embedding = null;
    }
  }
  return { id: r.id, userId: r.userId, text: r.text, embedding, createdAt: r.createdAt };
}

export function getSuppressions(userId: string): MemorySuppression[] {
  if (isWeb) return webGetSuppressionsByUser(userId).map(decodeSuppression);
  return db
    .select()
    .from(memorySuppressions)
    .where(eq(memorySuppressions.userId, userId))
    .all()
    .map(decodeSuppression);
}

export function addSuppression(
  userId: string,
  text: string,
  embedding: number[] | null,
  nowMs?: number,
): void {
  const row: WebMemorySuppression = {
    id: nanoid(),
    userId,
    text,
    embedding: embedding ? JSON.stringify(embedding) : null,
    createdAt: new Date(nowMs ?? Date.now()).toISOString(),
  };
  if (isWeb) {
    webInsertSuppression(row);
    return;
  }
  db.insert(memorySuppressions).values(row).run();
}

/**
 * Delete a fact AND tombstone it, so the next consolidation won't re-derive the
 * same thing. The sync delete happens before any await, so a UI reload right
 * after sees the fact gone immediately.
 */
export async function forgetFact(fact: MemoryFact): Promise<void> {
  deleteFact(fact.id);
  const embedding = fact.embedding ?? (await embedText(fact.text));
  addSuppression(fact.userId, fact.text, embedding);
}

/** Has a fact with this text been suppressed by the user? Embeds + checks. */
export async function isFactSuppressed(userId: string, text: string): Promise<boolean> {
  const suppressions = getSuppressions(userId);
  if (suppressions.length === 0) return false;
  const embedding = await embedText(text);
  return isSuppressed(embedding, suppressions);
}
