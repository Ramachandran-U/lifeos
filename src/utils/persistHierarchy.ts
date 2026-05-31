import type { GoalHierarchy } from '@/ai/types';

type CreateGoalFn = (data: {
  userId: string;
  title: string;
  description?: string;
  goalType: string;
  parentId?: string;
  level: string;
  timeline?: string;
  aiGenerated?: boolean;
  metadata?: string;
}) => string;

export interface PersistHierarchyOptions {
  /** User-chosen horizon (e.g. "6 months"). Stamped on the life goal so the UI
   *  shows the user's own timeline instead of an AI-imposed one. */
  timeline?: string;
  /** Override the goal domain the AI inferred (user re-tagged it in the sheet). */
  goalType?: string;
}

export interface PersistResult {
  lifeId: string;
  yearlyId: string;
  monthlyIds: string[];
  weeklyIds: string[];
  dailyIds: string[];
}

/**
 * Persists an AI-decomposed goal hierarchy to the goals table with correct
 * parent chains: life → yearly → monthly → weekly → daily. Pure function —
 * `createGoal` is injected so this can be tested without the DB.
 */
export function persistHierarchy(
  userId: string,
  h: GoalHierarchy,
  createGoal: CreateGoalFn,
  opts: PersistHierarchyOptions = {},
): PersistResult {
  // The user may re-tag the domain in the sheet; fall back to the AI's guess.
  const goalType = opts.goalType ?? h.primaryGoal.type;

  const lifeId = createGoal({
    userId,
    title: h.primaryGoal.title,
    goalType,
    level: 'life',
    timeline: opts.timeline,
    aiGenerated: true,
  });

  const yearlyId = createGoal({
    userId,
    title: h.yearly.title,
    description: h.yearly.milestone,
    goalType,
    parentId: lifeId,
    level: 'yearly',
    aiGenerated: true,
  });

  const monthlyIds = h.monthly.map((m) =>
    createGoal({
      userId,
      title: m.title,
      description: m.milestone,
      goalType,
      parentId: yearlyId,
      level: 'monthly',
      aiGenerated: true,
      metadata: JSON.stringify({ month: m.month }),
    }),
  );

  const weeklyIds = h.weekly.map((w) =>
    createGoal({
      userId,
      title: w.focus,
      description: w.tasks.join('\n'),
      goalType,
      parentId: monthlyIds[0] ?? yearlyId,
      level: 'weekly',
      aiGenerated: true,
      metadata: JSON.stringify({ week: w.week, tasks: w.tasks }),
    }),
  );

  const weeklyParent = weeklyIds[0] ?? yearlyId;
  const dailyIds = h.dailyTaskExamples.map((task) =>
    createGoal({
      userId,
      title: task,
      goalType,
      parentId: weeklyParent,
      level: 'daily',
      aiGenerated: true,
    }),
  );

  return { lifeId, yearlyId, monthlyIds, weeklyIds, dailyIds };
}
