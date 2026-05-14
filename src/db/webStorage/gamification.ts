import { subDays, format } from 'date-fns';
import { load, save } from './_io';
import { GAMIFICATION_KEY, BEHAVIOUR_KEY } from './_keys';

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
