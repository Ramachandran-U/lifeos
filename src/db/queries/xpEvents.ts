import { Platform } from 'react-native';
import { and, eq, gte } from 'drizzle-orm';
import { format } from 'date-fns';
import { nanoid } from '@/utils/id';
import { db } from '../index';
import { xpEvents } from '../schema';
import { webInsertXpEvent, webGetXpEventsSince, type WebXpEvent } from '../webStorage';
import { recordMutation } from '@/sync/runtime';

const isWeb = Platform.OS === 'web';

export type XpSource =
  | 'block'
  | 'goal_task'
  | 'quest'
  | 'badge'
  | 'chest'
  | 'milestone'
  | 'comeback'
  | 'food'
  | 'resource'
  | 'misc';

export interface XpGrantInput {
  amount: number; // must be > 0 — the ledger is append-only and additive
  domain?: string | null;
  source: XpSource;
  refId?: string | null;
}

/** Device-local YYYY-MM-DD. All retention mechanics bucket by LOCAL day. */
export function localDayISO(d: Date = new Date()): string {
  return format(d, 'yyyy-MM-dd');
}

/**
 * Append one immutable row to the XP ledger. Callers should go through
 * useGameStore.grantXP (which also bumps the gamification counters and
 * enqueues the reward beat) — this function only persists + logs the event.
 */
export function insertXpEvent(userId: string, input: XpGrantInput): string {
  const id = nanoid();
  const now = new Date().toISOString();
  const row: WebXpEvent = {
    id,
    userId,
    amount: Math.max(1, Math.round(input.amount)),
    domain: input.domain ?? null,
    source: input.source,
    refId: input.refId ?? null,
    dayLocal: localDayISO(),
    createdAt: now,
    updatedAt: now,
  };

  if (isWeb) {
    webInsertXpEvent(row);
  } else {
    db.insert(xpEvents).values(row).run();
  }

  // Insert-only entity — the default sync fold materializes it; no CRDT
  // merger needed until cross-device aggregation is wanted (future leagues).
  recordMutation({
    entity: 'xp_events',
    entityId: id,
    op: 'insert',
    before: null,
    after: row as unknown as Record<string, unknown>,
  });

  return id;
}

/** Sum of XP earned since (and including) fromDayLocal. */
export function getXpSince(userId: string, fromDayLocal: string): number {
  if (isWeb) {
    return webGetXpEventsSince(userId, fromDayLocal).reduce((sum, e) => sum + e.amount, 0);
  }
  const rows = db.select().from(xpEvents)
    .where(and(eq(xpEvents.userId, userId), gte(xpEvents.dayLocal, fromDayLocal)))
    .all();
  return rows.reduce((sum, e) => sum + e.amount, 0);
}

/**
 * XP earned this calendar week (Monday-start, device-local) — the derived
 * replacement for the legacy never-reset `weeklyXP` counter.
 */
export function getXpThisWeek(userId: string, today: Date = new Date()): number {
  const day = today.getDay(); // 0 Sun .. 6 Sat
  const sinceMonday = (day + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - sinceMonday);
  return getXpSince(userId, localDayISO(monday));
}
