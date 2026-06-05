/**
 * Rabbit-hole tree persistence (Explore v3). One row per tree; the whole tree is
 * an opaque JSON blob (`treeJson`) — the domain layer (src/explore/rabbitHoleTree.ts)
 * serializes/parses + Zod-validates it. Native = Drizzle/SQLite; web = the
 * synchronous localStorage shim. Reads are synchronous on both so the render
 * path never awaits.
 *
 * LOCAL ONLY: rabbit-hole sync is parked (Phase 7), so these writes are
 * deliberately NOT routed through the sync mutation log.
 */
import { Platform } from 'react-native';
import { eq } from 'drizzle-orm';
import { db } from '../index';
import { rabbitHoleTrees } from '../schema';
import {
  webUpsertRabbitHoleTree,
  webGetRabbitHoleTree,
  webGetRabbitHoleTreeBySpark,
  webListRabbitHoleTrees,
  webCountRabbitHoleTreesToday,
  webSoftDeleteRabbitHoleTree,
  type WebRabbitHoleTree,
} from '../webStorage';

/** The stored row. JSON columns (`anchorJson`/`treeJson`/`scoringJson`) are
 * opaque strings here; parse them with the schemas in `@/explore/rabbitHoleTree`. */
export type RabbitHoleTreeRow = WebRabbitHoleTree;

const isWeb = Platform.OS === 'web';

/** Normalize a native Drizzle row into the shared Row shape (string JSON columns). */
const fromDbRow = (r: typeof rabbitHoleTrees.$inferSelect): RabbitHoleTreeRow => ({
  id: r.id,
  userId: r.userId,
  sparkId: r.sparkId,
  anchorJson: r.anchorJson,
  treeJson: r.treeJson,
  scoringJson: r.scoringJson,
  title: r.title,
  xpAwarded: r.xpAwarded,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
  deletedAt: r.deletedAt,
});

const liveRowsForUser = (userId: string): RabbitHoleTreeRow[] =>
  db.select().from(rabbitHoleTrees).where(eq(rabbitHoleTrees.userId, userId)).all()
    .map(fromDbRow)
    .filter((r) => !r.deletedAt);

/** Insert or replace a tree by id — the screen rewrites the blob on every move. */
export function upsertRabbitHoleTree(row: RabbitHoleTreeRow): void {
  if (isWeb) {
    webUpsertRabbitHoleTree(row);
    return;
  }
  db.insert(rabbitHoleTrees).values(row).onConflictDoUpdate({
    target: rabbitHoleTrees.id,
    set: {
      sparkId: row.sparkId,
      anchorJson: row.anchorJson,
      treeJson: row.treeJson,
      scoringJson: row.scoringJson,
      title: row.title,
      xpAwarded: row.xpAwarded,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    },
  }).run();
}

/** A single tree by id (soft-deleted rows hidden). */
export function getRabbitHoleTree(id: string): RabbitHoleTreeRow | undefined {
  if (isWeb) return webGetRabbitHoleTree(id);
  const row = db.select().from(rabbitHoleTrees).where(eq(rabbitHoleTrees.id, id)).all()
    .map(fromDbRow)
    .find((r) => !r.deletedAt);
  return row;
}

/** The tree spawned from a given spark, if any. */
export function getRabbitHoleTreeBySpark(sparkId: string): RabbitHoleTreeRow | undefined {
  if (isWeb) return webGetRabbitHoleTreeBySpark(sparkId);
  return db.select().from(rabbitHoleTrees).where(eq(rabbitHoleTrees.sparkId, sparkId)).all()
    .map(fromDbRow)
    .find((r) => !r.deletedAt);
}

/** A user's trees, newest first — the "Your Maps" history feed. */
export function listRabbitHoleTrees(userId: string): RabbitHoleTreeRow[] {
  if (isWeb) return webListRabbitHoleTrees(userId);
  return liveRowsForUser(userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Trees the user created on `date` (YYYY-MM-DD) — the Q3 daily-diminishing gate. */
export function countRabbitHoleTreesToday(userId: string, date: string): number {
  if (isWeb) return webCountRabbitHoleTreesToday(userId, date);
  return liveRowsForUser(userId).filter((r) => r.createdAt.slice(0, 10) === date).length;
}

/** Soft-delete a tree (never hard-delete user data). */
export function softDeleteRabbitHoleTree(id: string, deletedAt: string): void {
  if (isWeb) {
    webSoftDeleteRabbitHoleTree(id, deletedAt);
    return;
  }
  db.update(rabbitHoleTrees).set({ deletedAt }).where(eq(rabbitHoleTrees.id, id)).run();
}
