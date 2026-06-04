import { subDays, format } from 'date-fns';
import { load, save } from './_io';
import { GAMIFICATION_KEY, BEHAVIOUR_KEY } from './_keys';
import { BEHAVIOUR_RETENTION_DAYS, BEHAVIOUR_WEB_CAP } from '../retention';

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
  // Bound growth before persisting (this table is append-only analytics that
  // nothing else trimmed). First drop anything past the retention window —
  // reads only ever look back ≤30 days — then enforce a hard count backstop so
  // a burst can't blow the localStorage quota shared with the mutation log.
  // Events are kept in insertion (chronological) order, so the tail is newest.
  const cutoff = format(subDays(new Date(), BEHAVIOUR_RETENTION_DAYS), 'yyyy-MM-dd');
  let pruned = all.filter((e) => e.createdAt >= cutoff);
  if (pruned.length > BEHAVIOUR_WEB_CAP) pruned = pruned.slice(pruned.length - BEHAVIOUR_WEB_CAP);
  try {
    save(BEHAVIOUR_KEY, pruned);
  } catch {
    // Quota still exceeded (other stores filling the budget): retry once with
    // an aggressively trimmed tail so one failed write doesn't wedge every
    // future insert — and never throw, since behaviour logging is best-effort
    // analytics called from hot paths (e.g. screen-view tracking).
    const tail = pruned.slice(Math.max(0, pruned.length - Math.floor(BEHAVIOUR_WEB_CAP / 5)));
    try {
      save(BEHAVIOUR_KEY, tail);
    } catch {
      /* give up silently — losing analytics events must never break the UI */
    }
  }
}

export function webGetBehaviourEventsLastNDays(days: number): WebBehaviourEvent[] {
  const cutoff = format(subDays(new Date(), days), 'yyyy-MM-dd');
  return load<WebBehaviourEvent>(BEHAVIOUR_KEY).filter((e) => e.createdAt >= cutoff);
}
