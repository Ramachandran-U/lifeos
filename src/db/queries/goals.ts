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
  webSoftDeleteGoal,
  webSetGoalPriorities,
  webGetDeletedGoals,
  webRestoreGoal,
  type WebGoal,
} from '../webStorage';
import { recordMutation } from '@/sync/runtime';

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

export function updateGoalStatus(id: string, status: string) {
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
