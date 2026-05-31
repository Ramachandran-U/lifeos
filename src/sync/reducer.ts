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
 * Only goals / routine_blocks / daily_reflections are materialized (the only
 * synced entities today). Unknown entities are still stored for fold but not
 * written, so adding a new synced entity is just a new case here.
 */
import { Platform } from 'react-native';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { goals, routineBlocks, dailyReflections } from '@/db/schema';
import {
  webUpsertGoalById,
  webSoftDeleteGoal,
  webUpsertRoutineBlockById,
  webDeleteRoutineBlockById,
  webUpsertReflectionById,
  type WebGoal,
  type WebRoutineBlock,
  type WebDailyReflection,
} from '@/db/webStorage';
import { getLocalSink, type LocalSink } from './sink';
import { foldEntity } from './resolve';
import { observeRemoteLamport } from './runtime';
import type { MutationRecord, EntitySnapshot } from './mutationLog';

const isWeb = Platform.OS === 'web';

/** Entities the reducer knows how to materialize into a local table. */
const MATERIALIZED = new Set(['goals', 'routine_blocks', 'daily_reflections']);

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
      applyState(record.entity, record.entityId, foldEntity(history));
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
    default:
      return;
  }
}

// ── goals (soft-delete on tombstone) ────────────────────────────────────────
function applyGoal(id: string, state: EntitySnapshot): void {
  if (state === null) {
    if (isWeb) webSoftDeleteGoal(id);
    else db.update(goals).set({ deletedAt: new Date().toISOString() }).where(eq(goals.id, id)).run();
    return;
  }
  if (isWeb) {
    webUpsertGoalById(state as unknown as WebGoal);
  } else {
    const row = state as unknown as typeof goals.$inferInsert;
    db.insert(goals).values(row).onConflictDoUpdate({ target: goals.id, set: row }).run();
  }
}

// ── routine_blocks (hard-delete on tombstone) ───────────────────────────────
function applyRoutineBlock(id: string, state: EntitySnapshot): void {
  if (state === null) {
    if (isWeb) webDeleteRoutineBlockById(id);
    else db.delete(routineBlocks).where(eq(routineBlocks.id, id)).run();
    return;
  }
  if (isWeb) {
    webUpsertRoutineBlockById(state as unknown as WebRoutineBlock);
  } else {
    const row = state as unknown as typeof routineBlocks.$inferInsert;
    db.insert(routineBlocks).values(row).onConflictDoUpdate({ target: routineBlocks.id, set: row }).run();
  }
}

// ── daily_reflections (upsert; deletes are not a real app path) ──────────────
function applyReflection(id: string, state: EntitySnapshot): void {
  if (state === null) {
    if (!isWeb) db.delete(dailyReflections).where(eq(dailyReflections.id, id)).run();
    return;
  }
  if (isWeb) {
    webUpsertReflectionById(state as unknown as WebDailyReflection);
  } else {
    const row = state as unknown as typeof dailyReflections.$inferInsert;
    db.insert(dailyReflections).values(row).onConflictDoUpdate({ target: dailyReflections.id, set: row }).run();
  }
}
