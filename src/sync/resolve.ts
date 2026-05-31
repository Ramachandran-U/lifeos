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

// ── entity-specific CRDT merge (P1 coverage extension) ──────────────────────
//
// Some entities are NOT document-shaped: they hold counters, sets, or gauges in
// one row, where field-LWW would silently lose data (e.g. XP earned on two
// devices, or a badge earned on the other one). Those register a commutative,
// idempotent merge here instead of using the default fold.

type Snapshot = Record<string, unknown>;

function parseJson<T>(v: unknown, fallback: T): T {
  if (typeof v !== 'string') return ((v as T) ?? fallback);
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

/** The snapshot that "wins" gauge fields: later updatedAt, id as a tiebreak. */
function pickLater(a: Snapshot, b: Snapshot): Snapshot {
  const ua = String(a.updatedAt ?? '');
  const ub = String(b.updatedAt ?? '');
  if (ua !== ub) return ua > ub ? a : b;
  return String(a.id ?? '') <= String(b.id ?? '') ? a : b;
}

/**
 * Field-aware gamification merge (chosen strategy):
 *  - badges            → set union (never drop an earned achievement)
 *  - totalXP/weeklyXP  → max (monotonic; exact for one-device-at-a-time use)
 *  - streaks           → per-streak max count
 *  - domainScores      → last-writer by updatedAt (a 0-100 gauge, not a counter)
 * Commutative + idempotent ⇒ two devices converge regardless of arrival order.
 */
export function mergeGamification(a: Snapshot, b: Snapshot): Snapshot {
  const later = pickLater(a, b);

  // sort() so the merged output is byte-identical regardless of arg order —
  // set-union alone preserves insertion order, which would make merge(a,b) and
  // merge(b,a) stringify differently and break convergence.
  const badges = Array.from(
    new Set([...parseJson<string[]>(a.badges, []), ...parseJson<string[]>(b.badges, [])]),
  ).sort();

  const sa = parseJson<Record<string, { count?: number }>>(a.streaks, {});
  const sb = parseJson<Record<string, { count?: number }>>(b.streaks, {});
  const streaks: Record<string, unknown> = {};
  for (const k of [...new Set([...Object.keys(sa), ...Object.keys(sb)])].sort()) {
    streaks[k] = (sa[k]?.count ?? -1) >= (sb[k]?.count ?? -1) ? sa[k] : sb[k];
  }

  return {
    ...later, // id/userId/createdAt/updatedAt + the last-writer domainScores
    badges: JSON.stringify(badges),
    streaks: JSON.stringify(streaks),
    totalXP: Math.max(Number(a.totalXP ?? 0), Number(b.totalXP ?? 0)),
    weeklyXP: Math.max(Number(a.weeklyXP ?? 0), Number(b.weeklyXP ?? 0)),
  };
}

function minIso(a: unknown, b: unknown): string {
  const sa = String(a ?? '');
  const sb = String(b ?? '');
  if (!sa) return sb;
  if (!sb) return sa;
  return sa <= sb ? sa : sb;
}

function maxIso(a: unknown, b: unknown): string {
  const sa = String(a ?? '');
  const sb = String(b ?? '');
  return sa >= sb ? sa : sb;
}

/**
 * interests: document-shaped except `weeklyMinutesActual` is an accumulating
 * counter → max (logging time on two devices never loses minutes). `b` is the
 * later snapshot in fold order, so its (possibly partial) changed fields win
 * via the spread — incl. `status`, which carries the soft-delete tombstone
 * 'deleted'. Spread-merge tolerates partial update snapshots, so interest
 * writes don't need a full before-read.
 */
export function mergeInterests(a: Snapshot, b: Snapshot): Snapshot {
  return {
    ...a,
    ...b,
    weeklyMinutesActual: Math.max(Number(a.weeklyMinutesActual ?? 0), Number(b.weeklyMinutesActual ?? 0)),
  };
}

const EP_STATUS_RANK: Record<string, number> = { abandoned: 0, active: 1, completed: 2 };

/**
 * expedition_progress (per-user-per-expedition): conflict-free merge mirroring
 * mergeExpeditionProgress (src/explore/expeditions.ts) at the DB-snapshot level
 * — `completedSteps` is a JSON string here. Never loses a completed step.
 *   - completedSteps → sorted set union
 *   - currentStep    → max
 *   - status         → precedence completed > active > abandoned
 */
export function mergeExpeditionProgressSnapshot(a: Snapshot, b: Snapshot): Snapshot {
  const completed = Array.from(
    new Set([
      ...parseJson<number[]>(a.completedSteps, []),
      ...parseJson<number[]>(b.completedSteps, []),
    ]),
  ).sort((x, y) => x - y);
  const sa = String(a.status ?? 'active');
  const sb = String(b.status ?? 'active');
  const status = (EP_STATUS_RANK[sa] ?? 1) >= (EP_STATUS_RANK[sb] ?? 1) ? sa : sb;
  const completedAt = (a.completedAt as string | null) ?? (b.completedAt as string | null) ?? null;
  return {
    ...pickLater(a, b),
    status,
    currentStep: Math.max(Number(a.currentStep ?? 0), Number(b.currentStep ?? 0)),
    completedSteps: JSON.stringify(completed),
    startedAt: minIso(a.startedAt, b.startedAt),
    lastActivityAt: maxIso(a.lastActivityAt, b.lastActivityAt),
    completedAt: status === 'completed' ? completedAt : null,
  };
}

/** Entities whose history must be merged with a CRDT instead of field-LWW. */
const ENTITY_MERGERS: Record<string, (a: Snapshot, b: Snapshot) => Snapshot> = {
  gamification: mergeGamification,
  interests: mergeInterests,
  expedition_progress: mergeExpeditionProgressSnapshot,
};

/**
 * Materialize an entity's current state from its full mutation history. Uses a
 * registered CRDT merge when the entity has one (gamification today), otherwise
 * the default document fold (goals/routine/reflections — unchanged).
 */
export function materializeEntity(entity: string, mutations: MutationRecord[]): EntitySnapshot {
  const merger = ENTITY_MERGERS[entity];
  if (!merger) return foldEntity(mutations);

  const ordered = [...mutations].sort(compareMutationOrder);
  let state: Snapshot | null = null;
  for (const m of ordered) {
    if (m.op === 'delete') {
      state = null;
      continue;
    }
    if (!m.after) continue;
    const snap = m.after as Snapshot;
    state = state ? merger(state, snap) : { ...snap };
  }
  return state;
}
