/**
 * Constellation edge persistence (Explore v3). A local, rebuildable edge source
 * emitted by rabbit-hole journeys and read by projectConstellation. Native =
 * Drizzle/SQLite; web = the synchronous localStorage shim. Upsert is idempotent
 * by edge id — re-emitting the same edge touches updatedAt, never inflates weight.
 *
 * LOCAL ONLY: bypasses the sync mutation log (the constellation rebuilds from
 * source on each projection).
 */
import { Platform } from 'react-native';
import { eq } from 'drizzle-orm';
import { db } from '../index';
import { constellationEdges } from '../schema';
import {
  webUpsertConstellationEdge,
  webListConstellationEdges,
  type WebConstellationEdge,
} from '../webStorage';

export type ConstellationEdgeRow = WebConstellationEdge;

const isWeb = Platform.OS === 'web';

const fromDbRow = (r: typeof constellationEdges.$inferSelect): ConstellationEdgeRow => ({
  id: r.id,
  userId: r.userId,
  fromId: r.fromId,
  toId: r.toId,
  relation: r.relation,
  weight: r.weight,
  sourceTreeId: r.sourceTreeId,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

/** Insert a new edge or touch an existing one (idempotent by id). */
export function upsertConstellationEdge(row: ConstellationEdgeRow): void {
  if (isWeb) {
    webUpsertConstellationEdge(row);
    return;
  }
  db.insert(constellationEdges).values(row).onConflictDoUpdate({
    target: constellationEdges.id,
    set: { updatedAt: row.updatedAt, sourceTreeId: row.sourceTreeId },
  }).run();
}

export function listConstellationEdges(userId: string): ConstellationEdgeRow[] {
  if (isWeb) return webListConstellationEdges(userId);
  return db.select().from(constellationEdges).where(eq(constellationEdges.userId, userId)).all().map(fromDbRow);
}
