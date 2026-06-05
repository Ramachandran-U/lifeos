/** Web rabbit-hole tree storage: blob upsert, soft-delete hiding, per-user list, daily count. */
beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  };
});

import {
  webUpsertRabbitHoleTree,
  webGetRabbitHoleTree,
  webGetRabbitHoleTreeBySpark,
  webListRabbitHoleTrees,
  webCountRabbitHoleTreesToday,
  webSoftDeleteRabbitHoleTree,
  type WebRabbitHoleTree,
} from '../rabbitHoleTrees';

function tree(over: Partial<WebRabbitHoleTree> = {}): WebRabbitHoleTree {
  return {
    id: 't1',
    userId: 'u1',
    sparkId: 'spark1',
    anchorJson: '{"title":"Why do murmurations stay together?","seedInterest":"biology","adjacentField":"geometry"}',
    treeJson: '{"nodeMap":{},"rootId":"root","cursorId":"root"}',
    scoringJson: '{"scoredDepthTier":0,"scoredBranchIds":[],"scoredSynapsePairs":[],"badgesFired":[],"dailyMapCountKey":"2026-06-05"}',
    title: null,
    xpAwarded: 0,
    createdAt: '2026-06-05T10:00:00.000Z',
    updatedAt: '2026-06-05T10:00:00.000Z',
    deletedAt: null,
    ...over,
  };
}

it('upserts a tree by id (insert then replace, never duplicating)', () => {
  webUpsertRabbitHoleTree(tree({ id: 't1', xpAwarded: 0 }));
  webUpsertRabbitHoleTree(tree({ id: 't1', xpAwarded: 65, title: 'Flocking' }));
  const got = webGetRabbitHoleTree('t1');
  expect(got?.xpAwarded).toBe(65);
  expect(got?.title).toBe('Flocking');
  expect(webListRabbitHoleTrees('u1')).toHaveLength(1); // replaced, not appended
});

it('finds a tree by its seed spark', () => {
  webUpsertRabbitHoleTree(tree({ id: 't1', sparkId: 'spark-abc' }));
  expect(webGetRabbitHoleTreeBySpark('spark-abc')?.id).toBe('t1');
  expect(webGetRabbitHoleTreeBySpark('nope')).toBeUndefined();
});

it('lists a user\'s trees newest-first and scopes by user', () => {
  webUpsertRabbitHoleTree(tree({ id: 'old', createdAt: '2026-06-01T09:00:00.000Z' }));
  webUpsertRabbitHoleTree(tree({ id: 'new', createdAt: '2026-06-05T09:00:00.000Z' }));
  webUpsertRabbitHoleTree(tree({ id: 'other', userId: 'u2' }));
  expect(webListRabbitHoleTrees('u1').map((t) => t.id)).toEqual(['new', 'old']);
});

it('soft-delete hides a tree from every read path', () => {
  webUpsertRabbitHoleTree(tree({ id: 't1' }));
  webSoftDeleteRabbitHoleTree('t1', '2026-06-06T10:00:00.000Z');
  expect(webGetRabbitHoleTree('t1')).toBeUndefined();
  expect(webGetRabbitHoleTreeBySpark('spark1')).toBeUndefined();
  expect(webListRabbitHoleTrees('u1')).toEqual([]);
});

it('counts only this user\'s live trees created on the given date', () => {
  webUpsertRabbitHoleTree(tree({ id: 'a', createdAt: '2026-06-05T08:00:00.000Z' }));
  webUpsertRabbitHoleTree(tree({ id: 'b', createdAt: '2026-06-05T22:00:00.000Z' }));
  webUpsertRabbitHoleTree(tree({ id: 'c', createdAt: '2026-06-04T22:00:00.000Z' })); // yesterday
  webUpsertRabbitHoleTree(tree({ id: 'd', userId: 'u2', createdAt: '2026-06-05T09:00:00.000Z' })); // other user
  webSoftDeleteRabbitHoleTree('b', '2026-06-05T23:00:00.000Z'); // deleted doesn't count
  expect(webCountRabbitHoleTreesToday('u1', '2026-06-05')).toBe(1);
});
