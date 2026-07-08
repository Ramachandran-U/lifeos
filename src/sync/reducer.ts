/**
 * Sync reducer (P1-T6) — applies a remote (pulled) mutation to local state.
 *
 * Flow per record:
 *   1. Store it as 'applied_remote' (idempotent by id). If already stored, stop.
 *   2. Advance the local clock so later local writes order after it.
 *   3. Re-materialize the affected entity by folding its FULL history
 *      (local + applied-remote) — see resolve.ts — and write that state to the
 *      local entity table.
 *
 * CRITICAL — echo prevention: the writes here go through the LOW-LEVEL storage
 * paths (Drizzle direct / web upsert helpers) and NEVER call `recordMutation`.
 * If they did, applying a remote change would emit a new local mutation, which
 * would be pushed back, pulled again, and loop forever.
 *
 * Only entities in MATERIALIZED below are written to local tables. Unknown
 * entities are still stored for fold but not written, so adding a new synced
 * entity is just a new case here.
 */
import { Platform } from 'react-native';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import {
  goals, routineBlocks, dailyReflections, gamification,
  interests, explorationLog, expeditions, expeditionProgress, sparks,
  userProfiles, users, memoryFacts, memorySuppressions,
} from '@/db/schema';
import {
  webUpsertFactById,
  webDeleteFact,
  webUpsertSuppressionById,
  webDeleteSuppression,
  webUpsertGoalById,
  webSoftDeleteGoal,
  webUpsertRoutineBlockById,
  webDeleteRoutineBlockById,
  webUpsertReflectionById,
  webUpdateGamification,
  webUpsertInterestById,
  webUpsertExplorationById,
  webUpsertExpeditionById,
  webUpsertExpeditionProgress,
  webUpsertSparkById,
  webUpsertUserProfile,
  webUpdateUser,
  type WebGoal,
  type WebRoutineBlock,
  type WebDailyReflection,
  type WebInterest,
  type WebExplorationLog,
  type WebExpedition,
  type WebExpeditionProgress,
  type WebSpark,
  type WebMemoryFact,
  type WebMemorySuppression,
} from '@/db/webStorage';
import { getOrCreateGamification } from '@/db/queries/gamification';
import { getLocalSink, type LocalSink } from './sink';
import { materializeEntity } from './resolve';
import { observeRemoteLamport } from './runtime';
import type { MutationRecord, EntitySnapshot } from './mutationLog';

// Call-time check (not a module constant) so platform-specific paths are unit
// testable by flipping Platform.OS — production behaviour is identical since
// Platform.OS never changes at runtime.
const isWeb = () => Platform.OS === 'web';

/** Entities the reducer knows how to materialize into a local table. */
const MATERIALIZED = new Set([
  'goals', 'routine_blocks', 'daily_reflections', 'gamification',
  'interests', 'exploration_log', 'expeditions', 'expedition_progress', 'sparks',
  'user_profiles', 'users', 'memory_facts', 'memory_suppressions',
]);

/**
 * Apply one pulled mutation. Returns true if it was newly applied (false ⇒
 * already seen, an idempotent no-op). Never throws — sync is observer-only.
 */
export async function applyRemoteMutation(
  record: MutationRecord,
  sink: LocalSink = getLocalSink(),
): Promise<boolean> {
  try {
    // Keep the local clock ahead of anything we apply (idempotent).
    observeRemoteLamport(record.lamport);

    const newly = await sink.appendApplied(record);
    if (!newly) return false; // already applied — state is already materialized

    if (MATERIALIZED.has(record.entity)) {
      const history = await sink.readEntityHistory(record.entity, record.entityId);
      applyState(record.entity, record.entityId, materializeEntity(record.entity, history));
    }
    return true;
  } catch {
    // Never let a single bad record break the pull loop.
    return false;
  }
}

function applyState(entity: string, entityId: string, state: EntitySnapshot): void {
  switch (entity) {
    case 'goals':
      return applyGoal(entityId, state);
    case 'routine_blocks':
      return applyRoutineBlock(entityId, state);
    case 'daily_reflections':
      return applyReflection(entityId, state);
    case 'gamification':
      return applyGamification(entityId, state);
    case 'interests':
      return applyInterest(state);
    case 'exploration_log':
      return applyExploration(state);
    case 'expeditions':
      return applyExpedition(state);
    case 'expedition_progress':
      return applyExpeditionProgress(state);
    case 'sparks':
      return applySpark(state);
    case 'user_profiles':
      return applyUserProfile(entityId, state);
    case 'users':
      return applyUser(entityId, state);
    case 'memory_facts':
      return applyMemoryFact(entityId, state);
    case 'memory_suppressions':
      return applyMemorySuppression(entityId, state);
    default:
      return;
  }
}

/**
 * Apply a materialized state to an entity's local table WITHOUT logging a
 * mutation (echo-safe). Exposed for version-history restore (src/sync/history.ts),
 * which writes the as-of state here and records the restore as its own auditable
 * mutation separately.
 */
export function applyEntityState(entity: string, entityId: string, state: EntitySnapshot): void {
  applyState(entity, entityId, state);
}

// ── goals (soft-delete on tombstone) ────────────────────────────────────────
function applyGoal(id: string, state: EntitySnapshot): void {
  if (state === null) {
    if (isWeb()) webSoftDeleteGoal(id);
    else db.update(goals).set({ deletedAt: new Date().toISOString() }).where(eq(goals.id, id)).run();
    return;
  }
  if (isWeb()) {
    webUpsertGoalById(state as unknown as WebGoal);
  } else {
    const row = state as unknown as typeof goals.$inferInsert;
    db.insert(goals).values(row).onConflictDoUpdate({ target: goals.id, set: row }).run();
  }
}

// ── routine_blocks (hard-delete on tombstone) ───────────────────────────────
function applyRoutineBlock(id: string, state: EntitySnapshot): void {
  if (state === null) {
    if (isWeb()) webDeleteRoutineBlockById(id);
    else db.delete(routineBlocks).where(eq(routineBlocks.id, id)).run();
    return;
  }
  if (isWeb()) {
    webUpsertRoutineBlockById(state as unknown as WebRoutineBlock);
  } else {
    const row = state as unknown as typeof routineBlocks.$inferInsert;
    db.insert(routineBlocks).values(row).onConflictDoUpdate({ target: routineBlocks.id, set: row }).run();
  }
}

// ── daily_reflections (upsert; deletes are not a real app path) ──────────────
function applyReflection(id: string, state: EntitySnapshot): void {
  if (state === null) {
    if (!isWeb()) db.delete(dailyReflections).where(eq(dailyReflections.id, id)).run();
    return;
  }
  if (isWeb()) {
    webUpsertReflectionById(state as unknown as WebDailyReflection);
  } else {
    const row = state as unknown as typeof dailyReflections.$inferInsert;
    db.insert(dailyReflections).values(row).onConflictDoUpdate({ target: dailyReflections.id, set: row }).run();
  }
}

// ── gamification (per-user singleton, keyed by userId; CRDT-merged) ──────────
// `entityId` here is the userId. We write the merged counter/set/gauge fields
// by userId, preserving the local row's own id, and never call
// updateGamification (which logs a mutation) — that would echo-loop.
function applyGamification(userId: string, state: EntitySnapshot): void {
  if (state === null) return;
  const fields = {
    domainScores: asJsonString(state.domainScores, '{}'),
    streaks: asJsonString(state.streaks, '{}'),
    badges: asJsonString(state.badges, '[]'),
    totalXP: Number(state.totalXP ?? 0),
    weeklyXP: Number(state.weeklyXP ?? 0),
  };
  getOrCreateGamification(userId); // ensure a local row exists (records nothing)
  if (isWeb()) {
    webUpdateGamification(userId, fields);
  } else {
    db.update(gamification)
      .set({ ...fields, updatedAt: new Date().toISOString() })
      .where(eq(gamification.userId, userId))
      .run();
  }
}

/** Coerce a possibly-object/possibly-string JSON column to its string form. */
function asJsonString(v: unknown, fallback: string): string {
  if (typeof v === 'string') return v;
  if (v == null) return fallback;
  try {
    return JSON.stringify(v);
  } catch {
    return fallback;
  }
}

// ── Explore: id-keyed entities (interests soft-deletes via status, never null) ──
function applyInterest(state: EntitySnapshot): void {
  if (state === null) return;
  if (isWeb()) { webUpsertInterestById(state as unknown as WebInterest); return; }
  const row = state as unknown as typeof interests.$inferInsert;
  db.insert(interests).values(row).onConflictDoUpdate({ target: interests.id, set: row }).run();
}

function applyExploration(state: EntitySnapshot): void {
  if (state === null) return;
  if (isWeb()) { webUpsertExplorationById(state as unknown as WebExplorationLog); return; }
  const row = state as unknown as typeof explorationLog.$inferInsert;
  db.insert(explorationLog).values(row).onConflictDoUpdate({ target: explorationLog.id, set: row }).run();
}

function applyExpedition(state: EntitySnapshot): void {
  if (state === null) return;
  if (isWeb()) { webUpsertExpeditionById(state as unknown as WebExpedition); return; }
  const row = state as unknown as typeof expeditions.$inferInsert;
  db.insert(expeditions).values(row).onConflictDoUpdate({ target: expeditions.id, set: row }).run();
}

function applySpark(state: EntitySnapshot): void {
  if (state === null) return;
  if (isWeb()) { webUpsertSparkById(state as unknown as WebSpark); return; }
  const row = state as unknown as typeof sparks.$inferInsert;
  db.insert(sparks).values(row).onConflictDoUpdate({ target: sparks.id, set: row }).run();
}

// ── expedition_progress: per-user-per-expedition singleton; upsert by the key ──
function applyExpeditionProgress(state: EntitySnapshot): void {
  if (state === null) return;
  if (isWeb()) { webUpsertExpeditionProgress(state as unknown as WebExpeditionProgress); return; }
  const row = state as unknown as typeof expeditionProgress.$inferInsert;
  const existing = db.select().from(expeditionProgress)
    .where(and(eq(expeditionProgress.userId, row.userId), eq(expeditionProgress.expeditionId, row.expeditionId)))
    .get();
  if (existing) db.update(expeditionProgress).set(row).where(eq(expeditionProgress.id, existing.id)).run();
  else db.insert(expeditionProgress).values(row).run();
}

// ── memory: durable facts + suppression tombstones (hard-delete on tombstone) ──
// Writes go through the low-level web/drizzle paths only — memoryStore's own
// functions record mutations and would echo-loop.
function applyMemoryFact(id: string, state: EntitySnapshot): void {
  if (state === null) {
    if (isWeb()) webDeleteFact(id);
    else db.delete(memoryFacts).where(eq(memoryFacts.id, id)).run();
    return;
  }
  if (isWeb()) {
    webUpsertFactById(state as unknown as WebMemoryFact);
  } else {
    const row = state as unknown as typeof memoryFacts.$inferInsert;
    db.insert(memoryFacts).values(row).onConflictDoUpdate({ target: memoryFacts.id, set: row }).run();
  }
}

function applyMemorySuppression(id: string, state: EntitySnapshot): void {
  if (state === null) {
    if (isWeb()) webDeleteSuppression(id);
    else db.delete(memorySuppressions).where(eq(memorySuppressions.id, id)).run();
    return;
  }
  if (isWeb()) {
    webUpsertSuppressionById(state as unknown as WebMemorySuppression);
  } else {
    const row = state as unknown as typeof memorySuppressions.$inferInsert;
    db.insert(memorySuppressions).values(row).onConflictDoUpdate({ target: memorySuppressions.id, set: row }).run();
  }
}

// ── profile: per-user singletons keyed by userId ─────────────────────────────
function applyUserProfile(userId: string, state: EntitySnapshot): void {
  if (state === null) return;
  if (isWeb()) {
    try {
      webUpsertUserProfile(
        userId,
        JSON.parse(asJsonString(state.profile, '{}')) as Parameters<typeof webUpsertUserProfile>[1],
      );
    } catch {
      // malformed profile JSON — skip rather than crash the pull loop
    }
    return;
  }
  const row = {
    userId,
    profile: asJsonString(state.profile, '{}'),
    source: String(state.source ?? 'chat'),
    confidenceOverall: Number(state.confidenceOverall ?? 0),
    routineUnlocked: Boolean(state.routineUnlocked),
    updatedAt: new Date().toISOString(),
  };
  const existing = db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).get();
  if (existing) db.update(userProfiles).set(row).where(eq(userProfiles.userId, userId)).run();
  else db.insert(userProfiles).values({ ...row, createdAt: new Date().toISOString() }).run();
}

// users: UPDATE-ONLY profile fields. Never creates a credential-less row, never
// writes identity/credential columns (the snapshot carries none, but strip
// defensively).
function applyUser(userId: string, state: EntitySnapshot): void {
  if (state === null) return;
  if (isWeb()) {
    webUpdateUser(userId, state as unknown as Parameters<typeof webUpdateUser>[1]);
    return;
  }
  const set: Record<string, unknown> = { ...state, updatedAt: new Date().toISOString() };
  if (Array.isArray(set.primaryDomains)) set.primaryDomains = JSON.stringify(set.primaryDomains);
  if (Array.isArray(set.activatedModules)) set.activatedModules = JSON.stringify(set.activatedModules);
  delete set.id;
  delete set.email;
  delete set.passwordHash;
  delete set.passwordSalt;
  delete set.createdAt;
  db.update(users).set(set as Partial<typeof users.$inferInsert>).where(eq(users.id, userId)).run();
}
