/**
 * Durable memory store — persistent, long-horizon facts about the user.
 *
 * Storage: SQLite `memory_facts`, embeddings as a JSON number[], ranked with JS
 * cosine (no vector DB — fact counts are small, a linear scan is fine). Mirrors
 * the aiSuggestions precedent: persistence is a NATIVE concern; on web (dev /
 * preview) the writes are no-ops and reads return empty.
 *
 * The pure helpers (decay, dedup, ranking) are exported and unit-tested without
 * a DB; the DB-bound functions compose them.
 */
import { Platform } from 'react-native';
import { eq } from 'drizzle-orm';
import { nanoid } from '@/utils/id';
import { db } from '@/db';
import { memoryFacts } from '@/db/schema';
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

// --- DB-bound (native-only persistence) ---

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

export function getFactsByUser(userId: string): MemoryFact[] {
  if (isWeb) return [];
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
  if (isWeb) return nanoid();

  const existing = getFactsByUser(input.userId);
  const dup = findDuplicate(embedding, existing);
  const now = nowMs ?? Date.now();
  const nowIso = new Date(now).toISOString();

  if (dup) {
    const bumped = Math.min(1, dup.salience + SALIENCE_BUMP);
    db.update(memoryFacts)
      .set({ salience: bumped, lastSeenAt: nowIso })
      .where(eq(memoryFacts.id, dup.id))
      .run();
    return dup.id;
  }

  const id = nanoid();
  const expiresAt = input.ttlDays ? new Date(now + input.ttlDays * 86_400_000).toISOString() : null;
  db.insert(memoryFacts)
    .values({
      id,
      userId: input.userId,
      kind: input.kind,
      text: input.text,
      embedding: JSON.stringify(embedding),
      salience: 1,
      sourceWindow: input.sourceWindow ?? null,
      createdAt: nowIso,
      lastSeenAt: nowIso,
      expiresAt,
    })
    .run();
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
  if (isWeb) return;
  db.delete(memoryFacts).where(eq(memoryFacts.id, id)).run();
}

export function deleteAllFactsForUser(userId: string): void {
  if (isWeb) return;
  db.delete(memoryFacts).where(eq(memoryFacts.userId, userId)).run();
}
