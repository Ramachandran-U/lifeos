import { load, save } from './_io';
import { GOALS_KEY, GOAL_COMMENTS_KEY } from './_keys';

export interface WebGoal {
  id: string;
  userId: string;
  title: string;
  description?: string;
  goalType: string;
  parentId?: string;
  level: string;
  timeline?: string | null;
  status: string;
  energyLevel?: string;
  aiGenerated?: boolean;
  metadata?: string;
  priority?: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export function webInsertGoal(goal: WebGoal): void {
  const all = load<WebGoal>(GOALS_KEY);
  all.push(goal);
  save(GOALS_KEY, all);
}

export function webGetGoalsByUser(userId: string): WebGoal[] {
  return load<WebGoal>(GOALS_KEY).filter((g) => g.userId === userId && !g.deletedAt);
}

export function webGetGoalById(id: string): WebGoal | undefined {
  return load<WebGoal>(GOALS_KEY).find((g) => g.id === id);
}

export function webGetChildGoals(parentId: string): WebGoal[] {
  return load<WebGoal>(GOALS_KEY).filter((g) => g.parentId === parentId && !g.deletedAt);
}

export function webUpdateGoalStatus(id: string, status: string): void {
  const all = load<WebGoal>(GOALS_KEY);
  const idx = all.findIndex((g) => g.id === id);
  if (idx === -1) return;
  all[idx] = { ...all[idx], status, updatedAt: new Date().toISOString() };
  save(GOALS_KEY, all);
}

export function webUpdateGoalDescription(id: string, description: string): void {
  const all = load<WebGoal>(GOALS_KEY);
  const idx = all.findIndex((g) => g.id === id);
  if (idx === -1) return;
  all[idx] = { ...all[idx], description, updatedAt: new Date().toISOString() };
  save(GOALS_KEY, all);
}

/** Patch arbitrary mutable fields on a goal (e.g. status + metadata together,
 *  used by snooze/resume). Stamps updatedAt; never touches id/createdAt. */
export function webUpdateGoalFields(
  id: string,
  fields: Partial<Omit<WebGoal, 'id' | 'createdAt'>>,
): void {
  const all = load<WebGoal>(GOALS_KEY);
  const idx = all.findIndex((g) => g.id === id);
  if (idx === -1) return;
  all[idx] = { ...all[idx], ...fields, updatedAt: new Date().toISOString() };
  save(GOALS_KEY, all);
}

/** Upsert a full goal row by id. Used by the sync reducer to apply remote
 *  state — it must NOT touch updatedAt or record a mutation (echo-safe). */
export function webUpsertGoalById(goal: WebGoal): void {
  const all = load<WebGoal>(GOALS_KEY);
  const idx = all.findIndex((g) => g.id === goal.id);
  if (idx === -1) all.push(goal);
  else all[idx] = goal;
  save(GOALS_KEY, all);
}

export function webSoftDeleteGoal(id: string): void {
  const all = load<WebGoal>(GOALS_KEY);
  const idx = all.findIndex((g) => g.id === id);
  if (idx === -1) return;
  all[idx] = { ...all[idx], deletedAt: new Date().toISOString() };
  save(GOALS_KEY, all);
}

export function webGetDeletedGoals(userId: string): WebGoal[] {
  // Most-recently-deleted first, matching the native ORDER BY deletedAt DESC.
  return load<WebGoal>(GOALS_KEY)
    .filter((g) => g.userId === userId && !!g.deletedAt)
    .sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? ''));
}

export function webRestoreGoal(id: string): void {
  const all = load<WebGoal>(GOALS_KEY);
  const idx = all.findIndex((g) => g.id === id);
  if (idx === -1) return;
  all[idx] = { ...all[idx], deletedAt: undefined, updatedAt: new Date().toISOString() };
  save(GOALS_KEY, all);
}

export function webSetGoalPriorities(updates: { id: string; priority: number }[]): void {
  const all = load<WebGoal>(GOALS_KEY);
  const byId = new Map(updates.map((u) => [u.id, u.priority]));
  const now = new Date().toISOString();
  const next = all.map((g) =>
    byId.has(g.id) ? { ...g, priority: byId.get(g.id)!, updatedAt: now } : g,
  );
  save(GOALS_KEY, next);
}

export interface WebGoalComment {
  id: string;
  goalId: string;
  userId: string;
  body: string;
  createdAt: string;
}

export function webInsertGoalComment(c: WebGoalComment): void {
  const all = load<WebGoalComment>(GOAL_COMMENTS_KEY);
  all.push(c);
  save(GOAL_COMMENTS_KEY, all);
}

export function webListGoalComments(goalId: string): WebGoalComment[] {
  return load<WebGoalComment>(GOAL_COMMENTS_KEY)
    .filter((c) => c.goalId === goalId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function webListAllGoalComments(): WebGoalComment[] {
  return load<WebGoalComment>(GOAL_COMMENTS_KEY);
}

export function webDeleteGoalComment(id: string): void {
  const all = load<WebGoalComment>(GOAL_COMMENTS_KEY);
  save(
    GOAL_COMMENTS_KEY,
    all.filter((c) => c.id !== id),
  );
}
