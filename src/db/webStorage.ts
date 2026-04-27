/**
 * Web storage layer — localStorage-backed substitute for SQLite on web.
 * Mirrors the shape of the native Drizzle query functions used by the app.
 * Each entity has its own key holding a JSON array of records.
 */

import { subDays, format } from 'date-fns';

const USERS_KEY = 'lifeos_users';
const SESSION_KEY = 'lifeos_session';
const ROUTINE_KEY = 'lifeos_routine_blocks';
const GAMIFICATION_KEY = 'lifeos_gamification';
const BEHAVIOUR_KEY = 'lifeos_behaviour_events';
const GOALS_KEY = 'lifeos_goals';
const HEALTH_LOGS_KEY = 'lifeos_health_logs';
const FOOD_ENTRIES_KEY = 'lifeos_food_entries';
const BLOOD_REPORTS_KEY = 'lifeos_blood_reports';
const FINANCIAL_GOALS_KEY = 'lifeos_financial_goals';
const FINANCE_MILESTONES_KEY = 'lifeos_finance_milestones';
const INTERESTS_KEY = 'lifeos_interests';
const EXPLORATION_LOG_KEY = 'lifeos_exploration_log';
const GOAL_COMMENTS_KEY = 'lifeos_goal_comments';
const REFLECTIONS_KEY = 'lifeos_daily_reflections';
const DISCOVERY_IMPORTS_KEY = 'lifeos_discovery_imports';

function load<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as T[];
  } catch {
    return [];
  }
}

function save<T>(key: string, records: T[]): void {
  localStorage.setItem(key, JSON.stringify(records));
}

// ─── Users ───────────────────────────────────────────────────────────────────

export interface WebUser {
  id: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  name: string;
  age?: number;
  heightCm?: number;
  visionStatement?: string;
  wakeTime?: string;
  sleepTime?: string;
  workStartTime?: string;
  workEndTime?: string;
  onboardingStage: number;
  primaryDomains?: string[];
  activatedModules?: string[];
  installDate: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export function webCreateUser(user: WebUser): void {
  const users = load<WebUser>(USERS_KEY);
  users.push(user);
  save(USERS_KEY, users);
}

export function webGetUser(): WebUser | undefined {
  try {
    const sessionId = localStorage.getItem(SESSION_KEY);
    if (!sessionId) return undefined;
    return load<WebUser>(USERS_KEY).find((u) => u.id === sessionId && !u.deletedAt);
  } catch {
    return undefined;
  }
}

export function webGetUserByEmail(email: string): WebUser | undefined {
  return load<WebUser>(USERS_KEY).find(
    (u) => u.email === email.toLowerCase() && !u.deletedAt,
  );
}

export function webUpdateUser(
  id: string,
  data: Partial<Omit<WebUser, 'id' | 'email' | 'passwordHash' | 'passwordSalt' | 'createdAt'>>,
): void {
  const users = load<WebUser>(USERS_KEY);
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return;
  users[idx] = { ...users[idx], ...data, updatedAt: new Date().toISOString() };
  save(USERS_KEY, users);
}

export function webSetSession(userId: string | null): void {
  if (userId) {
    localStorage.setItem(SESSION_KEY, userId);
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

// ─── Routine blocks ──────────────────────────────────────────────────────────

export interface WebRoutineBlock {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  module: string;
  linkedEntityId?: string;
  status: string;
  calendarEventId?: string;
  energyRequired?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export function webInsertRoutineBlock(block: WebRoutineBlock): void {
  const all = load<WebRoutineBlock>(ROUTINE_KEY);
  all.push(block);
  save(ROUTINE_KEY, all);
}

export function webGetRoutineBlocksByDate(date: string): WebRoutineBlock[] {
  return load<WebRoutineBlock>(ROUTINE_KEY).filter((b) => b.date === date);
}

export function webUpdateRoutineBlockStatus(id: string, status: string): void {
  const all = load<WebRoutineBlock>(ROUTINE_KEY);
  const idx = all.findIndex((b) => b.id === id);
  if (idx === -1) return;
  all[idx] = { ...all[idx], status, updatedAt: new Date().toISOString() };
  save(ROUTINE_KEY, all);
}

export function webDeleteRoutineBlocksByDate(date: string): void {
  const all = load<WebRoutineBlock>(ROUTINE_KEY).filter((b) => b.date !== date);
  save(ROUTINE_KEY, all);
}

export function webUpdateRoutineBlock(id: string, data: Partial<WebRoutineBlock>): void {
  const all = load<WebRoutineBlock>(ROUTINE_KEY);
  const idx = all.findIndex((b) => b.id === id);
  if (idx === -1) return;
  all[idx] = { ...all[idx], ...data, updatedAt: new Date().toISOString() };
  save(ROUTINE_KEY, all);
}

export function webSetRoutineBlockCalendarEventId(id: string, calendarEventId: string | null): void {
  const all = load<WebRoutineBlock>(ROUTINE_KEY);
  const idx = all.findIndex((b) => b.id === id);
  if (idx === -1) return;
  all[idx] = {
    ...all[idx],
    calendarEventId: calendarEventId ?? undefined,
    updatedAt: new Date().toISOString(),
  };
  save(ROUTINE_KEY, all);
}

// ─── Gamification ────────────────────────────────────────────────────────────

export interface WebGamification {
  id: string;
  userId: string;
  domainScores: string;
  streaks: string;
  badges: string;
  totalXP: number;
  weeklyXP: number;
  createdAt: string;
  updatedAt: string;
}

export function webGetGamification(userId: string): WebGamification | undefined {
  return load<WebGamification>(GAMIFICATION_KEY).find((g) => g.userId === userId);
}

export function webUpsertGamification(record: WebGamification): void {
  const all = load<WebGamification>(GAMIFICATION_KEY);
  const idx = all.findIndex((g) => g.userId === record.userId);
  if (idx === -1) all.push(record);
  else all[idx] = record;
  save(GAMIFICATION_KEY, all);
}

export function webUpdateGamification(
  userId: string,
  data: Partial<Omit<WebGamification, 'id' | 'userId' | 'createdAt'>>,
): void {
  const all = load<WebGamification>(GAMIFICATION_KEY);
  const idx = all.findIndex((g) => g.userId === userId);
  if (idx === -1) return;
  all[idx] = { ...all[idx], ...data, updatedAt: new Date().toISOString() };
  save(GAMIFICATION_KEY, all);
}

// ─── Behaviour events ────────────────────────────────────────────────────────

export interface WebBehaviourEvent {
  id: string;
  eventType: string;
  module: string;
  metadata: string | null;
  hour: number;
  dayOfWeek: number;
  createdAt: string;
}

export function webInsertBehaviourEvent(event: WebBehaviourEvent): void {
  const all = load<WebBehaviourEvent>(BEHAVIOUR_KEY);
  all.push(event);
  save(BEHAVIOUR_KEY, all);
}

export function webGetBehaviourEventsLastNDays(days: number): WebBehaviourEvent[] {
  const cutoff = format(subDays(new Date(), days), 'yyyy-MM-dd');
  return load<WebBehaviourEvent>(BEHAVIOUR_KEY).filter((e) => e.createdAt >= cutoff);
}

// ─── Daily Reflections ───────────────────────────────────────────────────────

export interface WebDailyReflection {
  id: string;
  date: string;
  mood: number | null;
  blockReviews: string; // JSON
  tweakAccepted: boolean | null;
  tweakPayload: string | null;
  notes: string | null;
  createdAt: string;
}

export function webUpsertReflection(r: WebDailyReflection): void {
  const all = load<WebDailyReflection>(REFLECTIONS_KEY);
  const idx = all.findIndex((x) => x.date === r.date);
  if (idx === -1) all.push(r);
  else all[idx] = r;
  save(REFLECTIONS_KEY, all);
}

export function webGetReflectionByDate(date: string): WebDailyReflection | undefined {
  return load<WebDailyReflection>(REFLECTIONS_KEY).find((r) => r.date === date);
}

export function webGetRecentReflections(days: number): WebDailyReflection[] {
  const cutoff = format(subDays(new Date(), days), 'yyyy-MM-dd');
  return load<WebDailyReflection>(REFLECTIONS_KEY)
    .filter((r) => r.date >= cutoff)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Discovery Imports ───────────────────────────────────────────────────────

export interface WebDiscoveryImport {
  id: string;
  userId: string;
  rawText: string;
  extracted: string; // JSON
  createdAt: string;
}

export function webInsertDiscoveryImport(r: WebDiscoveryImport): void {
  const all = load<WebDiscoveryImport>(DISCOVERY_IMPORTS_KEY);
  all.push(r);
  save(DISCOVERY_IMPORTS_KEY, all);
}

export function webGetLatestDiscoveryImport(userId: string): WebDiscoveryImport | undefined {
  return load<WebDiscoveryImport>(DISCOVERY_IMPORTS_KEY)
    .filter((r) => r.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

// ─── Goals ───────────────────────────────────────────────────────────────────

export interface WebGoal {
  id: string;
  userId: string;
  title: string;
  description?: string;
  goalType: string;
  parentId?: string;
  level: string;
  timeline?: string;
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

export function webSoftDeleteGoal(id: string): void {
  const all = load<WebGoal>(GOALS_KEY);
  const idx = all.findIndex((g) => g.id === id);
  if (idx === -1) return;
  all[idx] = { ...all[idx], deletedAt: new Date().toISOString() };
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

// ─── Goal comments ───────────────────────────────────────────────────────────

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

export function webDeleteGoalComment(id: string): void {
  const all = load<WebGoalComment>(GOAL_COMMENTS_KEY);
  save(
    GOAL_COMMENTS_KEY,
    all.filter((c) => c.id !== id),
  );
}

// ─── Health logs ─────────────────────────────────────────────────────────────

export interface WebHealthLog {
  id: string;
  date: string;
  weight?: number | null;
  sleepHours?: number | null;
  steps?: number | null;
  energyLevel?: number | null;
  notes?: string | null;
  source: string;
  createdAt: string;
}

export function webInsertHealthLog(log: WebHealthLog): void {
  const all = load<WebHealthLog>(HEALTH_LOGS_KEY);
  all.push(log);
  save(HEALTH_LOGS_KEY, all);
}

export function webGetHealthLogsByDate(date: string): WebHealthLog[] {
  return load<WebHealthLog>(HEALTH_LOGS_KEY).filter((l) => l.date === date);
}

export function webGetRecentWeightLogs(limit: number): WebHealthLog[] {
  return load<WebHealthLog>(HEALTH_LOGS_KEY)
    .filter((l) => l.weight !== null && l.weight !== undefined)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

// ─── Food entries ────────────────────────────────────────────────────────────

export interface WebFoodEntry {
  id: string;
  date: string;
  mealType: string;
  foodName: string;
  quantityG: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre?: number;
  source: string;
  createdAt: string;
}

export function webInsertFoodEntry(entry: WebFoodEntry): void {
  const all = load<WebFoodEntry>(FOOD_ENTRIES_KEY);
  all.push(entry);
  save(FOOD_ENTRIES_KEY, all);
}

export function webGetFoodEntriesByDate(date: string): WebFoodEntry[] {
  return load<WebFoodEntry>(FOOD_ENTRIES_KEY).filter((e) => e.date === date);
}

// ─── Blood reports ───────────────────────────────────────────────────────────

export interface WebBloodReport {
  id: string;
  date: string;
  reportName: string;
  parsedMarkers?: string;
  aiSummary?: string;
  aiSuggestions?: string;
  rawFileUri?: string;
  createdAt: string;
}

export function webInsertBloodReport(report: WebBloodReport): void {
  const all = load<WebBloodReport>(BLOOD_REPORTS_KEY);
  all.push(report);
  save(BLOOD_REPORTS_KEY, all);
}

export function webGetBloodReports(): WebBloodReport[] {
  return load<WebBloodReport>(BLOOD_REPORTS_KEY).sort((a, b) => b.date.localeCompare(a.date));
}

export function webGetBloodReportById(id: string): WebBloodReport | undefined {
  return load<WebBloodReport>(BLOOD_REPORTS_KEY).find((r) => r.id === id);
}

// ─── Financial goals ─────────────────────────────────────────────────────────

export interface WebFinancialGoal {
  id: string;
  title: string;
  goalType: string;
  targetAmount?: number;
  currency: string;
  targetDate?: string;
  incomeBracket?: string;
  monthlySavings?: number;
  riskProfile?: string;
  status: string;
  metadata?: string;
  createdAt: string;
  updatedAt: string;
}

export function webInsertFinancialGoal(goal: WebFinancialGoal): void {
  const all = load<WebFinancialGoal>(FINANCIAL_GOALS_KEY);
  all.push(goal);
  save(FINANCIAL_GOALS_KEY, all);
}

export function webGetFinancialGoals(): WebFinancialGoal[] {
  return load<WebFinancialGoal>(FINANCIAL_GOALS_KEY).filter((g) => g.status === 'active');
}

export function webGetFinancialGoalById(id: string): WebFinancialGoal | undefined {
  return load<WebFinancialGoal>(FINANCIAL_GOALS_KEY).find((g) => g.id === id);
}

export function webUpdateFinancialGoal(
  id: string,
  data: Partial<Omit<WebFinancialGoal, 'id' | 'createdAt'>>,
): void {
  const all = load<WebFinancialGoal>(FINANCIAL_GOALS_KEY);
  const idx = all.findIndex((g) => g.id === id);
  if (idx === -1) return;
  all[idx] = { ...all[idx], ...data, updatedAt: new Date().toISOString() };
  save(FINANCIAL_GOALS_KEY, all);
}

// ─── Finance milestones ──────────────────────────────────────────────────────

export interface WebFinanceMilestone {
  id: string;
  goalId: string;
  title: string;
  targetAmount: number;
  targetDate: string;
  completedAt?: string;
  createdAt: string;
}

export function webInsertMilestone(m: WebFinanceMilestone): void {
  const all = load<WebFinanceMilestone>(FINANCE_MILESTONES_KEY);
  all.push(m);
  save(FINANCE_MILESTONES_KEY, all);
}

export function webGetMilestonesByGoal(goalId: string): WebFinanceMilestone[] {
  return load<WebFinanceMilestone>(FINANCE_MILESTONES_KEY).filter((m) => m.goalId === goalId);
}

export function webCompleteMilestone(id: string): void {
  const all = load<WebFinanceMilestone>(FINANCE_MILESTONES_KEY);
  const idx = all.findIndex((m) => m.id === id);
  if (idx === -1) return;
  all[idx] = { ...all[idx], completedAt: new Date().toISOString() };
  save(FINANCE_MILESTONES_KEY, all);
}

export function webDeleteMilestonesByGoal(goalId: string): void {
  const all = load<WebFinanceMilestone>(FINANCE_MILESTONES_KEY);
  save(FINANCE_MILESTONES_KEY, all.filter((m) => m.goalId !== goalId));
}

// ─── Interests ───────────────────────────────────────────────────────────────

export interface WebInterest {
  id: string;
  userId: string;
  name: string;
  category: string;
  weeklyMinutesTarget: number;
  weeklyMinutesActual: number;
  enjoymentLevel?: number;
  explorationDepth: string;
  status: string;
  discoveredBy: string;
  createdAt: string;
  updatedAt: string;
}

export function webInsertInterest(i: WebInterest): void {
  const all = load<WebInterest>(INTERESTS_KEY);
  all.push(i);
  save(INTERESTS_KEY, all);
}

export function webGetInterestsByUser(userId: string): WebInterest[] {
  return load<WebInterest>(INTERESTS_KEY).filter((i) => i.userId === userId && i.status !== 'deleted');
}

export function webUpdateInterest(id: string, data: Partial<WebInterest>): void {
  const all = load<WebInterest>(INTERESTS_KEY);
  const idx = all.findIndex((i) => i.id === id);
  if (idx === -1) return;
  all[idx] = { ...all[idx], ...data, updatedAt: new Date().toISOString() };
  save(INTERESTS_KEY, all);
}

export function webSoftDeleteInterest(id: string): void {
  webUpdateInterest(id, { status: 'deleted' });
}

// ─── Exploration Log ─────────────────────────────────────────────────────────

export interface WebExplorationLog {
  id: string;
  interestId: string;
  date: string;
  minutesSpent: number;
  notes?: string;
  createdAt: string;
}

export function webInsertExploration(e: WebExplorationLog): void {
  const all = load<WebExplorationLog>(EXPLORATION_LOG_KEY);
  all.push(e);
  save(EXPLORATION_LOG_KEY, all);
}

export function webGetExplorationByInterest(interestId: string): WebExplorationLog[] {
  return load<WebExplorationLog>(EXPLORATION_LOG_KEY).filter((e) => e.interestId === interestId);
}

export function webGetExplorationForUser(
  userIds: string[],
): WebExplorationLog[] {
  const interests = load<WebInterest>(INTERESTS_KEY).filter((i) => userIds.includes(i.userId));
  const ids = new Set(interests.map((i) => i.id));
  return load<WebExplorationLog>(EXPLORATION_LOG_KEY).filter((e) => ids.has(e.interestId));
}
