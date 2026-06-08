/**
 * Rabbit-hole orchestration (Explore v3, Phase 2). Ties the AI node generators,
 * the in-memory store, persistence, and shape-scoring together. The store stays
 * side-effect-free; all I/O (DB, AI, XP) lives here.
 *
 * Contract highlights (see docs/rabbit-hole-tree-map-redesign.md):
 *   - The GeneratedNode AI contract is UNCHANGED — we reuse generateRabbitHoleNode
 *     / exploreThreadNode exactly. Both are mock-first and never dead-end.
 *   - Taking a GHOST fork costs one AI call; re-taking a REALIZED fork is a free
 *     cursor jump (no AI, no scoring).
 *   - XP is scored by SHAPE (scoreTreeShape), never per advance/tap.
 *   - Trees are LOCAL ONLY — persistence does not route through the sync log.
 */
import { nanoid } from '@/utils/id';
import { isEnabled } from '@/config/flags';
import { useFlagStore } from '@/store/useFlagStore';
import { useUserStore } from '@/store/useUserStore';
import { useGameStore } from '@/store/useGameStore';
import { useRabbitHoleStore } from '@/store/useRabbitHoleStore';
import {
  generateRabbitHoleNode,
  type GeneratedNode,
  type RabbitHoleInput,
  type RabbitHoleDirection,
} from '@/explore/rabbitHole';
import { exploreThreadNode } from '@/ai/agent/exploreThread';
import {
  nodeFromGenerated,
  createTree,
  depthOf,
  maxDeeperDepth,
  asLookup,
  parseTreeData,
  RABBIT_HOLE_MAX_DEPTH,
  REWARD_GATES,
  RabbitHoleAnchorSchema,
  RabbitHoleScoringSchema,
  type RabbitHoleAnchor,
  type RabbitHoleNode,
  type RabbitHoleScoring,
} from '@/explore/rabbitHoleTree';
import { computeTreeScoring, computeTreeBadges } from '@/explore/rabbitHoleScoring';
import { detectSynapsePairs, emitThreadToConstellation } from '@/explore/rabbitHoleConstellation';
import type { CategorizedInterest } from '@/explore/isCrossCategory';
import {
  getRabbitHoleTree,
  getRabbitHoleTreeBySpark,
  upsertRabbitHoleTree,
  listRabbitHoleTrees,
  type RabbitHoleTreeRow,
} from '@/db/queries/rabbitHoleTrees';
import { getInterestsByUser } from '@/db/queries/interests';
import { updateSparkStatus } from '@/db/queries/sparks';

/** Seed that anchors a tree — the daily spark (or an inline "chasing now" thread). */
export interface RabbitHoleSeed {
  sparkId: string;
  title: string;
  body: string;
  threadStarter: string;
  seedInterest: string;
  adjacentField: string;
}

const now = (): string => new Date().toISOString();

function buildGenParams(parent: { title: string; body: string }, anchor: RabbitHoleAnchor, direction: RabbitHoleDirection): RabbitHoleInput {
  return {
    parent: { title: parent.title, body: parent.body },
    anchor: {
      title: anchor.title,
      seedInterest: anchor.seedInterest ?? undefined,
      adjacentField: anchor.adjacentField ?? undefined,
    },
    direction,
  };
}

/** Generate the next node via the existing (unchanged) AI path — agentic when
 * the flag is on and we have a user, else single-shot. Both never dead-end. */
function generateNode(parent: { title: string; body: string }, anchor: RabbitHoleAnchor, direction: RabbitHoleDirection, userId: string | null): Promise<GeneratedNode> {
  const params = buildGenParams(parent, anchor, direction);
  return useFlagStore.getState().isEnabled('explore_agentic_thread') && userId
    ? exploreThreadNode({ ...params, userId })
    : generateRabbitHoleNode(params);
}

/** Serialize the active store tree to a row and upsert it (local only). */
function persistActiveTree(): void {
  const s = useRabbitHoleStore.getState();
  if (!s.treeId || !s.rootId || !s.cursorId || !s.anchor || !s.scoring || !s.sparkId) return;
  const userId = useUserStore.getState().userId;
  if (!userId) return;
  const existing = getRabbitHoleTree(s.treeId);
  const row: RabbitHoleTreeRow = {
    id: s.treeId,
    userId,
    sparkId: s.sparkId,
    anchorJson: JSON.stringify(s.anchor),
    treeJson: JSON.stringify({ nodeMap: s.nodeMap, rootId: s.rootId, cursorId: s.cursorId }),
    scoringJson: JSON.stringify(s.scoring),
    title: s.title,
    xpAwarded: s.xpAwarded,
    createdAt: existing?.createdAt ?? now(),
    updatedAt: now(),
    deletedAt: null,
  };
  upsertRabbitHoleTree(row);
}

function hydrateFromRow(row: RabbitHoleTreeRow): boolean {
  try {
    const anchor = RabbitHoleAnchorSchema.parse(JSON.parse(row.anchorJson));
    const treeData = parseTreeData(JSON.parse(row.treeJson));
    const scoring = RabbitHoleScoringSchema.parse(JSON.parse(row.scoringJson));
    useRabbitHoleStore.getState().hydrate({
      treeId: row.id,
      sparkId: row.sparkId,
      anchor,
      treeData,
      scoring,
      xpAwarded: row.xpAwarded,
      title: row.title,
    });
    return true;
  } catch {
    return false; // corrupt row → caller creates a fresh tree
  }
}

/**
 * Resume an existing rabbit-hole tree by its DB id.
 * Returns true if the row was found and hydrated; false if the id is unknown or
 * the row is corrupt.
 */
export function loadThreadById(treeId: string): boolean {
  const row = getRabbitHoleTree(treeId);
  if (!row) return false;
  return hydrateFromRow(row);
}

/**
 * Open the rabbit hole for a spark: resume the existing tree if one exists, else
 * create a fresh tree whose root is the spark itself. Returns the tree id and
 * leaves it loaded in the store.
 */
export function loadOrCreateThread(seed: RabbitHoleSeed): string {
  const existing = getRabbitHoleTreeBySpark(seed.sparkId);
  if (existing && hydrateFromRow(existing)) return existing.id;

  const createdAt = now();
  const treeId = nanoid();
  const anchor: RabbitHoleAnchor = {
    title: seed.title,
    seedInterest: seed.seedInterest || null,
    adjacentField: seed.adjacentField || null,
  };
  // The root node IS the spark — its two forks come from the spark's hints.
  // Guard the body to >= 20 chars (the RabbitHoleNode Zod contract) so a terse
  // inline seed (e.g. a frontier insight) can't make the tree fail to re-hydrate.
  const rootGen: GeneratedNode = {
    title: seed.title,
    body: seed.body && seed.body.trim().length >= 20 ? seed.body : `A thread worth pulling on: ${seed.title}.`,
    goDeeperHint: seed.threadStarter,
    goSidewaysHint: seed.adjacentField ? `connect to ${seed.adjacentField}` : 'an adjacent field',
  };
  const root = nodeFromGenerated(rootGen, { id: nanoid(), parentId: null, arrivedVia: null, createdAt });
  const scoring: RabbitHoleScoring = {
    scoredDepthTier: 0,
    scoredBranchIds: [],
    scoredSynapsePairs: [],
    badgesFired: [],
    dailyMapCountKey: createdAt.slice(0, 10),
  };
  useRabbitHoleStore.getState().hydrate({
    treeId,
    sparkId: seed.sparkId,
    anchor,
    treeData: createTree(root),
    scoring,
    xpAwarded: 0,
    title: null,
  });
  persistActiveTree();
  // Link the spark to this tree (status already 'explored' from the entry point).
  updateSparkStatus(seed.sparkId, 'explored', treeId);
  return treeId;
}

/**
 * Take a fork from the current cursor. Ghost fork → generate + append + score.
 * Realized fork → free cursor jump (no AI, no scoring). No-op at the per-branch
 * depth cap. NEVER awards XP directly — that is scoreTreeShape's job.
 */
export async function advanceRabbitHole(direction: RabbitHoleDirection): Promise<void> {
  const store = useRabbitHoleStore.getState();
  const { rootId, cursorId, nodeMap, anchor } = store;
  if (!rootId || !cursorId || !anchor) return;
  const parent = nodeMap[cursorId];
  if (!parent) return;

  const forkIndex = direction === 'deeper' ? 0 : 1;
  const existingChildId = parent.forks[forkIndex].childId;
  if (existingChildId != null) {
    store.jumpTo(existingChildId); // free re-take of an explored fork
    persistActiveTree();
    return;
  }

  if (depthOf(cursorId, asLookup(nodeMap)) >= RABBIT_HOLE_MAX_DEPTH) return;

  store.setAdvancing(true);
  try {
    const userId = useUserStore.getState().userId;
    const cached = store.takePrefetch(cursorId, direction);
    const gen = cached ?? (await generateNode(parent, anchor, direction, userId));
    const child = nodeFromGenerated(gen, {
      id: nanoid(),
      parentId: cursorId,
      arrivedVia: direction,
      createdAt: now(),
    });
    useRabbitHoleStore.getState().applyAppendChild(cursorId, direction, child);
    persistActiveTree();
    // NO addXP here — XP is scored by SHAPE in scoreTreeShape, never per advance.
    scoreTreeShape();
  } finally {
    useRabbitHoleStore.getState().setAdvancing(false);
  }
}

/** Trees the user created today, oldest first — drives the Q3 daily gate. */
export function isFullScoringTree(userId: string, treeId: string, today: string): boolean {
  const todays = listRabbitHoleTrees(userId)
    .filter((r) => r.createdAt.slice(0, 10) === today)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const rank = todays.findIndex((r) => r.id === treeId);
  if (rank === -1) return true; // not yet persisted — be generous
  return rank < REWARD_GATES.dailyFullScoringTrees;
}

/** Synapse pairs already paid across the user's OTHER maps (ever-once de-dupe). */
export function everScoredSynapsePairs(userId: string, excludeTreeId: string): Set<string> {
  const out = new Set<string>();
  for (const row of listRabbitHoleTrees(userId)) {
    if (row.id === excludeTreeId) continue;
    try {
      RabbitHoleScoringSchema.parse(JSON.parse(row.scoringJson)).scoredSynapsePairs.forEach((p) => out.add(p));
    } catch {
      /* skip corrupt rows */
    }
  }
  return out;
}

/** The user's interests as category lookups (guarded — a read failure must not break scoring). */
function readInterests(userId: string): CategorizedInterest[] {
  try {
    return getInterestsByUser(userId).map((i) => ({ name: i.name, category: i.category }));
  } catch {
    return [];
  }
}

/**
 * Score the active tree's current shape, awarding only newly-earned milestones
 * (idempotent via the scoring ledger). XP only — badges are fired in Phase 4.
 * `userId` comes from the SESSION (useUserStore), never the tree/spark. Also
 * feeds the constellation (best-effort).
 */
export function scoreTreeShape(): void {
  const store = useRabbitHoleStore.getState();
  const { treeId, rootId, cursorId, nodeMap, scoring, anchor } = store;
  if (!treeId || !rootId || !cursorId || !scoring || !anchor) return;
  const userId = useUserStore.getState().userId;
  if (!userId) return;

  const treeData = { nodeMap, rootId, cursorId };
  const interests = readInterests(userId);
  const synapsePairsInTree = detectSynapsePairs(treeData, anchor, interests);

  const result = computeTreeScoring({
    treeData,
    scoring,
    fullScoring: isFullScoringTree(userId, treeId, now().slice(0, 10)),
    synapsePairsInTree,
    everScoredSynapsePairs: everScoredSynapsePairs(userId, treeId),
  });

  // Shape badges newly earned by THIS tree — recorded in badgesFired so they
  // are evaluated once (awardBadge is also globally idempotent).
  const treeBadges = computeTreeBadges(treeData, scoring, synapsePairsInTree);
  const newScoring = treeBadges.length
    ? { ...result.newScoring, badgesFired: [...result.newScoring.badgesFired, ...treeBadges] }
    : result.newScoring;

  const game = useGameStore.getState();
  if (result.xpAwarded > 0) {
    game.addXP(userId, result.xpAwarded);
    game.triggerStreak(userId, 'learning'); // a real shape-milestone ticks the learning streak
  }
  store.setScoring(newScoring, store.xpAwarded + result.xpAwarded);
  persistActiveTree();

  // Award badges through the existing flow (AchievementToast queues, so
  // connector → synapse_formed toast in sequence). Award AFTER persist so the
  // cross-tree archivist scan below sees this tree's latest state.
  for (const b of treeBadges) game.awardBadge(userId, b);
  if (!useGameStore.getState().badges.includes('archivist') && qualifiesForArchivist(userId)) {
    game.awardBadge(userId, 'archivist');
  }

  // Feed the constellation (led_to / synapse). Observer-only — never blocks scoring.
  try {
    emitThreadToConstellation({ userId, treeData, anchor, interests, sourceTreeId: treeId, now: now() });
  } catch {
    /* constellation feed failures must not affect scoring/persistence */
  }
}

/** Name (or clear the name of) the active tree and persist it. Naming is an
 * optional identity flourish — it pays no XP. */
export function renameActiveThread(title: string | null): void {
  useRabbitHoleStore.getState().setTitle(title);
  persistActiveTree();
}

/** Depth + synapse count for a stored tree (used by the archivist gate). */
function treeStats(row: RabbitHoleTreeRow): { depth: number; synapses: number } {
  try {
    const td = parseTreeData(JSON.parse(row.treeJson));
    const synapses = RabbitHoleScoringSchema.parse(JSON.parse(row.scoringJson)).scoredSynapsePairs.length;
    return { depth: maxDeeperDepth(td.rootId, asLookup(td.nodeMap)), synapses };
  } catch {
    return { depth: 0, synapses: 0 };
  }
}

/**
 * Q4-resolved Archivist gate: the user has 5 trees with (depth >= 3 OR >= 1
 * synapse), AND >= 2 of those are genuinely deep (depth >= 5 OR a true
 * cross-category synapse). Once-ever; awardBadge dedupes globally.
 */
export function qualifiesForArchivist(userId: string): boolean {
  const stats = listRabbitHoleTrees(userId).map(treeStats);
  const qualifying = stats.filter((s) => s.depth >= 3 || s.synapses >= 1);
  const deep = qualifying.filter((s) => s.depth >= 5 || s.synapses >= 1);
  return qualifying.length >= 5 && deep.length >= 2;
}

/**
 * Best-effort prefetch of the un-taken fork(s) so taking one later is instant.
 * Gated OFF by default (exploreAgenticPrefetch) until cost-ledger data justifies
 * the spend. Prefetched nodes live in the store cache and are NOT in the tree,
 * so they never affect scoring until actually taken.
 */
export async function prefetchOtherFork(): Promise<void> {
  if (!isEnabled('exploreAgenticPrefetch')) return;
  const store = useRabbitHoleStore.getState();
  const { cursorId, nodeMap, anchor } = store;
  if (!cursorId || !anchor) return;
  const node = nodeMap[cursorId];
  if (!node) return;
  const userId = useUserStore.getState().userId;
  for (const fork of node.forks) {
    if (fork.childId != null) continue; // already realized
    if (store.prefetchCache[`${cursorId}:${fork.direction}`]) continue; // already cached
    try {
      const gen = await generateNode(node, anchor, fork.direction, userId);
      useRabbitHoleStore.getState().setPrefetch(cursorId, fork.direction, gen);
    } catch {
      /* best-effort: a miss just means we generate on tap */
    }
  }
}
