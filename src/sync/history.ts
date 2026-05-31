/**
 * Version history + restore (P1-T7) — built on the mutation log.
 *
 * Everything an entity ever was is already in the log; these read it back:
 *   - getEntityHistory — the audit timeline (each write's snapshot), oldest→newest
 *   - stateAsOf        — the materialized state as-of a lamport (or wall-clock ts)
 *   - restoreEntityTo  — set the entity back to an earlier state, recorded as a
 *                        NEW mutation (auditable, syncs) — never a destructive
 *                        rewind. Resurrects soft/hard-deleted document entities.
 *
 * CAVEAT — restore + CRDTs: for counter/set entities (gamification XP, interests
 * minutes, expedition_progress steps) the merge is monotonic (max / union), so
 * restore cannot *lower* those values; it restores the document-shaped fields
 * and records the event, but a counter won't go backwards. Restore is meant for
 * document entities (goals, routine, reflections, sparks, expeditions, profile).
 *
 * Pure read paths (getEntityHistory/stateAsOf) take an injectable sink for
 * testability. restoreEntityTo lazy-imports the reducer + runtime so the read
 * paths don't pull the DB/write chain.
 */
import { getLocalSink, type LocalSink } from './sink';
import { compareMutationOrder, materializeEntity } from './resolve';
import type { MutationRecord, MutationOp, EntitySnapshot } from './mutationLog';

export interface HistoryEntry {
  /** Mutation id. */
  id: string;
  lamport: number;
  /** ISO wall clock (display only). */
  ts: string;
  op: MutationOp;
  deviceId: string;
  /** The snapshot written at this point (an update may be a partial snapshot). */
  after: EntitySnapshot;
}

/** A point in an entity's history: prefer `lamport` (precise); `ts` is for UX. */
export interface AsOfPoint {
  lamport?: number;
  ts?: string;
}

/** The audit timeline for one entity row, oldest→newest. */
export async function getEntityHistory(
  entity: string,
  entityId: string,
  sink: LocalSink = getLocalSink(),
): Promise<HistoryEntry[]> {
  const muts = (await sink.readEntityHistory(entity, entityId)).sort(compareMutationOrder);
  return muts.map((m) => ({
    id: m.id,
    lamport: m.lamport,
    ts: m.ts,
    op: m.op,
    deviceId: m.deviceId,
    after: m.after,
  }));
}

function matchesAsOf(m: MutationRecord, point: AsOfPoint): boolean {
  if (point.lamport !== undefined) return m.lamport <= point.lamport;
  if (point.ts !== undefined) return m.ts <= point.ts;
  return true; // no bound → current state
}

/** Materialized entity state as-of a point (folds mutations up to it). */
export async function stateAsOf(
  entity: string,
  entityId: string,
  point: AsOfPoint,
  sink: LocalSink = getLocalSink(),
): Promise<EntitySnapshot> {
  const muts = (await sink.readEntityHistory(entity, entityId)).filter((m) => matchesAsOf(m, point));
  return materializeEntity(entity, muts);
}

/**
 * Restore an entity to its state as-of a point. Writes that state to the local
 * table immediately AND records it as a new mutation (so the restore is itself
 * auditable and syncs to other devices). Returns the restored state, or null if
 * the entity didn't exist at that point (nothing to bring back).
 */
export async function restoreEntityTo(
  entity: string,
  entityId: string,
  point: AsOfPoint,
  sink: LocalSink = getLocalSink(),
): Promise<EntitySnapshot> {
  const asOf = await stateAsOf(entity, entityId, point, sink);
  if (asOf === null) return null;

  // Lazy so the read paths above don't pull the reducer/runtime/DB chain.
  const [{ applyEntityState }, { recordMutation }] = await Promise.all([
    import('./reducer'),
    import('./runtime'),
  ]);
  applyEntityState(entity, entityId, asOf); // local table, echo-safe (no log)
  recordMutation({ entity, entityId, op: 'update', before: null, after: asOf }); // auditable + syncs
  return asOf;
}
