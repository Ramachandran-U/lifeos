import { Platform } from 'react-native';
import { eq } from 'drizzle-orm';
import { nanoid } from '@/utils/id';
import { db } from '../index';
import { financialGoals, financeMilestones } from '../schema';
import {
  webInsertFinancialGoal,
  webGetFinancialGoals,
  webGetFinancialGoalById,
  webUpdateFinancialGoal,
  webInsertMilestone,
  webGetMilestonesByGoal,
  webCompleteMilestone,
  type WebFinancialGoal,
  type WebFinanceMilestone,
} from '../webStorage';

const isWeb = Platform.OS === 'web';

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
  if (isWeb) {
    const record: WebFinancialGoal = {
      id,
      title: data.title,
      goalType: data.goalType,
      targetAmount: data.targetAmount,
      currency: data.currency ?? 'USD',
      targetDate: data.targetDate,
      incomeBracket: data.incomeBracket,
      monthlySavings: data.monthlySavings,
      riskProfile: data.riskProfile,
      status: 'active',
      metadata: data.metadata,
      createdAt: now,
      updatedAt: now,
    };
    webInsertFinancialGoal(record);
    return id;
  }
  db.insert(financialGoals).values({
    id,
    ...data,
    createdAt: now,
    updatedAt: now,
  }).run();
  return id;
}

export function getFinancialGoals() {
  if (isWeb) return webGetFinancialGoals();
  return db.select().from(financialGoals)
    .where(eq(financialGoals.status, 'active'))
    .all();
}

export function getFinancialGoalById(id: string) {
  if (isWeb) return webGetFinancialGoalById(id);
  return db.select().from(financialGoals).where(eq(financialGoals.id, id)).get();
}

export function updateFinancialGoal(id: string, data: Partial<FinancialGoalInsert>) {
  if (isWeb) {
    webUpdateFinancialGoal(id, data);
    return;
  }
  db.update(financialGoals)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(financialGoals.id, id))
    .run();
}

export function createMilestone(goalId: string, title: string, targetAmount: number, targetDate: string) {
  const id = nanoid();
  const now = new Date().toISOString();
  if (isWeb) {
    const record: WebFinanceMilestone = {
      id,
      goalId,
      title,
      targetAmount,
      targetDate,
      createdAt: now,
    };
    webInsertMilestone(record);
    return id;
  }
  db.insert(financeMilestones).values({
    id,
    goalId,
    title,
    targetAmount,
    targetDate,
    createdAt: now,
  }).run();
  return id;
}

export function getMilestonesByGoal(goalId: string) {
  if (isWeb) return webGetMilestonesByGoal(goalId);
  return db.select().from(financeMilestones)
    .where(eq(financeMilestones.goalId, goalId))
    .all();
}

export function completeMilestone(id: string) {
  if (isWeb) {
    webCompleteMilestone(id);
    return;
  }
  db.update(financeMilestones)
    .set({ completedAt: new Date().toISOString() })
    .where(eq(financeMilestones.id, id))
    .run();
}
