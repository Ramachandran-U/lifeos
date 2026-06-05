/**
 * Rabbit-hole → constellation feed (Explore v3, Phase 3). A rabbit-hole journey
 * contributes two kinds of edge to the user's star-map:
 *
 *   - led_to: along the active path (root → cursor), concept → concept, showing
 *     where the wandering went.
 *   - synapse: between the anchor's seedInterest and adjacentField interest
 *     nodes, IFF they are in different categories (the prestige cross-discipline
 *     link) AND the user actually took a sideways jump in this tree.
 *
 * buildThreadEdges / detectSynapsePairs are PURE (tested directly).
 * emitThreadToConstellation persists via the idempotent edge upsert.
 */
import {
  pathToRoot,
  asLookup,
  type RabbitHoleAnchor,
  type RabbitHoleTreeData,
} from './rabbitHoleTree';
import {
  crossCategoryPair,
  interestNodeId,
  conceptNodeId,
  type CategorizedInterest,
} from './isCrossCategory';
import type { ConstellationExtraEdge } from './constellation';
import { upsertConstellationEdge } from '@/db/queries/constellationEdges';

/** Did the user take at least one real lateral jump (a realized sideways fork)? */
function hasSidewaysJump(treeData: RabbitHoleTreeData): boolean {
  return Object.values(treeData.nodeMap).some((n) => n.forks[1].childId != null);
}

/** PURE: the constellation edges this tree currently contributes. */
export function buildThreadEdges(
  treeData: RabbitHoleTreeData,
  anchor: RabbitHoleAnchor,
  interests: readonly CategorizedInterest[],
): ConstellationExtraEdge[] {
  const edges: ConstellationExtraEdge[] = [];

  // led_to along the active path (root → cursor).
  const path = pathToRoot(treeData.cursorId, asLookup(treeData.nodeMap));
  for (let i = 0; i < path.length - 1; i++) {
    const from = conceptNodeId(path[i].title);
    const to = conceptNodeId(path[i + 1].title);
    if (from !== to) edges.push({ fromId: from, toId: to, relation: 'led_to' });
  }

  // synapse: cross-category anchor + a real sideways jump.
  if (anchor.seedInterest && anchor.adjacentField && hasSidewaysJump(treeData)) {
    if (crossCategoryPair(anchor.seedInterest, anchor.adjacentField, interests)) {
      edges.push({
        fromId: interestNodeId(anchor.seedInterest),
        toId: interestNodeId(anchor.adjacentField),
        relation: 'synapse',
      });
    }
  }
  return edges;
}

/**
 * PURE: the "catA|catB" synapse pair keys this tree earns for scoring. At most
 * one (the anchor's category pair), present only when the anchor is
 * cross-category AND the user took a sideways jump.
 */
export function detectSynapsePairs(
  treeData: RabbitHoleTreeData,
  anchor: RabbitHoleAnchor,
  interests: readonly CategorizedInterest[],
): string[] {
  if (!anchor.seedInterest || !anchor.adjacentField || !hasSidewaysJump(treeData)) return [];
  const pair = crossCategoryPair(anchor.seedInterest, anchor.adjacentField, interests);
  return pair ? [pair] : [];
}

/** Deterministic edge id so re-emitting is idempotent (synapse is undirected). */
function edgeRowId(userId: string, fromId: string, toId: string, relation: string): string {
  const [a, b] = relation === 'synapse' && fromId > toId ? [toId, fromId] : [fromId, toId];
  return `${userId}:${relation}:${a}->${b}`;
}

/** Persist this tree's edges to the local constellation_edges table (idempotent). */
export function emitThreadToConstellation(args: {
  userId: string;
  treeData: RabbitHoleTreeData;
  anchor: RabbitHoleAnchor;
  interests: readonly CategorizedInterest[];
  sourceTreeId: string;
  now: string;
}): void {
  for (const e of buildThreadEdges(args.treeData, args.anchor, args.interests)) {
    upsertConstellationEdge({
      id: edgeRowId(args.userId, e.fromId, e.toId, e.relation),
      userId: args.userId,
      fromId: e.fromId,
      toId: e.toId,
      relation: e.relation,
      weight: 1,
      sourceTreeId: args.sourceTreeId,
      createdAt: args.now,
      updatedAt: args.now,
    });
  }
}
