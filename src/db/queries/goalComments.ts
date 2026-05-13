import { Platform } from 'react-native';
import { eq, asc } from 'drizzle-orm';
import { nanoid } from '@/utils/id';
import { db } from '../index';
import { goalComments } from '../schema';
import {
  webInsertGoalComment,
  webListGoalComments,
  webDeleteGoalComment,
  type WebGoalComment,
} from '../webStorage';

const isWeb = Platform.OS === 'web';

export interface GoalComment {
  id: string;
  goalId: string;
  userId: string;
  body: string;
  createdAt: string;
}

export function addGoalComment(data: { goalId: string; userId: string; body: string }): string {
  const id = nanoid();
  const createdAt = new Date().toISOString();
  const record: WebGoalComment = { id, ...data, createdAt };
  if (isWeb) {
    webInsertGoalComment(record);
    return id;
  }
  db.insert(goalComments).values({ id, ...data, createdAt }).run();
  return id;
}

export function listGoalComments(goalId: string): GoalComment[] {
  if (isWeb) return webListGoalComments(goalId);
  return db.select().from(goalComments)
    .where(eq(goalComments.goalId, goalId))
    .orderBy(asc(goalComments.createdAt))
    .all();
}

export function deleteGoalComment(id: string): void {
  if (isWeb) {
    webDeleteGoalComment(id);
    return;
  }
  db.delete(goalComments).where(eq(goalComments.id, id)).run();
}
