import { subDays, format } from 'date-fns';
import { load, save } from './_io';
import { XP_EVENTS_KEY } from './_keys';
import { XP_EVENTS_RETENTION_DAYS, XP_EVENTS_WEB_CAP } from '../retention';

export interface WebXpEvent {
  id: string;
  userId: string;
  amount: number;
  domain: string | null;
  source: string;
  refId: string | null;
  dayLocal: string; // YYYY-MM-DD device-local
  createdAt: string;
  updatedAt: string;
}

export function webInsertXpEvent(event: WebXpEvent): void {
  const all = load<WebXpEvent>(XP_EVENTS_KEY);
  all.push(event);
  // Bound growth before persisting (append-only ledger; web reads look back
  // ≤90 days — the synced mutation log keeps the full history). Same
  // age-prune + count-backstop + best-effort shape as webInsertBehaviourEvent.
  const cutoff = format(subDays(new Date(), XP_EVENTS_RETENTION_DAYS), 'yyyy-MM-dd');
  let pruned = all.filter((e) => e.dayLocal >= cutoff);
  if (pruned.length > XP_EVENTS_WEB_CAP) pruned = pruned.slice(pruned.length - XP_EVENTS_WEB_CAP);
  try {
    save(XP_EVENTS_KEY, pruned);
  } catch {
    const tail = pruned.slice(Math.max(0, pruned.length - Math.floor(XP_EVENTS_WEB_CAP / 5)));
    try {
      save(XP_EVENTS_KEY, tail);
    } catch {
      /* give up silently — losing a ledger row must never break an XP grant */
    }
  }
}

/** All events for a user with dayLocal >= fromDayLocal (inclusive). */
export function webGetXpEventsSince(userId: string, fromDayLocal: string): WebXpEvent[] {
  return load<WebXpEvent>(XP_EVENTS_KEY).filter(
    (e) => e.userId === userId && e.dayLocal >= fromDayLocal,
  );
}
