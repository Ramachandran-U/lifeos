import { Platform } from 'react-native';
import { eq, and, isNull } from 'drizzle-orm';
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
  type WebGoal,
} from '../webStorage';

const isWeb = Platform.OS === 'web';

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
    return id;
  }
  db.insert(goals).values({
    id,
    ...data,
    createdAt: now,
    updatedAt: now,
  }).run();
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
  if (isWeb) {
    webUpdateGoalStatus(id, status);
    return;
  }
  db.update(goals)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(goals.id, id))
    .run();
}

export function updateGoalDescription(id: string, description: string) {
  if (isWeb) {
    webUpdateGoalDescription(id, description);
    return;
  }
  db.update(goals)
    .set({ description, updatedAt: new Date().toISOString() })
    .where(eq(goals.id, id))
    .run();
}

export function setGoalPriorities(updates: { id: string; priority: number }[]) {
  if (updates.length === 0) return;
  if (isWeb) {
    webSetGoalPriorities(updates);
    return;
  }
  const now = new Date().toISOString();
  for (const u of updates) {
    db.update(goals)
      .set({ priority: u.priority, updatedAt: now })
      .where(eq(goals.id, u.id))
      .run();
  }
}

export function softDeleteGoal(id: string) {
  if (isWeb) {
    webSoftDeleteGoal(id);
    return;
  }
  db.update(goals)
    .set({ deletedAt: new Date().toISOString() })
    .where(eq(goals.id, id))
    .run();
}
