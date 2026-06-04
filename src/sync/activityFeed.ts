/**
 * Activity feed + restore presentation — the read-only "what changed" view over
 * the mutation log, plus the gate for which entities can be restored.
 *
 * The mutation log already records every state change (see mutationLog.ts);
 * nothing surfaced it. This module turns raw `MutationRecord`s into human
 * "Updated Goal: Run a marathon — status" rows, grouped by day, and marks which
 * rows are safe to restore. It is PURE (no I/O, no clock, no React): the day
 * key and device id are injected so every branch is deterministic and unit
 * testable. The hook (`useActivityFeed`) wires it to the sink + history engine.
 */
import type { MutationRecord, MutationOp, EntitySnapshot } from './mutationLog';

/**
 * Document entities whose earlier state can be restored. Counter/set entities
 * (gamification XP, interests minutes, expedition_progress steps) are excluded:
 * their CRDT merge is monotonic (max/union), so a restore cannot lower them and
 * would mislead — see the CAVEAT in history.ts. Restore is meant for
 * document-shaped rows only.
 */
export const RESTORABLE_ENTITIES = new Set<string>([
  'goals',
  'routine_blocks',
  'daily_reflections',
  'sparks',
  'expeditions',
  'user_profiles',
]);

export function isRestorable(entity: string): boolean {
  return RESTORABLE_ENTITIES.has(entity);
}

const ENTITY_LABELS: Record<string, string> = {
  goals: 'Goal',
  routine_blocks: 'Routine block',
  daily_reflections: 'Reflection',
  sparks: 'Spark',
  expeditions: 'Expedition',
  expedition_progress: 'Expedition progress',
  user_profiles: 'Profile',
  gamification: 'Progress',
  interests: 'Interest',
  users: 'Account',
};

/** Human label for an entity table name. Unknown tables fall back to a
 *  prettified form so the feed never shows a raw snake_case identifier. */
export function entityLabel(entity: string): string {
  return ENTITY_LABELS[entity] ?? prettifyKey(entity);
}

/** snake_case / camelCase → lower-case words. */
export function prettifyKey(k: string): string {
  return k
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .trim();
}

const VERB: Record<MutationOp, string> = {
  insert: 'Created',
  update: 'Updated',
  delete: 'Removed',
};

// Bookkeeping columns that change on nearly every write — noise in a "what
// changed" list, so they're hidden from the changed-fields detail.
const HIDDEN_FIELDS = new Set(['id', 'createdAt', 'updatedAt', 'created_at', 'updated_at']);

/** Best-effort human name for the row a mutation touched, from its snapshot. */
export function snapshotTitle(entity: string, snap: EntitySnapshot): string | null {
  if (!snap) return null;
  const s = snap as Record<string, unknown>;
  const pick = (k: string): string | null =>
    typeof s[k] === 'string' && (s[k] as string).trim().length > 0 ? (s[k] as string).trim() : null;
  switch (entity) {
    case 'goals':
    case 'routine_blocks':
    case 'expeditions':
    case 'sparks':
      return pick('title');
    case 'interests':
      return pick('name');
    case 'daily_reflections': {
      const d = pick('date');
      return d ? `for ${d}` : null;
    }
    default:
      return null;
  }
}

export interface ActivityItem {
  /** Mutation id (stable React key + the restore anchor's identity). */
  id: string;
  entity: string;
  entityId: string;
  entityLabel: string;
  op: MutationOp;
  /** Created / Updated / Removed. */
  verb: string;
  /** Human name of the touched row, if derivable. */
  title: string | null;
  /** Display-worthy changed columns (update only; bookkeeping fields hidden). */
  changedFields: string[];
  /** ISO wall clock (display + day grouping). */
  ts: string;
  lamport: number;
  /** True when this change originated on the current device. */
  fromThisDevice: boolean;
  /** True when this entity's earlier states can be restored. */
  restorable: boolean;
}

export function summarizeMutation(
  record: MutationRecord,
  myDeviceId: string | null,
): ActivityItem {
  const snap = record.after ?? record.before;
  return {
    id: record.id,
    entity: record.entity,
    entityId: record.entityId,
    entityLabel: entityLabel(record.entity),
    op: record.op,
    verb: VERB[record.op],
    title: snapshotTitle(record.entity, snap),
    changedFields:
      record.op === 'update' ? record.fields.filter((f) => !HIDDEN_FIELDS.has(f)) : [],
    ts: record.ts,
    lamport: record.lamport,
    fromThisDevice: myDeviceId != null && record.deviceId === myDeviceId,
    restorable: isRestorable(record.entity),
  };
}

export interface ActivityDay {
  /** Day key as produced by `toDayKey` (a local yyyy-MM-dd in the app). */
  day: string;
  items: ActivityItem[];
}

/**
 * Build the day-grouped, newest-first feed. Ordered by wall clock (what a user
 * expects from an activity log) with lamport as a stable tiebreak. `toDayKey`
 * is injected so the local-vs-UTC day boundary is the caller's decision (the
 * app passes a local-date formatter; tests pass a deterministic one).
 */
export function buildActivityFeed(
  records: MutationRecord[],
  myDeviceId: string | null,
  toDayKey: (ts: string) => string,
): ActivityDay[] {
  const items = records
    .map((r) => summarizeMutation(r, myDeviceId))
    .sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : b.lamport - a.lamport));

  const byDay = new Map<string, ActivityItem[]>();
  for (const it of items) {
    const day = toDayKey(it.ts);
    const arr = byDay.get(day);
    if (arr) arr.push(it);
    else byDay.set(day, [it]);
  }
  // Items are already newest-first, so each day's first-seen order makes the
  // Map's day order newest-first too.
  return Array.from(byDay, ([day, dayItems]) => ({ day, items: dayItems }));
}
