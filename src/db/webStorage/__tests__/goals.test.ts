/**
 * webStorage/goals — user-scoping, soft-delete exclusion, parent/child filter,
 * deleted-ordering, priority batch update, comment ordering, and the echo-safe
 * webUpsertGoalById path used by the sync reducer.
 */

beforeAll(() => {
  const store: Record<string, string> = {};
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  };
});

import {
  webInsertGoal,
  webGetGoalsByUser,
  webGetGoalById,
  webGetChildGoals,
  webUpdateGoalStatus,
  webUpdateGoalDescription,
  webUpsertGoalById,
  webSoftDeleteGoal,
  webGetDeletedGoals,
  webRestoreGoal,
  webSetGoalPriorities,
  webInsertGoalComment,
  webListGoalComments,
  webDeleteGoalComment,
  type WebGoal,
  type WebGoalComment,
} from '../goals';

function goal(over: Partial<WebGoal>): WebGoal {
  return {
    id: Math.random().toString(36).slice(2),
    userId: 'user-a',
    title: 'Run a marathon',
    goalType: 'vision',
    level: 'vision',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

beforeEach(() => { localStorage.clear(); });

describe('webGetGoalsByUser', () => {
  it('returns only the matching user, excluding soft-deleted rows', () => {
    webInsertGoal(goal({ id: 'g1', userId: 'user-a' }));
    webInsertGoal(goal({ id: 'g2', userId: 'user-b' }));
    webInsertGoal(goal({ id: 'g3', userId: 'user-a', deletedAt: '2026-02-01T00:00:00.000Z' }));
    expect(webGetGoalsByUser('user-a').map((g) => g.id)).toEqual(['g1']);
  });
});

describe('webGetGoalById', () => {
  it('reads back an inserted goal, returns undefined for unknown id', () => {
    webInsertGoal(goal({ id: 'g1', title: 'Read 12 books' }));
    expect(webGetGoalById('g1')?.title).toBe('Read 12 books');
    expect(webGetGoalById('missing')).toBeUndefined();
  });
});

describe('webGetChildGoals', () => {
  it('returns children by parentId excluding soft-deleted', () => {
    webInsertGoal(goal({ id: 'p1' }));
    webInsertGoal(goal({ id: 'c1', parentId: 'p1' }));
    webInsertGoal(goal({ id: 'c2', parentId: 'p1', deletedAt: '2026-02-01T00:00:00.000Z' }));
    webInsertGoal(goal({ id: 'c3', parentId: 'other' }));
    expect(webGetChildGoals('p1').map((g) => g.id)).toEqual(['c1']);
  });
});

describe('webUpdateGoalStatus / webUpdateGoalDescription', () => {
  it('mutates the targeted field and bumps updatedAt', () => {
    webInsertGoal(goal({ id: 'g1', status: 'active', updatedAt: '2026-01-01T00:00:00.000Z' }));
    webUpdateGoalStatus('g1', 'completed');
    const after = webGetGoalById('g1');
    expect(after?.status).toBe('completed');
    expect(after?.updatedAt).not.toBe('2026-01-01T00:00:00.000Z');

    webUpdateGoalDescription('g1', 'updated copy');
    expect(webGetGoalById('g1')?.description).toBe('updated copy');
  });

  it('is a no-op for an unknown id', () => {
    webInsertGoal(goal({ id: 'g1', status: 'active' }));
    webUpdateGoalStatus('missing', 'completed');
    expect(webGetGoalById('g1')?.status).toBe('active');
  });
});

describe('webUpsertGoalById (echo-safe sync path)', () => {
  it('inserts when absent and replaces in place when present, idempotently', () => {
    const row = goal({ id: 'g1', title: 'first', updatedAt: '2026-03-01T00:00:00.000Z' });
    webUpsertGoalById(row);
    expect(webGetGoalsByUser('user-a')).toHaveLength(1);

    const edited = goal({ id: 'g1', title: 'second', updatedAt: '2026-03-01T00:00:00.000Z' });
    webUpsertGoalById(edited);
    webUpsertGoalById(edited); // repeat → still one row
    const all = webGetGoalsByUser('user-a');
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe('second');
    // echo-safe: does not rewrite updatedAt
    expect(all[0].updatedAt).toBe('2026-03-01T00:00:00.000Z');
  });
});

describe('soft-delete / restore lifecycle', () => {
  it('soft-deletes, lists deleted most-recent-first, and restores', () => {
    webInsertGoal(goal({ id: 'g1', userId: 'user-a' }));
    webInsertGoal(goal({ id: 'g2', userId: 'user-a' }));
    webSoftDeleteGoal('g1');
    webSoftDeleteGoal('g2');

    const deleted = webGetDeletedGoals('user-a');
    expect(deleted.map((g) => g.id).sort()).toEqual(['g1', 'g2']);
    // ordering: deletedAt DESC — the later deletion sorts first
    const [first] = deleted;
    expect((deleted[0].deletedAt ?? '') >= (deleted[1].deletedAt ?? '')).toBe(true);
    expect(webGetGoalsByUser('user-a')).toHaveLength(0);

    webRestoreGoal(first.id);
    expect(webGetGoalsByUser('user-a').map((g) => g.id)).toEqual([first.id]);
    expect(webGetGoalById(first.id)?.deletedAt).toBeUndefined();
  });
});

describe('webSetGoalPriorities', () => {
  it('applies a batch of priorities by id, leaving others untouched', () => {
    webInsertGoal(goal({ id: 'g1', priority: 0 }));
    webInsertGoal(goal({ id: 'g2', priority: 0 }));
    webInsertGoal(goal({ id: 'g3', priority: 5 }));
    webSetGoalPriorities([
      { id: 'g1', priority: 3 },
      { id: 'g2', priority: 1 },
    ]);
    expect(webGetGoalById('g1')?.priority).toBe(3);
    expect(webGetGoalById('g2')?.priority).toBe(1);
    expect(webGetGoalById('g3')?.priority).toBe(5);
  });
});

describe('goal comments', () => {
  function comment(over: Partial<WebGoalComment>): WebGoalComment {
    return {
      id: Math.random().toString(36).slice(2),
      goalId: 'g1',
      userId: 'user-a',
      body: 'note',
      createdAt: '2026-01-01T00:00:00.000Z',
      ...over,
    };
  }

  it('lists comments for a goal sorted ascending by createdAt; deletes by id', () => {
    webInsertGoalComment(comment({ id: 'c1', createdAt: '2026-01-03T00:00:00.000Z' }));
    webInsertGoalComment(comment({ id: 'c2', createdAt: '2026-01-01T00:00:00.000Z' }));
    webInsertGoalComment(comment({ id: 'c3', goalId: 'other', createdAt: '2026-01-02T00:00:00.000Z' }));
    expect(webListGoalComments('g1').map((c) => c.id)).toEqual(['c2', 'c1']);

    webDeleteGoalComment('c2');
    expect(webListGoalComments('g1').map((c) => c.id)).toEqual(['c1']);
  });
});
