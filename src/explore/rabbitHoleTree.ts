/**
 * Rabbit-hole decision-tree model (Explore v3 — the navigable tree-map redesign).
 *
 * The legacy rabbit hole was a DESTRUCTIVE LINEAR STACK held in `useState`:
 * `goBack()` sliced off the tail, "branch sideways" just continued one line, and
 * nothing persisted. This module replaces it with a PERSISTENT, append-only TREE
 * the user wanders with a cursor — every fork ever opened stays drawn, "back"
 * climbs to the parent (never deletes), and the path-not-taken stays a tappable
 * ghost. See `docs/rabbit-hole-tree-map-redesign.md` for the full design.
 *
 * This file is PURE: types, Zod schemas, and side-effect-free tree operations.
 * ID generation, timestamps, persistence, AI calls, XP, and rendering live in the
 * store / actions / component layers (Phase 2+). Everything here is unit-tested.
 */
import { z } from 'zod';
import { isConcreteNode, type GeneratedNode } from './rabbitHole';

// --- Core types -------------------------------------------------------------

export type RabbitHoleDirection = 'deeper' | 'sideways';
export type ForkState = 'realized' | 'ghost';

/** One of a node's two forward choices. `deeper` drills in; `sideways` jumps to
 * an adjacent concept. A `ghost` fork is un-taken (no child yet). */
export interface RabbitHoleFork {
  readonly direction: RabbitHoleDirection;
  readonly hint: string; // goDeeperHint / goSidewaysHint from the GeneratedNode
  childId: string | null; // null iff ghost; set to the child node id once taken
  state: ForkState;
}

/** A node in the tree. `forks` is ALWAYS `[deeper, sideways]` in that order —
 * index by the constant (0/1), read `.direction` only for display. */
export interface RabbitHoleNode {
  readonly id: string;
  readonly parentId: string | null; // null iff root
  readonly arrivedVia: RabbitHoleDirection | null; // null iff root
  readonly title: string;
  readonly body: string; // >= 20 chars (mirrors the GeneratedNode Zod contract)
  readonly forks: readonly [RabbitHoleFork, RabbitHoleFork];
  readonly createdAt: string; // ISO-8601
  visitedAt: string | null; // last time the cursor sat on this node
}

/** The original spark that anchors the whole tree — keeps wanderings tethered. */
export interface RabbitHoleAnchor {
  readonly title: string;
  readonly seedInterest: string | null;
  readonly adjacentField: string | null;
}

/** The in-memory tree: a normalized node map plus the root and the cursor. This
 * is exactly what gets serialized into the `treeJson` blob column. */
export interface RabbitHoleTreeData {
  nodeMap: Record<string, RabbitHoleNode>;
  rootId: string;
  cursorId: string;
}

/** Idempotency ledger — each shape-milestone is paid once, even across
 * re-hydration. Lives in the `scoringJson` column; orchestrated in Phase 2. */
export interface RabbitHoleScoring {
  scoredDepthTier: number; // highest depth tier already paid (0 = none)
  scoredBranchIds: string[]; // branch fork-node ids already paid for breadth
  scoredSynapsePairs: string[]; // sorted "catA|catB" pairs paid in THIS tree
  badgesFired: string[]; // BadgeId[] already toasted for this tree
  dailyMapCountKey: string; // 'YYYY-MM-DD' bucket for the daily diminishing gate
}

// --- Locked constants (see the design doc's resolved decisions) -------------

/** Per-BRANCH soft depth cap (Q1: depth is measured along the path, not globally). */
export const RABBIT_HOLE_MAX_DEPTH = 12;

/** Q6: keep the tree fully expanded until it crosses this many rendered nodes;
 * only then auto-collapse off-path, deeper-than-cursor subtrees. */
export const AUTO_COLLAPSE_NODE_THRESHOLD = 20;

/** Q5: two depth tiers (deeper-chain length) that pay once each when crossed. */
export const DEPTH_TIERS = [3, 5] as const;

/** Structural reward gates (XP amounts are mapped to XP_VALUES in the Phase-2
 * scoring layer; this module owns only the shape thresholds). */
export const REWARD_GATES = {
  maxBreadthBranches: 3, // Q2: at most 3 qualifying branches pay breadth XP
  maxSynapsesPerTree: 2, // Q4-adjacent: at most 2 synapses pay per tree
  dailyFullScoringTrees: 2, // Q3: trees 1-2/day score fully; tree 3+ depth-only
} as const;

// --- Zod schemas (validate at every persistence read boundary) --------------

export const RabbitHoleForkSchema = z.object({
  direction: z.enum(['deeper', 'sideways']),
  hint: z.string().min(1),
  childId: z.string().nullable(),
  state: z.enum(['realized', 'ghost']),
});

export const RabbitHoleNodeSchema = z.object({
  id: z.string().min(1),
  parentId: z.string().nullable(),
  arrivedVia: z.enum(['deeper', 'sideways']).nullable(),
  title: z.string().min(1),
  body: z.string().min(20),
  forks: z.tuple([RabbitHoleForkSchema, RabbitHoleForkSchema]),
  createdAt: z.string().datetime(),
  visitedAt: z.string().datetime().nullable(),
});

export const RabbitHoleAnchorSchema = z.object({
  title: z.string().min(1),
  seedInterest: z.string().nullable(),
  adjacentField: z.string().nullable(),
});

export const RabbitHoleTreeDataSchema = z.object({
  nodeMap: z.record(z.string(), RabbitHoleNodeSchema),
  rootId: z.string().min(1),
  cursorId: z.string().min(1),
});

export const RabbitHoleScoringSchema = z.object({
  scoredDepthTier: z.number().int().min(0),
  scoredBranchIds: z.array(z.string()),
  scoredSynapsePairs: z.array(z.string()),
  badgesFired: z.array(z.string()),
  dailyMapCountKey: z.string(),
});

/** Parse + validate a persisted tree blob. Throws on malformed data so the
 * read layer can fall back rather than render a corrupt tree. */
export function parseTreeData(raw: unknown): RabbitHoleTreeData {
  return RabbitHoleTreeDataSchema.parse(raw);
}

// --- Lookup helper ----------------------------------------------------------

/** Build an O(1) lookup from the persisted record. Traversal helpers take a
 * `ReadonlyMap` so they never accidentally mutate the store's node map. */
export function asLookup(nodeMap: Readonly<Record<string, RabbitHoleNode>>): Map<string, RabbitHoleNode> {
  return new Map(Object.entries(nodeMap));
}

// --- Pure traversal helpers -------------------------------------------------

/** Root → node, inclusive. O(depth). */
export function pathToRoot(nodeId: string, m: ReadonlyMap<string, RabbitHoleNode>): RabbitHoleNode[] {
  const path: RabbitHoleNode[] = [];
  let cur = m.get(nodeId);
  while (cur) {
    path.unshift(cur);
    cur = cur.parentId != null ? m.get(cur.parentId) : undefined;
  }
  return path;
}

/** Depth = number of edges from the root (root is 0). */
export function depthOf(nodeId: string, m: ReadonlyMap<string, RabbitHoleNode>): number {
  return Math.max(0, pathToRoot(nodeId, m).length - 1);
}

/** Direct, realized children of a node (ghost forks excluded). */
export function childrenOf(nodeId: string, m: ReadonlyMap<string, RabbitHoleNode>): RabbitHoleNode[] {
  const n = m.get(nodeId);
  if (!n) return [];
  return n.forks
    .map((f) => f.childId)
    .filter((id): id is string => id != null)
    .map((id) => m.get(id))
    .filter((x): x is RabbitHoleNode => x != null);
}

/** Every descendant of a node (excluding the node itself). */
export function allDescendants(nodeId: string, m: ReadonlyMap<string, RabbitHoleNode>): RabbitHoleNode[] {
  const out: RabbitHoleNode[] = [];
  const queue = [nodeId];
  while (queue.length) {
    const kids = childrenOf(queue.shift()!, m);
    out.push(...kids);
    queue.push(...kids.map((k) => k.id));
  }
  return out;
}

/** Length of the longest pure-"deeper" chain starting at a node. */
export function maxDeeperDepth(nodeId: string, m: ReadonlyMap<string, RabbitHoleNode>): number {
  const n = m.get(nodeId);
  if (!n) return 0;
  const deeper = n.forks[0]; // index 0 is always 'deeper'
  return deeper.childId == null ? 0 : 1 + maxDeeperDepth(deeper.childId, m);
}

// --- Substance / breadth gates (Q2-resolved) --------------------------------

/** A persisted node has real substance — reuses the single-shot generator's
 * `isConcreteNode` guard so the "filler" bar never drifts between the two. */
export function isNodeSubstantive(node: RabbitHoleNode): boolean {
  const adapted: GeneratedNode = {
    title: node.title,
    body: node.body,
    goDeeperHint: node.forks[0].hint,
    goSidewaysHint: node.forks[1].hint,
  };
  return isConcreteNode(adapted);
}

/**
 * Q2-resolved: a sideways branch is "substantive" when its root child is
 * concrete AND the user continued from it (took at least one further fork).
 * Net rule from the decision round: "the cheapest qualifying branch is took a
 * sideways fork, then took any one fork from it." A lone sideways stub does not
 * qualify; spamming one-deep stubs can't farm breadth XP / cartographer.
 */
export function isSubstantiveBranch(sidewaysChildId: string, m: ReadonlyMap<string, RabbitHoleNode>): boolean {
  const child = m.get(sidewaysChildId);
  if (!child) return false;
  if (!isNodeSubstantive(child)) return false;
  return child.forks.some((f) => f.childId != null);
}

/**
 * The fork-node ids that count as "qualifying branches" for breadth XP / the
 * cartographer badge: nodes where BOTH forks are realized (the tree genuinely
 * forked there) AND the sideways branch is substantive. Returns ids (not just a
 * count) so the scorer can pay each branch exactly once, idempotently across
 * re-runs. Pure; the per-3 cap is applied by the scorer.
 */
export function qualifyingBranchNodeIds(rootId: string, m: ReadonlyMap<string, RabbitHoleNode>): string[] {
  const ids: string[] = [];
  const visit = (id: string): void => {
    const n = m.get(id);
    if (!n) return;
    const bothRealized = n.forks[0].childId != null && n.forks[1].childId != null;
    if (bothRealized && isSubstantiveBranch(n.forks[1].childId!, m)) ids.push(id);
    childrenOf(id, m).forEach((c) => visit(c.id));
  };
  visit(rootId);
  return ids;
}

/** How many qualifying branches the tree has (see qualifyingBranchNodeIds). */
export function realizedBranchCount(rootId: string, m: ReadonlyMap<string, RabbitHoleNode>): number {
  return qualifyingBranchNodeIds(rootId, m).length;
}

/**
 * Q5-resolved: depth tiers newly crossed since `prevScoredTier`. Returns the
 * tier depths (a subset of DEPTH_TIERS) to pay for now, given the longest
 * deeper-chain reached. Phase-2 scoring maps depths → XP (3 → +10, 5 → +20).
 */
export function newlyCrossedDepthTiers(prevScoredTier: number, maxDepth: number): number[] {
  return DEPTH_TIERS.filter((t) => t > prevScoredTier && maxDepth >= t);
}

// --- Pure node construction -------------------------------------------------

const ghostFork = (direction: RabbitHoleDirection, hint: string): RabbitHoleFork => ({
  direction,
  hint: hint.trim() || direction, // never empty (Zod requires >= 1)
  childId: null,
  state: 'ghost',
});

/**
 * Build a RabbitHoleNode from a freshly-generated GeneratedNode. The two forward
 * hints become the node's two ghost forks. Callers inject `id`/`createdAt` so
 * this stays pure (no nanoid / clock here).
 */
export function nodeFromGenerated(
  gen: GeneratedNode,
  opts: { id: string; parentId: string | null; arrivedVia: RabbitHoleDirection | null; createdAt: string },
): RabbitHoleNode {
  return {
    id: opts.id,
    parentId: opts.parentId,
    arrivedVia: opts.arrivedVia,
    title: gen.title,
    body: gen.body,
    forks: [ghostFork('deeper', gen.goDeeperHint), ghostFork('sideways', gen.goSidewaysHint)],
    createdAt: opts.createdAt,
    visitedAt: opts.createdAt, // a new node is the node you're standing on
  };
}

// --- Pure tree transforms (return new data; never mutate the input) ---------

/** A brand-new tree with a single root node; the cursor sits on the root. */
export function createTree(root: RabbitHoleNode): RabbitHoleTreeData {
  return { nodeMap: { [root.id]: root }, rootId: root.id, cursorId: root.id };
}

/**
 * Realize a fork: attach `child` under `parentId` in `direction`, flip that fork
 * from ghost → realized, and move the cursor onto the new child. Returns new
 * data. No-op (returns the input) if the parent is missing or the fork is
 * already realized — the append is idempotent-safe at the data layer.
 */
export function appendChild(
  data: RabbitHoleTreeData,
  parentId: string,
  direction: RabbitHoleDirection,
  child: RabbitHoleNode,
): RabbitHoleTreeData {
  const parent = data.nodeMap[parentId];
  if (!parent) return data;
  const forkIndex = direction === 'deeper' ? 0 : 1;
  if (parent.forks[forkIndex].childId != null) return data; // already taken
  const updatedForks: [RabbitHoleFork, RabbitHoleFork] = [
    { ...parent.forks[0] },
    { ...parent.forks[1] },
  ];
  updatedForks[forkIndex] = { ...updatedForks[forkIndex], childId: child.id, state: 'realized' };
  const updatedParent: RabbitHoleNode = { ...parent, forks: updatedForks };
  return {
    nodeMap: { ...data.nodeMap, [parentId]: updatedParent, [child.id]: child },
    rootId: data.rootId,
    cursorId: child.id,
  };
}

/** Move the cursor to any existing node (free navigation / jump-to). Optionally
 * stamp `visitedAt`. No-op if the node doesn't exist. */
export function moveCursor(data: RabbitHoleTreeData, nodeId: string, visitedAt?: string): RabbitHoleTreeData {
  const node = data.nodeMap[nodeId];
  if (!node) return data;
  const nodeMap = visitedAt
    ? { ...data.nodeMap, [nodeId]: { ...node, visitedAt } }
    : data.nodeMap;
  return { ...data, nodeMap, cursorId: nodeId };
}

/** "Back" = climb to the parent of the current cursor. The cursor stays put at
 * the root. THE TREE IS NEVER MUTATED — this is the core fix over the old
 * destructive `slice(0, -1)`. */
export function climbToParent(data: RabbitHoleTreeData, visitedAt?: string): RabbitHoleTreeData {
  const cursor = data.nodeMap[data.cursorId];
  const parentId = cursor?.parentId ?? null;
  if (parentId == null) return data;
  return moveCursor(data, parentId, visitedAt);
}

/** Whether the focused branch has hit the per-branch depth cap. */
export function isAtDepthCap(data: RabbitHoleTreeData): boolean {
  return depthOf(data.cursorId, asLookup(data.nodeMap)) >= RABBIT_HOLE_MAX_DEPTH;
}
