import { Platform } from 'react-native';
import { eq, and, isNull, isNotNull, desc } from 'drizzle-orm';
import { nanoid } from '@/utils/id';
import { db } from '../index';
import { goals } from '../schema';
import {
  webInsertGoal,
  webGetGoalsByUser,
  webGetGoalById,
  webGetChildGoals,
  webUpdateGoalStatus,
  webUpdateGoalDescription,
  webUpdateGoalFields,
  webSoftDeleteGoal,
  webSetGoalPriorities,
  webGetDeletedGoals,
  webRestoreGoal,
  type WebGoal,
} from '../webStorage';
import { recordMutation } from '@/sync/runtime';
import { logDecisionEvent } from './behaviour';

const isWeb = Platform.OS === 'web';

function readGoalSnapshot(id: string): Record<string, unknown> | null {
  if (isWeb) {
    const r = webGetGoalById(id);
    return r ? (r as unknown as Record<string, unknown>) : null;
  }
  const row = db.select().from(goals).where(eq(goals.id, id)).get();
  return row ? (row as unknown as Record<string, unknown>) : null;
}

type GoalInsert = {
  userId: string;
  title: string;
  description?: string;
  goalType: string;
  parentId?: string;
  level: string;
  timeline?: string;
  energyLevel?: string;
  aiGenerated?: boolean;
  metadata?: string;
};

export function createGoal(data: GoalInsert) {
  const id = nanoid();
  const now = new Date().toISOString();
  // Fire-and-forget telemetry. `track` no-ops if user hasn't opted in.
  // Imported lazily to avoid a circular import via db init.
  import('@/utils/telemetry').then(({ track, EVENTS }) =>
    track(EVENTS.goalCreated, {
      level: data.level,
      goal_type: data.goalType,
      ai_generated: data.aiGenerated,
      timeline: data.timeline,
    }),
  );
  if (isWeb) {
    const record: WebGoal = {
      id,
      userId: data.userId,
      title: data.title,
      description: data.description,
      goalType: data.goalType,
      parentId: data.parentId,
      level: data.level,
      timeline: data.timeline,
      status: 'active',
      energyLevel: data.energyLevel,
      aiGenerated: data.aiGenerated,
      metadata: data.metadata,
      createdAt: now,
      updatedAt: now,
    };
    webInsertGoal(record);
    recordMutation({ entity: 'goals', entityId: id, op: 'insert', before: null, after: record as unknown as Record<string, unknown> });
    return id;
  }
  db.insert(goals).values({
    id,
    ...data,
    createdAt: now,
    updatedAt: now,
  }).run();
  recordMutation({ entity: 'goals', entityId: id, op: 'insert', before: null, after: { id, ...data, status: 'active', createdAt: now, updatedAt: now } });
  return id;
}

export function getGoalsByUser(userId: string) {
  if (isWeb) return webGetGoalsByUser(userId);
  return db.select().from(goals)
    .where(and(eq(goals.userId, userId), isNull(goals.deletedAt)))
    .all();
}

/** Goal levels durable enough to steer the day planner (life/yearly). The
 *  monthly/weekly/daily nodes are execution steps, not "what I'm steering toward". */
const PLANNER_GOAL_LEVELS = new Set(['life', 'yearly']);
/** Max goal titles fed to the planner — matches the vision.topGoals Zod cap. */
export const PLANNER_GOAL_CAP = 5;

/**
 * The live goals that should drive the AI day planner: the user's active,
 * durable (life/yearly) goals, highest priority first (lower `priority` = higher),
 * recency as the tiebreak. The provided `fallbackTopGoals` (the frozen
 * onboarding `profile.vision.topGoals`) tops up any remaining slots so nothing
 * the user set at onboarding is silently dropped, and is the sole source for a
 * brand-new user with no goals yet. Returns up to PLANNER_GOAL_CAP titles.
 *
 * This is the bridge that replaces reading the frozen `vision.topGoals` at plan
 * time — see applyLivePlannerGoals in src/ai/routineFromProfile.ts. Read-only;
 * works on web + native via getGoalsByUser.
 */
export function selectPlannerGoals(userId: string, fallbackTopGoals: string[] = []): string[] {
  let live: string[] = [];
  try {
    live = getGoalsByUser(userId)
      .filter((g) => g.status === 'active' && PLANNER_GOAL_LEVELS.has(g.level))
      .slice()
      .sort((a, b) =>
        ((a.priority ?? 0) - (b.priority ?? 0)) || (a.createdAt < b.createdAt ? 1 : -1),
      )
      .map((g) => g.title);
  } catch {
    live = []; // DB not ready (fresh install) — fall back to onboarding goals
  }
  // Live goals claim the slots; top up with any onboarding goal not already
  // represented (case-insensitive title match), so user intent is never lost.
  const seen = new Set(live.map((t) => t.trim().toLowerCase()));
  const merged = [...live];
  for (const t of fallbackTopGoals) {
    const key = t.trim().toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      merged.push(t);
    }
  }
  return merged.slice(0, PLANNER_GOAL_CAP);
}

export function getGoalById(id: string) {
  if (isWeb) return webGetGoalById(id);
  return db.select().from(goals).where(eq(goals.id, id)).get();
}

export function getChildGoals(parentId: string) {
  if (isWeb) return webGetChildGoals(parentId);
  return db.select().from(goals)
    .where(and(eq(goals.parentId, parentId), isNull(goals.deletedAt)))
    .all();
}

export function updateGoalStatus(id: string, status: string, reason?: string) {
  const before = readGoalSnapshot(id);
  const now = new Date().toISOString();
  if (isWeb) {
    webUpdateGoalStatus(id, status);
  } else {
    db.update(goals)
      .set({ status, updatedAt: now })
      .where(eq(goals.id, id))
      .run();
  }
  recordMutation({ entity: 'goals', entityId: id, op: 'update', before, after: { ...(before ?? {}), status, updatedAt: now } });
  // Decision log: a status change IS a decision (pause/abandon/complete/resume).
  // Only log real transitions — a no-op write is not a choice.
  if (before && before.status !== status) {
    logDecisionEvent(`goal_${status}`, 'goal', {
      goalId: id,
      goalTitle: typeof before.title === 'string' ? before.title : undefined,
      previousStatus: before.status,
      ...(reason ? { reason } : {}),
    });
  }
}

/** Parse a goal's JSON `metadata` column into an object. Tolerant: a null,
 *  empty, or malformed value yields {} so callers can merge safely. */
function parseGoalMetadata(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'string' || raw.length === 0) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Postpone a goal until `untilDate` (YYYY-MM-DD): set status to 'paused' and
 * stash `snoozeUntil` in the metadata JSON. A paused goal drops out of the
 * active tree, the planner, and the what-next agent until it resumes — either
 * manually (resumeGoal) or automatically once the date passes (reactivateDueGoals).
 */
export function snoozeGoal(id: string, untilDate: string) {
  const before = readGoalSnapshot(id);
  const now = new Date().toISOString();
  const metadata = JSON.stringify({ ...parseGoalMetadata(before?.metadata), snoozeUntil: untilDate });
  if (isWeb) {
    webUpdateGoalFields(id, { status: 'paused', metadata });
  } else {
    db.update(goals)
      .set({ status: 'paused', metadata, updatedAt: now })
      .where(eq(goals.id, id))
      .run();
  }
  recordMutation({ entity: 'goals', entityId: id, op: 'update', before, after: { ...(before ?? {}), status: 'paused', metadata, updatedAt: now } });
  logDecisionEvent('goal_snoozed', 'goal', {
    goalId: id,
    goalTitle: before && typeof before.title === 'string' ? before.title : undefined,
    untilDate,
  });
}

/**
 * Resume a postponed goal: status back to 'active' and clear any snoozeUntil.
 * `auto` marks a scheduler-driven resume (reactivateDueGoals) — only a manual
 * resume is a user decision, so only that is decision-logged.
 */
export function resumeGoal(id: string, auto = false) {
  const before = readGoalSnapshot(id);
  const now = new Date().toISOString();
  const meta = parseGoalMetadata(before?.metadata);
  delete meta.snoozeUntil;
  const metadata = JSON.stringify(meta);
  if (isWeb) {
    webUpdateGoalFields(id, { status: 'active', metadata });
  } else {
    db.update(goals)
      .set({ status: 'active', metadata, updatedAt: now })
      .where(eq(goals.id, id))
      .run();
  }
  recordMutation({ entity: 'goals', entityId: id, op: 'update', before, after: { ...(before ?? {}), status: 'active', metadata, updatedAt: now } });
  if (!auto) {
    logDecisionEvent('goal_resumed', 'goal', {
      goalId: id,
      goalTitle: before && typeof before.title === 'string' ? before.title : undefined,
    });
  }
}

/**
 * Auto-resume any of the user's paused goals whose `snoozeUntil` is on or
 * before `today` (YYYY-MM-DD). Idempotent — call it on app/goals-screen open.
 * Returns the goals that were reactivated so the UI can surface a "X is back" note.
 */
export function reactivateDueGoals(userId: string, today: string): { id: string; title: string }[] {
  const due = getGoalsByUser(userId).filter((g) => {
    if (g.status !== 'paused') return false;
    const until = parseGoalMetadata(g.metadata).snoozeUntil;
    return typeof until === 'string' && until <= today;
  });
  for (const g of due) resumeGoal(g.id, true);
  return due.map((g) => ({ id: g.id, title: g.title }));
}

export function updateGoalDescription(id: string, description: string) {
  const before = readGoalSnapshot(id);
  const now = new Date().toISOString();
  if (isWeb) {
    webUpdateGoalDescription(id, description);
  } else {
    db.update(goals)
      .set({ description, updatedAt: now })
      .where(eq(goals.id, id))
      .run();
  }
  recordMutation({ entity: 'goals', entityId: id, op: 'update', before, after: { ...(before ?? {}), description, updatedAt: now } });
}

/** Update mutable user-facing fields on a goal (title, goalType, timeline). */
export function updateGoalFields(id: string, fields: { title?: string; goalType?: string; timeline?: string | null }) {
  const before = readGoalSnapshot(id);
  const now = new Date().toISOString();
  if (isWeb) {
    webUpdateGoalFields(id, fields);
  } else {
    db.update(goals).set({ ...fields, updatedAt: now }).where(eq(goals.id, id)).run();
  }
  recordMutation({ entity: 'goals', entityId: id, op: 'update', before, after: { ...(before ?? {}), ...fields, updatedAt: now } });
}

/** Merge `partial` into the goal's existing metadata JSON. Existing keys not in `partial` are preserved. */
export function updateGoalMetadata(id: string, partial: Record<string, unknown>) {
  const before = readGoalSnapshot(id);
  const existing = parseGoalMetadata(before?.metadata);
  const metadata = JSON.stringify({ ...existing, ...partial });
  const now = new Date().toISOString();
  if (isWeb) {
    webUpdateGoalFields(id, { metadata });
  } else {
    db.update(goals).set({ metadata, updatedAt: now }).where(eq(goals.id, id)).run();
  }
  recordMutation({ entity: 'goals', entityId: id, op: 'update', before, after: { ...(before ?? {}), metadata, updatedAt: now } });
}

export function setGoalPriorities(updates: { id: string; priority: number }[]) {
  if (updates.length === 0) return;
  const beforeSnapshots = updates.map((u) => readGoalSnapshot(u.id));
  if (isWeb) {
    webSetGoalPriorities(updates);
  } else {
    const nowNative = new Date().toISOString();
    for (const u of updates) {
      db.update(goals)
        .set({ priority: u.priority, updatedAt: nowNative })
        .where(eq(goals.id, u.id))
        .run();
    }
  }
  const now = new Date().toISOString();
  for (let i = 0; i < updates.length; i++) {
    const u = updates[i];
    const before = beforeSnapshots[i];
    recordMutation({ entity: 'goals', entityId: u.id, op: 'update', before, after: { ...(before ?? {}), priority: u.priority, updatedAt: now } });
  }
}

export function softDeleteGoal(id: string) {
  const before = readGoalSnapshot(id);
  const deletedAt = new Date().toISOString();
  if (isWeb) {
    webSoftDeleteGoal(id);
  } else {
    db.update(goals)
      .set({ deletedAt })
      .where(eq(goals.id, id))
      .run();
  }
  // Soft-delete is logged as 'delete' so replay/sync treats it as a tombstone.
  recordMutation({ entity: 'goals', entityId: id, op: 'delete', before, after: null });
}

/** Soft-deleted goals for a user (most recent edit first), for the restore UI. */
export function getDeletedGoals(userId: string) {
  if (isWeb) return webGetDeletedGoals(userId);
  return db.select().from(goals)
    .where(and(eq(goals.userId, userId), isNotNull(goals.deletedAt)))
    .orderBy(desc(goals.deletedAt))
    .all();
}

/** Undo a soft-delete: clear deletedAt. Recorded as an update that clears the
 *  tombstone, so it resurrects on fold and syncs to other devices. */
export function restoreGoal(id: string) {
  const before = readGoalSnapshot(id);
  const now = new Date().toISOString();
  if (isWeb) {
    webRestoreGoal(id);
  } else {
    db.update(goals).set({ deletedAt: null, updatedAt: now }).where(eq(goals.id, id)).run();
  }
  recordMutation({ entity: 'goals', entityId: id, op: 'update', before, after: { ...(before ?? {}), deletedAt: null, updatedAt: now } });
}
