/**
 * Tests for goal comments + priority web-storage helpers. We shim localStorage
 * so the pure web-storage functions (normally backed by browser localStorage)
 * work in the Jest/node environment.
 */

function installLocalStorageShim() {
  const store = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

beforeEach(() => {
  installLocalStorageShim();
});

describe('webGoalComments', () => {
  it('inserts and lists comments for a goal in chronological order', async () => {
    const {
      webInsertGoalComment,
      webListGoalComments,
    } = await import('../webStorage');

    webInsertGoalComment({
      id: 'c1',
      goalId: 'g1',
      userId: 'u1',
      body: 'started',
      createdAt: '2026-01-01T10:00:00.000Z',
    });
    webInsertGoalComment({
      id: 'c2',
      goalId: 'g1',
      userId: 'u1',
      body: 'halfway',
      createdAt: '2026-01-02T10:00:00.000Z',
    });
    webInsertGoalComment({
      id: 'c3',
      goalId: 'g2', // different goal
      userId: 'u1',
      body: 'ignore me',
      createdAt: '2026-01-01T09:00:00.000Z',
    });

    const list = webListGoalComments('g1');
    expect(list.map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(list.every((c) => c.goalId === 'g1')).toBe(true);
  });

  it('deletes a comment by id', async () => {
    const {
      webInsertGoalComment,
      webListGoalComments,
      webDeleteGoalComment,
    } = await import('../webStorage');
    webInsertGoalComment({ id: 'c1', goalId: 'g1', userId: 'u1', body: 'x', createdAt: 't' });
    webInsertGoalComment({ id: 'c2', goalId: 'g1', userId: 'u1', body: 'y', createdAt: 't' });
    webDeleteGoalComment('c1');
    expect(webListGoalComments('g1').map((c) => c.id)).toEqual(['c2']);
  });
});

describe('webSetGoalPriorities', () => {
  it('updates only the listed goals and leaves others untouched', async () => {
    const {
      webInsertGoal,
      webGetGoalsByUser,
      webSetGoalPriorities,
    } = await import('../webStorage');

    const base = {
      userId: 'u1',
      title: 't',
      goalType: 'health',
      level: 'monthly',
      status: 'active',
      createdAt: 'x',
      updatedAt: 'x',
    };
    webInsertGoal({ id: 'a', ...base, priority: 0 });
    webInsertGoal({ id: 'b', ...base, priority: 0 });
    webInsertGoal({ id: 'c', ...base, priority: 0 });

    webSetGoalPriorities([
      { id: 'a', priority: 2 },
      { id: 'c', priority: 1 },
    ]);

    const all = webGetGoalsByUser('u1');
    const byId = Object.fromEntries(all.map((g) => [g.id, g.priority]));
    expect(byId.a).toBe(2);
    expect(byId.b).toBe(0);
    expect(byId.c).toBe(1);
  });

  it('sorting by priority ASC produces the intended order', async () => {
    const {
      webInsertGoal,
      webGetGoalsByUser,
      webSetGoalPriorities,
    } = await import('../webStorage');
    const base = {
      userId: 'u1',
      title: 't',
      goalType: 'career',
      level: 'monthly',
      status: 'active',
      createdAt: 'x',
      updatedAt: 'x',
    };
    webInsertGoal({ id: 'a', ...base, priority: 0 });
    webInsertGoal({ id: 'b', ...base, priority: 0 });
    webInsertGoal({ id: 'c', ...base, priority: 0 });

    webSetGoalPriorities([
      { id: 'b', priority: 0 },
      { id: 'a', priority: 1 },
      { id: 'c', priority: 2 },
    ]);
    const sorted = webGetGoalsByUser('u1').sort(
      (x, y) => (x.priority ?? 0) - (y.priority ?? 0),
    );
    expect(sorted.map((g) => g.id)).toEqual(['b', 'a', 'c']);
  });
});
