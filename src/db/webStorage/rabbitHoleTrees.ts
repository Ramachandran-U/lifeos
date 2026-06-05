/**
 * Web storage for rabbit-hole trees — the synchronous localStorage substitute
 * for the native SQLite `rabbit_hole_trees` table. Reads return values (not
 * Promises) so the render path stays synchronous, matching the other per-entity
 * web stores. The tree itself lives as an opaque JSON string in `treeJson`; the
 * domain layer (src/explore/rabbitHoleTree.ts) parses + validates it on read.
 */
import { load, save } from './_io';
import { RABBIT_HOLE_TREES_KEY } from './_keys';

/** Mirrors the `rabbit_hole_trees` columns. JSON columns are opaque strings. */
export interface WebRabbitHoleTree {
  id: string;
  userId: string;
  sparkId: string;
  anchorJson: string;
  treeJson: string;
  scoringJson: string;
  title: string | null;
  xpAwarded: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

const live = (rows: WebRabbitHoleTree[]): WebRabbitHoleTree[] => rows.filter((r) => !r.deletedAt);

/** Insert or replace a tree row by id — the screen rewrites the blob on every move. */
export function webUpsertRabbitHoleTree(row: WebRabbitHoleTree): void {
  const all = load<WebRabbitHoleTree>(RABBIT_HOLE_TREES_KEY);
  const idx = all.findIndex((t) => t.id === row.id);
  if (idx === -1) all.push(row);
  else all[idx] = row;
  save(RABBIT_HOLE_TREES_KEY, all);
}

/** A single tree by id (soft-deleted rows are hidden). */
export function webGetRabbitHoleTree(id: string): WebRabbitHoleTree | undefined {
  return live(load<WebRabbitHoleTree>(RABBIT_HOLE_TREES_KEY)).find((t) => t.id === id);
}

/** The tree spawned from a given spark, if any (sparks.threadId points here). */
export function webGetRabbitHoleTreeBySpark(sparkId: string): WebRabbitHoleTree | undefined {
  return live(load<WebRabbitHoleTree>(RABBIT_HOLE_TREES_KEY)).find((t) => t.sparkId === sparkId);
}

/** A user's trees, newest first — the "Your Maps" history feed. */
export function webListRabbitHoleTrees(userId: string): WebRabbitHoleTree[] {
  return live(load<WebRabbitHoleTree>(RABBIT_HOLE_TREES_KEY))
    .filter((t) => t.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** How many trees the user created on `date` (YYYY-MM-DD) — the Q3 daily gate. */
export function webCountRabbitHoleTreesToday(userId: string, date: string): number {
  return live(load<WebRabbitHoleTree>(RABBIT_HOLE_TREES_KEY))
    .filter((t) => t.userId === userId && t.createdAt.slice(0, 10) === date).length;
}

/** Soft-delete a tree (never hard-delete user data). */
export function webSoftDeleteRabbitHoleTree(id: string, deletedAt: string): void {
  const all = load<WebRabbitHoleTree>(RABBIT_HOLE_TREES_KEY);
  const idx = all.findIndex((t) => t.id === id);
  if (idx === -1) return;
  all[idx] = { ...all[idx]!, deletedAt };
  save(RABBIT_HOLE_TREES_KEY, all);
}
