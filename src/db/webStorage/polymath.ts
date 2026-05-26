import { load, save } from './_io';
import { INTERESTS_KEY, EXPLORATION_LOG_KEY } from './_keys';

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
  timeProtected?: boolean;
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

export function webGetExplorationForUser(userIds: string[]): WebExplorationLog[] {
  const interests = load<WebInterest>(INTERESTS_KEY).filter((i) => userIds.includes(i.userId));
  const ids = new Set(interests.map((i) => i.id));
  return load<WebExplorationLog>(EXPLORATION_LOG_KEY).filter((e) => ids.has(e.interestId));
}
