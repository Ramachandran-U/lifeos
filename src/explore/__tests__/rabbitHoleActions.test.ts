/**
 * Phase-2 action integration. The trees query layer is mocked with an in-memory
 * store; the game store's award methods are replaced with spies; AI runs in mock
 * mode (offline). Each test uses a unique userId so the mocked rows never leak
 * across tests.
 */
jest.mock('@/db/queries/rabbitHoleTrees', () => {
  let rows: Array<Record<string, unknown>> = [];
  return {
    upsertRabbitHoleTree: (row: Record<string, unknown>) => {
      const i = rows.findIndex((r) => r.id === row.id);
      if (i === -1) rows.push(row);
      else rows[i] = row;
    },
    getRabbitHoleTree: (id: string) => rows.find((r) => r.id === id && !r.deletedAt),
    getRabbitHoleTreeBySpark: (sparkId: string) => rows.find((r) => r.sparkId === sparkId && !r.deletedAt),
    listRabbitHoleTrees: (userId: string) =>
      rows.filter((r) => r.userId === userId && !r.deletedAt).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    countRabbitHoleTreesToday: () => 0,
    softDeleteRabbitHoleTree: () => {},
  };
});

jest.mock('@/db/queries/sparks', () => ({ updateSparkStatus: jest.fn() }));
jest.mock('@/db/queries/interests', () => ({ getInterestsByUser: () => [] }));
jest.mock('@/db/queries/constellationEdges', () => ({ upsertConstellationEdge: jest.fn(), listConstellationEdges: () => [] }));

import { loadOrCreateThread, advanceRabbitHole, qualifiesForArchivist } from '../rabbitHoleActions';
import { useRabbitHoleStore } from '@/store/useRabbitHoleStore';
import { useGameStore } from '@/store/useGameStore';
import { useUserStore } from '@/store/useUserStore';
import { getRabbitHoleTree, upsertRabbitHoleTree, type RabbitHoleTreeRow } from '@/db/queries/rabbitHoleTrees';
import { updateSparkStatus } from '@/db/queries/sparks';
import { createTree, appendChild, nodeFromGenerated, type RabbitHoleDirection, type RabbitHoleNode } from '@/explore/rabbitHoleTree';
import type { GeneratedNode } from '@/explore/rabbitHole';

const addXP = jest.fn();
const triggerStreak = jest.fn();
const awardBadge = jest.fn();
let seq = 0;
let sparkId = 'spark1'; // unique per test — getRabbitHoleTreeBySpark keys on this, so reuse would leak

function seed() {
  return {
    sparkId,
    title: 'Why do murmurations stay together?',
    body: 'Thousands of starlings wheel as one with no leader — local rules produce the global shape we see.',
    threadStarter: 'What are the local rules?',
    seedInterest: 'biology',
    adjacentField: 'geometry',
  };
}

beforeEach(() => {
  process.env.USE_AI_MOCK = 'true';
  useRabbitHoleStore.getState().resetTree();
  addXP.mockReset();
  triggerStreak.mockReset();
  awardBadge.mockReset();
  (updateSparkStatus as jest.Mock).mockReset();
  useGameStore.setState({ addXP, triggerStreak, awardBadge, badges: [] });
  seq += 1;
  sparkId = `spark-${seq}`;
  useUserStore.setState({ userId: `user-${seq}` });
});

const concrete = (): GeneratedNode => ({
  title: 'A concept node',
  body: 'A concrete, substantive node body that clears the twenty-character minimum easily.',
  goDeeperHint: 'deeper',
  goSidewaysHint: 'sideways',
});
const rhNode = (id: string, parentId: string | null, via: RabbitHoleDirection | null): RabbitHoleNode =>
  nodeFromGenerated(concrete(), { id, parentId, arrivedVia: via, createdAt: '2026-06-05T10:00:00.000Z' });

/** A persisted tree row of a given deeper-depth (no synapses) for archivist seeding. */
function treeRow(id: string, userId: string, depth: number): RabbitHoleTreeRow {
  let t = createTree(rhNode('root', null, null));
  let pid = 'root';
  for (let i = 1; i <= depth; i++) {
    t = appendChild(t, pid, 'deeper', rhNode(`d${i}`, pid, 'deeper'));
    pid = `d${i}`;
  }
  return {
    id, userId, sparkId: `sp_${id}`,
    anchorJson: '{"title":"t","seedInterest":null,"adjacentField":null}',
    treeJson: JSON.stringify(t),
    scoringJson: '{"scoredDepthTier":0,"scoredBranchIds":[],"scoredSynapsePairs":[],"badgesFired":[],"dailyMapCountKey":"2026-06-05"}',
    title: null, xpAwarded: 0,
    createdAt: '2026-06-05T10:00:00.000Z', updatedAt: '2026-06-05T10:00:00.000Z', deletedAt: null,
  };
}

describe('loadOrCreateThread', () => {
  it('creates a fresh tree rooted at the spark, persists it, and stamps the spark', () => {
    const id = loadOrCreateThread(seed());
    const s = useRabbitHoleStore.getState();
    expect(s.treeId).toBe(id);
    expect(Object.keys(s.nodeMap)).toHaveLength(1); // root only
    expect(s.nodeMap[s.rootId!].title).toContain('murmurations');
    expect(getRabbitHoleTree(id)).toBeTruthy(); // persisted
    expect(updateSparkStatus).toHaveBeenCalledWith(sparkId, 'explored', id);
  });

  it('resumes the existing tree for a spark instead of creating a second', () => {
    const first = loadOrCreateThread(seed());
    const second = loadOrCreateThread(seed());
    expect(second).toBe(first);
  });
});

describe('advanceRabbitHole', () => {
  it('appends a child, realizes the chosen fork, leaves the other a ghost, and does NOT award XP per advance', async () => {
    loadOrCreateThread(seed());
    const root = useRabbitHoleStore.getState().rootId!;
    await advanceRabbitHole('deeper');
    const s = useRabbitHoleStore.getState();
    expect(Object.keys(s.nodeMap)).toHaveLength(2);
    expect(s.nodeMap[root].forks[0].state).toBe('realized'); // deeper taken
    expect(s.nodeMap[root].forks[1].state).toBe('ghost'); // sideways still open
    expect(s.cursorId).not.toBe(root); // moved onto the new child
    expect(addXP).not.toHaveBeenCalled(); // depth 1 crosses no tier
  });

  it('awards depth-tier XP once when a deeper-chain reaches depth 3, from the SESSION userId (not the spark)', async () => {
    useUserStore.setState({ userId: 'real-user-7' });
    loadOrCreateThread(seed());
    await advanceRabbitHole('deeper'); // d1
    await advanceRabbitHole('deeper'); // d2
    expect(addXP).not.toHaveBeenCalled();
    await advanceRabbitHole('deeper'); // d3 → tier 3
    expect(addXP).toHaveBeenCalledTimes(1);
    expect(addXP).toHaveBeenCalledWith('real-user-7', 10); // userId from useUserStore, not 'spark1'
    expect(triggerStreak).toHaveBeenCalledWith('real-user-7', 'learning');
  });

  it('re-taking an already-realized fork is a free cursor jump — no new node', async () => {
    loadOrCreateThread(seed());
    await advanceRabbitHole('deeper');
    const childId = useRabbitHoleStore.getState().cursorId!;
    useRabbitHoleStore.getState().climb(); // back to root (non-destructive)
    const before = Object.keys(useRabbitHoleStore.getState().nodeMap).length;
    await advanceRabbitHole('deeper'); // fork already realized → jump
    const after = useRabbitHoleStore.getState();
    expect(Object.keys(after.nodeMap).length).toBe(before); // nothing generated
    expect(after.cursorId).toBe(childId); // jumped onto the existing child
  });
});

describe('badges (Phase 4)', () => {
  it('fires road_not_taken when the user returns to a fork and takes the other path', async () => {
    loadOrCreateThread(seed());
    await advanceRabbitHole('deeper'); // root.deeper realized; cursor = d1
    useRabbitHoleStore.getState().climb(); // back to root (non-destructive)
    await advanceRabbitHole('sideways'); // root.sideways realized → root forked both ways
    expect(awardBadge).toHaveBeenCalledWith(expect.any(String), 'road_not_taken');
    // shallow + no real branch yet → these must NOT fire
    expect(awardBadge).not.toHaveBeenCalledWith(expect.any(String), 'deep_diver');
    expect(awardBadge).not.toHaveBeenCalledWith(expect.any(String), 'cartographer');
  });

  it('does not fire road_not_taken on a plain deeper-only chain', async () => {
    loadOrCreateThread(seed());
    await advanceRabbitHole('deeper');
    await advanceRabbitHole('deeper');
    expect(awardBadge).not.toHaveBeenCalledWith(expect.any(String), 'road_not_taken');
  });
});

describe('qualifiesForArchivist (Q4 gate)', () => {
  it('true with 5 qualifying trees, 2 of them genuinely deep', () => {
    const u = useUserStore.getState().userId!;
    upsertRabbitHoleTree(treeRow('a', u, 5));
    upsertRabbitHoleTree(treeRow('b', u, 5));
    upsertRabbitHoleTree(treeRow('c', u, 3));
    upsertRabbitHoleTree(treeRow('d', u, 3));
    upsertRabbitHoleTree(treeRow('e', u, 3));
    expect(qualifiesForArchivist(u)).toBe(true);
  });

  it('false with only 4 trees, and false when fewer than 2 are deep', () => {
    const u4 = useUserStore.getState().userId!;
    upsertRabbitHoleTree(treeRow('a', u4, 5));
    upsertRabbitHoleTree(treeRow('b', u4, 5));
    upsertRabbitHoleTree(treeRow('c', u4, 3));
    upsertRabbitHoleTree(treeRow('d', u4, 3));
    expect(qualifiesForArchivist(u4)).toBe(false); // only 4 qualifying

    seq += 1;
    const uShallow = `user-${seq}`;
    useUserStore.setState({ userId: uShallow });
    for (const id of ['p', 'q', 'r', 's', 't']) upsertRabbitHoleTree(treeRow(id, uShallow, 3));
    expect(qualifiesForArchivist(uShallow)).toBe(false); // 5 qualifying but 0 deep
  });
});
