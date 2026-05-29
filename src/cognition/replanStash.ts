/**
 * Undo stash for "Adjust now" priority replans (Phase B).
 *
 * When the user confirms a same-day replan, we delete some blocks and insert
 * new ones — but we keep the originals in a stash with a 24h TTL so undo is
 * possible. After 24h the stash entry expires and is cleaned up on the next
 * read. PURE module: storage is injected so it's fully unit-testable.
 *
 * Storage shape (one entry per (userId, date)):
 *   stash[userId:date] = {
 *     stashedAt: ISO,
 *     droppedBlocks: original blocks that were deleted (full row),
 *     insertedBlockIds: ids of the blocks we added (to delete on undo),
 *     priorPriorities: previous primaryDomains snapshot,
 *   }
 */

import type { DomainId } from '@/store/useUserStore';

export const STASH_TTL_MS = 24 * 60 * 60 * 1000;

export interface StashedBlock {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  module: string;
  status: string;
  linkedEntityId?: string | null;
  energyRequired?: string | null;
}

export interface ReplanStashEntry {
  stashedAt: string; // ISO
  droppedBlocks: StashedBlock[];
  insertedBlockIds: string[];
  priorPriorities: DomainId[];
}

export interface StashStorage {
  read: (key: string) => string | null;
  write: (key: string, value: string) => void;
  remove: (key: string) => void;
}

const stashKey = (userId: string, date: string) => `lifeos_replan_stash:${userId}:${date}`;

export function stashReplan(
  storage: StashStorage,
  userId: string,
  date: string,
  entry: Omit<ReplanStashEntry, 'stashedAt'>,
  now: Date = new Date(),
): void {
  const payload: ReplanStashEntry = { ...entry, stashedAt: now.toISOString() };
  storage.write(stashKey(userId, date), JSON.stringify(payload));
}

/** Read the stash if present and not expired; auto-cleans on expiry. */
export function readStash(
  storage: StashStorage,
  userId: string,
  date: string,
  now: Date = new Date(),
): ReplanStashEntry | null {
  const raw = storage.read(stashKey(userId, date));
  if (!raw) return null;
  let parsed: ReplanStashEntry;
  try { parsed = JSON.parse(raw) as ReplanStashEntry; } catch { return null; }
  const ageMs = now.getTime() - new Date(parsed.stashedAt).getTime();
  if (ageMs > STASH_TTL_MS || ageMs < 0) {
    storage.remove(stashKey(userId, date));
    return null;
  }
  return parsed;
}

export function clearStash(storage: StashStorage, userId: string, date: string): void {
  storage.remove(stashKey(userId, date));
}

/** Has an unexpired stash for (user, date)? */
export function hasUndoableStash(
  storage: StashStorage,
  userId: string,
  date: string,
  now: Date = new Date(),
): boolean {
  return readStash(storage, userId, date, now) !== null;
}

/** Minutes remaining before the stash expires (rounded down). 0 if expired/missing. */
export function stashRemainingMinutes(
  storage: StashStorage,
  userId: string,
  date: string,
  now: Date = new Date(),
): number {
  const entry = readStash(storage, userId, date, now);
  if (!entry) return 0;
  const ageMs = now.getTime() - new Date(entry.stashedAt).getTime();
  return Math.max(0, Math.floor((STASH_TTL_MS - ageMs) / 60000));
}

/** A localStorage-backed StashStorage for the web/native runtime. */
export function browserStashStorage(): StashStorage {
  return {
    read: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    write: (k, v) => { try { localStorage.setItem(k, v); } catch { /* full/private mode */ } },
    remove: (k) => { try { localStorage.removeItem(k); } catch { /* no-op */ } },
  };
}
