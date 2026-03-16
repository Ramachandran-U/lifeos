import { eq, and, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../index';
import { goals } from '../schema';

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
  db.insert(goals).values({
    id,
    ...data,
    createdAt: now,
    updatedAt: now,
  }).run();
  return id;
}

export function getGoalsByUser(userId: string) {
  return db.select().from(goals)
    .where(and(eq(goals.userId, userId), isNull(goals.deletedAt)))
    .all();
}

export function getGoalById(id: string) {
  return db.select().from(goals).where(eq(goals.id, id)).get();
}

export function getChildGoals(parentId: string) {
  return db.select().from(goals)
    .where(and(eq(goals.parentId, parentId), isNull(goals.deletedAt)))
    .all();
}

export function updateGoalStatus(id: string, status: string) {
  db.update(goals)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(goals.id, id))
    .run();
}

export function softDeleteGoal(id: string) {
  db.update(goals)
    .set({ deletedAt: new Date().toISOString() })
    .where(eq(goals.id, id))
    .run();
}
