import { Platform } from 'react-native';
import { and, eq, isNull } from 'drizzle-orm';
import { nanoid } from '@/utils/id';
import { db } from '../index';
import { chests } from '../schema';
import {
  webInsertChest,
  webUpdateChest,
  webGetChestById,
  webGetPendingChests,
  webCountChestsGrantedOnDay,
  type WebChest,
} from '../webStorage';
import { recordMutation } from '@/sync/runtime';
import type { ChestContents } from '@/gamification/lootTable';

const isWeb = Platform.OS === 'web';

export type ChestSource = 'peak_beat' | 'milestone' | 'quest_sweep' | 'comeback';
export type ChestStatus = 'pending' | 'opened';

export type ChestRecord = WebChest;

/**
 * Grant one chest. The roll is sealed here: `seed` is written at grant time,
 * so what the chest contains is decided the moment it's earned — opening it
 * later (or never) cannot change the outcome. Returns the new id.
 */
export function insertChest(userId: string, source: ChestSource, dayLocal: string): string {
  const id = nanoid();
  const now = new Date().toISOString();
  const row: WebChest = {
    id,
    userId,
    source,
    status: 'pending',
    // Deterministic per-chest key for src/utils/seededRandom — the id is the
    // entropy; the prefix keeps chest rolls disjoint from quest selection.
    seed: `chest:${userId}:${dayLocal}:${id}`,
    contents: null,
    dayLocal,
    grantedAt: now,
    claimedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  if (isWeb) {
    webInsertChest(row);
  } else {
    db.insert(chests).values(row).run();
  }

  recordMutation({ entity: 'chests', entityId: id, op: 'insert', before: null, after: row as unknown as Record<string, unknown> });
  return id;
}

export function getChestById(id: string): ChestRecord | undefined {
  if (isWeb) return webGetChestById(id);
  return db.select().from(chests).where(eq(chests.id, id)).get() as unknown as ChestRecord | undefined;
}

/** Unopened chests, oldest first — the rewards-tab strip renders these. */
export function getPendingChests(userId: string): ChestRecord[] {
  const rows = isWeb
    ? webGetPendingChests(userId)
    : (db.select().from(chests)
        .where(and(eq(chests.userId, userId), eq(chests.status, 'pending'), isNull(chests.deletedAt)))
        .all() as unknown as ChestRecord[]);
  return [...rows].sort((a, b) => (a.grantedAt < b.grantedAt ? -1 : 1));
}

/** Chests granted on a local day (any status) — backs the ≤1/day cap. */
export function countChestsGrantedOnDay(userId: string, dayLocal: string): number {
  if (isWeb) return webCountChestsGrantedOnDay(userId, dayLocal);
  return (db.select().from(chests)
    .where(and(eq(chests.userId, userId), eq(chests.dayLocal, dayLocal), isNull(chests.deletedAt)))
    .all() as unknown as ChestRecord[]).length;
}

/** Seal the claim: status flip + rolled contents + claim timestamp. */
export function markChestOpened(id: string, contents: ChestContents): void {
  const before = getChestById(id);
  if (!before) return;
  const now = new Date().toISOString();
  const data = {
    status: 'opened' as const,
    contents: JSON.stringify(contents),
    claimedAt: now,
  };

  if (isWeb) {
    webUpdateChest(id, data);
  } else {
    db.update(chests).set({ ...data, updatedAt: now }).where(eq(chests.id, id)).run();
  }

  recordMutation({
    entity: 'chests',
    entityId: id,
    op: 'update',
    before: before as unknown as Record<string, unknown>,
    after: { ...(before as unknown as Record<string, unknown>), ...data, updatedAt: now },
  });
}
