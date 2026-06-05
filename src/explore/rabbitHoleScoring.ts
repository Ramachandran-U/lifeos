/**
 * Rabbit-hole shape scoring (Explore v3, Phase 2). PURE XP computation over a
 * tree + its idempotency ledger — no stores, no clock, no side effects, so it
 * is exhaustively unit-testable. The orchestration that reads/writes stores and
 * calls addXP lives in rabbitHoleActions.ts.
 *
 * Design principle (see docs/rabbit-hole-tree-map-redesign.md): reward the
 * RESIDUE of genuine curiosity, never the act of tapping. Each shape-milestone
 * pays once via the `scoring` ledger; re-running on the same tree yields 0.
 *
 *   - Depth   (Q5): two tiers — a deeper-chain of 3 pays once, 5 pays once.
 *   - Breadth (Q2): each qualifying branch pays once, capped at 3/tree.
 *   - Synapse:      each true cross-category pair pays once, capped at 2/tree,
 *                   AND de-duped ever-once across all of the user's maps.
 *
 * Badges are NOT fired here (that is Phase 4). The Q3 daily-diminishing gate is
 * applied by the caller passing `fullScoring=false` for a user's 3rd+ tree of
 * the day, which zeroes breadth + synapse (depth still pays).
 */
import { XP_VALUES, type BadgeId } from '@/utils/gamification';
import {
  asLookup,
  maxDeeperDepth,
  newlyCrossedDepthTiers,
  qualifyingBranchNodeIds,
  realizedBranchCount,
  DEPTH_TIERS,
  REWARD_GATES,
  type RabbitHoleNode,
  type RabbitHoleScoring,
  type RabbitHoleTreeData,
} from './rabbitHoleTree';

/** XP paid the first time a deeper-chain reaches each tier. Tier 5 == one
 * expedition step; tier 3 is a deliberately small early "depth is scored" teach. */
const DEPTH_TIER_XP: Readonly<Record<number, number>> = {
  3: 10,
  5: XP_VALUES.expeditionStepComplete, // 20
};

export interface TreeScoringInput {
  treeData: RabbitHoleTreeData;
  scoring: RabbitHoleScoring;
  /** Q3: false for the user's 3rd+ tree today — zeroes breadth + synapse. */
  fullScoring: boolean;
  /** Cross-category synapse pairs detected in THIS tree ("catA|catB", sorted).
   * Phase 3 (isCrossCategory) supplies these; empty until then. */
  synapsePairsInTree: readonly string[];
  /** Synapse pairs the user has already been paid for across ALL other maps. */
  everScoredSynapsePairs: ReadonlySet<string>;
}

export interface TreeScoringResult {
  xpAwarded: number;
  newScoring: RabbitHoleScoring;
}

/**
 * Synapse XP for a set of candidate cross-category pairs, idempotent within the
 * tree (`scoring.scoredSynapsePairs`) and de-duped ever-once across maps
 * (`everScoredSynapsePairs`), capped at REWARD_GATES.maxSynapsesPerTree.
 */
export function computeSynapseXp(
  candidatePairs: readonly string[],
  scoring: RabbitHoleScoring,
  everScoredSynapsePairs: ReadonlySet<string>,
): { xp: number; newlyScoredPairs: string[] } {
  const already = new Set(scoring.scoredSynapsePairs);
  const remainingCap = REWARD_GATES.maxSynapsesPerTree - scoring.scoredSynapsePairs.length;
  if (remainingCap <= 0) return { xp: 0, newlyScoredPairs: [] };

  const fresh: string[] = [];
  for (const pair of candidatePairs) {
    if (fresh.length >= remainingCap) break;
    if (already.has(pair) || everScoredSynapsePairs.has(pair) || fresh.includes(pair)) continue;
    fresh.push(pair);
  }
  return { xp: fresh.length * XP_VALUES.synapseFormed, newlyScoredPairs: fresh };
}

/** Compute the XP newly earned by the tree's current shape + the updated ledger. */
export function computeTreeScoring(input: TreeScoringInput): TreeScoringResult {
  const { treeData, scoring, fullScoring, synapsePairsInTree, everScoredSynapsePairs } = input;
  const m = asLookup(treeData.nodeMap);

  // --- Depth (always scored, even on a depth-only tree) ---
  const reached = maxDeeperDepth(treeData.rootId, m);
  const crossed = newlyCrossedDepthTiers(scoring.scoredDepthTier, reached);
  const depthXp = crossed.reduce((sum, tier) => sum + (DEPTH_TIER_XP[tier] ?? 0), 0);
  const scoredDepthTier = crossed.length ? Math.max(scoring.scoredDepthTier, ...crossed) : scoring.scoredDepthTier;

  // --- Breadth + Synapse (only on full-scoring trees; Q3 daily gate) ---
  let breadthXp = 0;
  let scoredBranchIds = scoring.scoredBranchIds;
  let synapseXp = 0;
  let scoredSynapsePairs = scoring.scoredSynapsePairs;

  if (fullScoring) {
    const paid = new Set(scoring.scoredBranchIds);
    const breadthCap = REWARD_GATES.maxBreadthBranches - scoring.scoredBranchIds.length;
    const freshBranches = breadthCap > 0
      ? qualifyingBranchNodeIds(treeData.rootId, m).filter((id) => !paid.has(id)).slice(0, breadthCap)
      : [];
    breadthXp = freshBranches.length * XP_VALUES.completeGoalTask; // 15 each
    scoredBranchIds = freshBranches.length ? [...scoring.scoredBranchIds, ...freshBranches] : scoring.scoredBranchIds;

    const syn = computeSynapseXp(synapsePairsInTree, scoring, everScoredSynapsePairs);
    synapseXp = syn.xp;
    scoredSynapsePairs = syn.newlyScoredPairs.length
      ? [...scoring.scoredSynapsePairs, ...syn.newlyScoredPairs]
      : scoring.scoredSynapsePairs;
  }

  return {
    xpAwarded: depthXp + breadthXp + synapseXp,
    newScoring: { ...scoring, scoredDepthTier, scoredBranchIds, scoredSynapsePairs },
  };
}

/** The deeper-chain length that earns the Deep Diver badge (top depth tier). */
const DEEP_DIVER_DEPTH = DEPTH_TIERS[DEPTH_TIERS.length - 1];

/** A node is a "returned fork" iff BOTH its forks are realized — reachable only
 * by coming back to a fork you'd left and taking the other path. */
const isReturnedFork = (n: RabbitHoleNode): boolean => n.forks[0].childId != null && n.forks[1].childId != null;

/**
 * PURE: the shape badges newly earned by the tree, excluding any already in the
 * tree's `badgesFired` ledger. XP is unaffected (badges grant none here — they
 * flow through the existing awardBadge path). `synapsePairsInTree` is supplied
 * by the caller (Phase-3 detection), so this stays store-free and testable.
 *
 * `connector` co-emits `synapse_formed`: the rabbit-hole synapse IS a
 * cross-discipline link, and the constellation feed records it — so the pair
 * toasts together (the AchievementToast queue handles the sequencing).
 * `archivist` is cross-tree and handled by the orchestrator, not here.
 */
export function computeTreeBadges(
  treeData: RabbitHoleTreeData,
  scoring: RabbitHoleScoring,
  synapsePairsInTree: readonly string[],
): BadgeId[] {
  const fired = new Set(scoring.badgesFired);
  const m = asLookup(treeData.nodeMap);
  const out: BadgeId[] = [];
  const add = (b: BadgeId) => {
    if (!fired.has(b) && !out.includes(b)) out.push(b);
  };

  if (maxDeeperDepth(treeData.rootId, m) >= DEEP_DIVER_DEPTH) add('deep_diver');
  if (realizedBranchCount(treeData.rootId, m) >= REWARD_GATES.maxBreadthBranches) add('cartographer');
  if ([...m.values()].some(isReturnedFork)) add('road_not_taken');
  if (synapsePairsInTree.length > 0) {
    add('connector');
    add('synapse_formed');
  }
  return out;
}
