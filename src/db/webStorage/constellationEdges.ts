/**
 * Web storage for constellation edges — the synchronous localStorage substitute
 * for the native `constellation_edges` table. Rabbit-hole journeys emit edges
 * here; projectConstellation reads them as an extra edge source. Upsert is
 * idempotent by edge id (re-emitting the same edge does not inflate weight).
 */
import { load, save } from './_io';
import { CONSTELLATION_EDGES_KEY } from './_keys';

export interface WebConstellationEdge {
  id: string;
  userId: string;
  fromId: string;
  toId: string;
  relation: string;
  weight: number;
  sourceTreeId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Insert a new edge, or touch updatedAt/sourceTreeId on an existing one
 * (idempotent — weight is not inflated by re-emits). */
export function webUpsertConstellationEdge(row: WebConstellationEdge): void {
  const all = load<WebConstellationEdge>(CONSTELLATION_EDGES_KEY);
  const idx = all.findIndex((e) => e.id === row.id);
  if (idx === -1) all.push(row);
  else all[idx] = { ...all[idx]!, updatedAt: row.updatedAt, sourceTreeId: row.sourceTreeId ?? all[idx]!.sourceTreeId };
  save(CONSTELLATION_EDGES_KEY, all);
}

export function webListConstellationEdges(userId: string): WebConstellationEdge[] {
  return load<WebConstellationEdge>(CONSTELLATION_EDGES_KEY).filter((e) => e.userId === userId);
}
