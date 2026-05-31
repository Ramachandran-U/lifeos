/**
 * Conflict resolution (P1-T6) — pure, deterministic, no I/O.
 *
 * Convergence is achieved by EVENT-SOURCED FOLD, not by ad-hoc pairwise merge:
 * to materialize an entity's current state we replay ALL of its mutations
 * (local + applied-remote) in a single deterministic total order, applying each
 * one's effect. Two devices that have seen the same set of mutations therefore
 * always compute byte-identical state, regardless of the order they arrived.
 *
 * Total order: `(lamport, deviceId, id)`. Lamport is the authoritative logical
 * clock; deviceId breaks concurrent (equal-lamport) ties; id is a final
 * determinism backstop. Wall-clock `ts` is NEVER used for ordering.
 *
 * The merge rules from the design (B.3) fall out of replaying in this order:
 *   - update/update: each update applies only its CHANGED fields, so two
 *     concurrent updates to *different* fields both survive (field-merge);
 *     for the *same* field, the higher-ordered update lands last and wins (LWW).
 *   - update/delete: a delete tombstones the state; a later (higher-ordered)
 *     update resurrects from its full `after` snapshot.
 *   - insert/insert (same id): higher-ordered insert wins.
 *
 * Idempotency is the caller's job: feed each distinct mutation once (dedup by
 * id upstream). Replaying the same set twice yields the same state regardless.
 */
import type { MutationRecord, EntitySnapshot } from './mutationLog';

/**
 * Total order over mutations. Negative ⇒ a before b. Pure and stable:
 * lamport, then deviceId lexicographically, then id.
 */
export function compareMutationOrder(a: MutationRecord, b: MutationRecord): number {
  if (a.lamport !== b.lamport) return a.lamport - b.lamport;
  if (a.deviceId !== b.deviceId) return a.deviceId < b.deviceId ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

/**
 * Fold an entity's full mutation history into its current materialized state.
 * Returns `null` when the entity's net state is "deleted" (tombstone) or when
 * there are no mutations.
 *
 * `after` snapshots are full rows (the write path records `{...before, ...changed}`),
 * so a lone update — or an update after a delete — can rebuild the whole row.
 */
export function foldEntity(mutations: MutationRecord[]): EntitySnapshot {
  const ordered = [...mutations].sort(compareMutationOrder);
  let state: Record<string, unknown> | null = null;

  for (const m of ordered) {
    if (m.op === 'insert') {
      state = m.after ? { ...m.after } : state;
    } else if (m.op === 'update') {
      if (!m.after) continue;
      if (state === null) {
        // Resurrect from the full snapshot (delete-then-update, or a fresh
        // device that only has this update).
        state = { ...m.after };
      } else {
        // Field-merge: apply only the columns this update changed.
        const after = m.after as Record<string, unknown>;
        for (const f of m.fields) state[f] = after[f];
      }
    } else {
      // delete → tombstone.
      state = null;
    }
  }

  return state;
}
