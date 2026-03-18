import { eq, and } from 'drizzle-orm';
import { nanoid } from '@/utils/id';
import { db } from '../index';
import { financialGoals, financeMilestones } from '../schema';

type FinancialGoalInsert = {
  title: string;
  goalType: string;
  targetAmount?: number;
  currency?: string;
  targetDate?: string;
  incomeBracket?: string;
  monthlySavings?: number;
  riskProfile?: string;
  metadata?: string;
};

export function createFinancialGoal(data: FinancialGoalInsert) {
  const id = nanoid();
  const now = new Date().toISOString();
  db.insert(financialGoals).values({
    id,
    ...data,
    createdAt: now,
    updatedAt: now,
  }).run();
  return id;
}

export function getFinancialGoals() {
  return db.select().from(financialGoals)
    .where(eq(financialGoals.status, 'active'))
    .all();
}

export function getFinancialGoalById(id: string) {
  return db.select().from(financialGoals).where(eq(financialGoals.id, id)).get();
}

export function updateFinancialGoal(id: string, data: Partial<FinancialGoalInsert>) {
  db.update(financialGoals)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(financialGoals.id, id))
    .run();
}

export function createMilestone(goalId: string, title: string, targetAmount: number, targetDate: string) {
  const id = nanoid();
  db.insert(financeMilestones).values({
    id,
    goalId,
    title,
    targetAmount,
    targetDate,
    createdAt: new Date().toISOString(),
  }).run();
  return id;
}

export function getMilestonesByGoal(goalId: string) {
  return db.select().from(financeMilestones)
    .where(eq(financeMilestones.goalId, goalId))
    .all();
}

export function completeMilestone(id: string) {
  db.update(financeMilestones)
    .set({ completedAt: new Date().toISOString() })
    .where(eq(financeMilestones.id, id))
    .run();
}
