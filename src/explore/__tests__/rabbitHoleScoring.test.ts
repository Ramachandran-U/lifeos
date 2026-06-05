import { computeTreeScoring, computeSynapseXp, computeTreeBadges } from '../rabbitHoleScoring';
import {
  createTree,
  appendChild,
  nodeFromGenerated,
  type RabbitHoleDirection,
  type RabbitHoleNode,
  type RabbitHoleScoring,
  type RabbitHoleTreeData,
} from '../rabbitHoleTree';
import type { GeneratedNode } from '../rabbitHole';

const TS = '2026-06-05T10:00:00.000Z';

function gen(): GeneratedNode {
  return {
    title: 'The mechanism beneath flocking',
    body: 'Under every visible move in a flock there is a smaller universal rule doing the work, and naming it lets you transfer it elsewhere.',
    goDeeperHint: 'the underlying invariant',
    goSidewaysHint: 'where else this shows up',
  };
}
const n = (id: string, parentId: string | null, via: RabbitHoleDirection | null): RabbitHoleNode =>
  nodeFromGenerated(gen(), { id, parentId, arrivedVia: via, createdAt: TS });

function scoring(over: Partial<RabbitHoleScoring> = {}): RabbitHoleScoring {
  return { scoredDepthTier: 0, scoredBranchIds: [], scoredSynapsePairs: [], badgesFired: [], dailyMapCountKey: '2026-06-05', ...over };
}

/** A pure deeper chain of the given length (no sideways forks → no breadth). */
function deeperChain(len: number): RabbitHoleTreeData {
  let t = createTree(n('root', null, null));
  let pid = 'root';
  for (let i = 1; i <= len; i++) {
    t = appendChild(t, pid, 'deeper', n(`d${i}`, pid, 'deeper'));
    pid = `d${i}`;
  }
  return t;
}

/** Attach a substantive sideways branch (sideways child + a deeper grandchild) to `parentId`. */
function addBranch(t: RabbitHoleTreeData, parentId: string, tag: string): RabbitHoleTreeData {
  let next = appendChild(t, parentId, 'sideways', n(`${tag}s`, parentId, 'sideways'));
  next = appendChild(next, `${tag}s`, 'deeper', n(`${tag}sa`, `${tag}s`, 'deeper'));
  return next;
}

describe('computeTreeScoring — depth (Q5)', () => {
  it('pays tier 3 (+10) the first time a deeper-chain reaches depth 3', () => {
    const r = computeTreeScoring({ treeData: deeperChain(3), scoring: scoring(), fullScoring: true, synapsePairsInTree: [], everScoredSynapsePairs: new Set() });
    expect(r.xpAwarded).toBe(10);
    expect(r.newScoring.scoredDepthTier).toBe(3);
  });

  it('pays both tiers (+30) when a fresh tree reaches depth 5', () => {
    const r = computeTreeScoring({ treeData: deeperChain(5), scoring: scoring(), fullScoring: true, synapsePairsInTree: [], everScoredSynapsePairs: new Set() });
    expect(r.xpAwarded).toBe(30);
    expect(r.newScoring.scoredDepthTier).toBe(5);
  });

  it('pays only the newly-crossed tier when tier 3 was already banked', () => {
    const r = computeTreeScoring({ treeData: deeperChain(5), scoring: scoring({ scoredDepthTier: 3 }), fullScoring: true, synapsePairsInTree: [], everScoredSynapsePairs: new Set() });
    expect(r.xpAwarded).toBe(20);
    expect(r.newScoring.scoredDepthTier).toBe(5);
  });

  it('is idempotent — re-running with the banked ledger pays 0', () => {
    const tree = deeperChain(5);
    const first = computeTreeScoring({ treeData: tree, scoring: scoring(), fullScoring: true, synapsePairsInTree: [], everScoredSynapsePairs: new Set() });
    const second = computeTreeScoring({ treeData: tree, scoring: first.newScoring, fullScoring: true, synapsePairsInTree: [], everScoredSynapsePairs: new Set() });
    expect(second.xpAwarded).toBe(0);
  });
});

describe('computeTreeScoring — breadth (Q2)', () => {
  // Pre-bank depth tier 5 so depth never contributes — isolates breadth.
  const depthDone = scoring({ scoredDepthTier: 5 });

  it('pays +15 per qualifying branch', () => {
    let t = createTree(n('root', null, null));
    t = appendChild(t, 'root', 'deeper', n('d1', 'root', 'deeper')); // root.deeper realized
    t = addBranch(t, 'root', 'b'); // root.sideways realized + continued → root qualifies
    const r = computeTreeScoring({ treeData: t, scoring: depthDone, fullScoring: true, synapsePairsInTree: [], everScoredSynapsePairs: new Set() });
    expect(r.xpAwarded).toBe(15);
    expect(r.newScoring.scoredBranchIds).toEqual(['root']);
  });

  it('caps at 3 qualifying branches per tree', () => {
    // root, d1, d2 each fork deeper (spine) AND sideways (substantive) → 4 qualifying nodes
    let t = createTree(n('root', null, null));
    t = appendChild(t, 'root', 'deeper', n('d1', 'root', 'deeper'));
    t = appendChild(t, 'd1', 'deeper', n('d2', 'd1', 'deeper'));
    t = appendChild(t, 'd2', 'deeper', n('d3', 'd2', 'deeper'));
    t = addBranch(t, 'root', 'r');
    t = addBranch(t, 'd1', 'a');
    t = addBranch(t, 'd2', 'b');
    t = addBranch(t, 'd3', 'c');
    const r = computeTreeScoring({ treeData: t, scoring: depthDone, fullScoring: true, synapsePairsInTree: [], everScoredSynapsePairs: new Set() });
    expect(r.xpAwarded).toBe(45); // 3 × 15, 4th branch not paid
    expect(r.newScoring.scoredBranchIds).toHaveLength(3);
  });

  it('does not re-pay an already-scored branch', () => {
    let t = createTree(n('root', null, null));
    t = appendChild(t, 'root', 'deeper', n('d1', 'root', 'deeper'));
    t = addBranch(t, 'root', 'b');
    const first = computeTreeScoring({ treeData: t, scoring: depthDone, fullScoring: true, synapsePairsInTree: [], everScoredSynapsePairs: new Set() });
    const second = computeTreeScoring({ treeData: t, scoring: first.newScoring, fullScoring: true, synapsePairsInTree: [], everScoredSynapsePairs: new Set() });
    expect(second.xpAwarded).toBe(0);
  });
});

describe('computeTreeScoring — Q3 daily gate', () => {
  it('fullScoring=false zeroes breadth but depth still pays', () => {
    let t = deeperChain(3); // depth 3 → +10; root.deeper already realized by the chain
    t = addBranch(t, 'root', 'b'); // root.sideways realized + continued → root qualifies for breadth
    const r = computeTreeScoring({ treeData: t, scoring: scoring(), fullScoring: false, synapsePairsInTree: ['biology|geometry'], everScoredSynapsePairs: new Set() });
    expect(r.xpAwarded).toBe(10); // depth only; breadth + synapse zeroed
    expect(r.newScoring.scoredBranchIds).toEqual([]);
    expect(r.newScoring.scoredSynapsePairs).toEqual([]);
  });
});

describe('computeSynapseXp', () => {
  it('pays +50 per fresh cross-category pair', () => {
    const r = computeSynapseXp(['biology|geometry'], scoring(), new Set());
    expect(r.xp).toBe(50);
    expect(r.newlyScoredPairs).toEqual(['biology|geometry']);
  });

  it('caps at 2 pairs per tree', () => {
    const r = computeSynapseXp(['a|b', 'c|d', 'e|f'], scoring(), new Set());
    expect(r.xp).toBe(100);
    expect(r.newlyScoredPairs).toEqual(['a|b', 'c|d']);
  });

  it('skips pairs already scored in this tree', () => {
    const r = computeSynapseXp(['a|b', 'c|d'], scoring({ scoredSynapsePairs: ['a|b'] }), new Set());
    expect(r.xp).toBe(50);
    expect(r.newlyScoredPairs).toEqual(['c|d']);
  });

  it('skips pairs already paid on another map (ever-once de-dupe)', () => {
    const r = computeSynapseXp(['a|b', 'c|d'], scoring(), new Set(['a|b']));
    expect(r.xp).toBe(50);
    expect(r.newlyScoredPairs).toEqual(['c|d']);
  });

  it('de-dupes a pair repeated within the same candidate list', () => {
    const r = computeSynapseXp(['a|b', 'a|b'], scoring(), new Set());
    expect(r.newlyScoredPairs).toEqual(['a|b']);
  });
});

describe('computeTreeBadges (Phase 4)', () => {
  it('awards deep_diver at a deeper-chain of 5 (and nothing else on a plain chain)', () => {
    expect(computeTreeBadges(deeperChain(5), scoring(), [])).toEqual(['deep_diver']);
    expect(computeTreeBadges(deeperChain(4), scoring(), [])).toEqual([]); // not deep enough, no fork
  });

  it('awards cartographer + road_not_taken when 3 branches are mapped', () => {
    let t = createTree(n('root', null, null));
    t = appendChild(t, 'root', 'deeper', n('d1', 'root', 'deeper'));
    t = appendChild(t, 'd1', 'deeper', n('d2', 'd1', 'deeper'));
    t = appendChild(t, 'd2', 'deeper', n('d3', 'd2', 'deeper'));
    t = addBranch(t, 'root', 'r');
    t = addBranch(t, 'd1', 'a');
    t = addBranch(t, 'd2', 'b');
    const badges = computeTreeBadges(t, scoring(), []);
    expect(badges).toContain('cartographer');
    expect(badges).toContain('road_not_taken'); // forking both ways means you returned
    expect(badges).not.toContain('deep_diver'); // deeper chain is only 3
  });

  it('co-emits connector + synapse_formed when a cross-category pair is present', () => {
    expect(computeTreeBadges(deeperChain(1), scoring(), ['math|science'])).toEqual(['connector', 'synapse_formed']);
  });

  it('does not re-fire badges already in the ledger', () => {
    expect(computeTreeBadges(deeperChain(5), scoring({ badgesFired: ['deep_diver'] }), [])).toEqual([]);
  });
});
