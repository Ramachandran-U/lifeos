import { subDays, format } from 'date-fns';
import { load, save } from './_io';
import { CHESTS_KEY } from './_keys';

export interface WebChest {
  id: string;
  userId: string;
  source: string; // 'peak_beat' | 'milestone' | 'quest_sweep' | 'comeback'
  status: string; // 'pending' | 'opened'
  seed: string;
  contents: string | null; // JSON ChestContents — null until claimed
  dayLocal: string; // grant day (device-local) — backs the ≤1/day cap
  grantedAt: string;
  claimedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/**
 * Opened chests older than this are pruned (the reward was already applied to
 * the gamification counters — the row is just history). PENDING chests are
 * NEVER pruned: a chest waits indefinitely by design (no expiry — ethics).
 */
const OPENED_CHEST_RETENTION_DAYS = 90;

function prune(all: WebChest[]): WebChest[] {
  const cutoff = format(subDays(new Date(), OPENED_CHEST_RETENTION_DAYS), 'yyyy-MM-dd');
  return all.filter((ch) => ch.status === 'pending' || ch.dayLocal >= cutoff);
}

export function webInsertChest(chest: WebChest): void {
  const all = prune(load<WebChest>(CHESTS_KEY));
  all.push(chest);
  try {
    save(CHESTS_KEY, all);
  } catch {
    /* best-effort — losing a chest row must never break the moment that granted it */
  }
}

export function webUpdateChest(id: string, data: Partial<Omit<WebChest, 'id' | 'userId' | 'createdAt'>>): void {
  const all = load<WebChest>(CHESTS_KEY);
  const idx = all.findIndex((ch) => ch.id === id);
  if (idx === -1) return;
  all[idx] = { ...all[idx], ...data, updatedAt: new Date().toISOString() };
  try {
    save(CHESTS_KEY, all);
  } catch {
    /* best-effort */
  }
}

export function webGetChestById(id: string): WebChest | undefined {
  return load<WebChest>(CHESTS_KEY).find((ch) => ch.id === id);
}

export function webGetPendingChests(userId: string): WebChest[] {
  return load<WebChest>(CHESTS_KEY).filter(
    (ch) => ch.userId === userId && ch.status === 'pending' && !ch.deletedAt,
  );
}

export function webCountChestsGrantedOnDay(userId: string, dayLocal: string): number {
  return load<WebChest>(CHESTS_KEY).filter(
    (ch) => ch.userId === userId && ch.dayLocal === dayLocal && !ch.deletedAt,
  ).length;
}
