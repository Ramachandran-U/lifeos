/**
 * Write-path tests for src/db/queries/goals.ts (web branch).
 *
 * The web branch (Platform.OS === 'web') is the testable one in the node jest
 * project: it delegates to the in-memory localStorage-backed webStorage helpers.
 * We force it by mocking react-native, and assert the {entity, op, before, after}
 * snapshot that recordMutation receives at each write site.
 *
 * Echo-safety: the webUpsert* helpers used by the sync reducer must NEVER fire
 * recordMutation (otherwise a remote-applied mutation would re-emit and loop).
 */

// Force the web branch — every queries file reads `Platform.OS === 'web'`.
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));

// Mutation log — assert the snapshots it receives.
jest.mock('@/sync/runtime', () => ({ recordMutation: jest.fn() }));

// createGoal lazy-imports telemetry; stub it so no real track() runs.
jest.mock('@/utils/telemetry', () => ({
  track: jest.fn(),
  EVENTS: { goalCreated: 'goal_created' },
}));

// Minimal in-memory localStorage shim for the node env (matches the harness in
// src/db/webStorage/__tests__/routine.test.ts).
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
  createGoal,
  getGoalsByUser,
  getGoalById,
  getChildGoals,
  updateGoalStatus,
  updateGoalDescription,
  setGoalPriorities,
  softDeleteGoal,
  getDeletedGoals,
  restoreGoal,
} from '../goals';
import { webUpsertGoalById, type WebGoal } from '../../webStorage';
import { recordMutation } from '@/sync/runtime';

const recordMutationMock = recordMutation as jest.MockedFunction<typeof recordMutation>;

const USER = 'user-fake-1';

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

describe('createGoal (web)', () => {
  it('maps fields, defaults status to "active", and persists the row', () => {
    const id = createGoal({
      userId: USER,
      title: 'Learn the cello',
      description: 'one phrase a day',
      goalType: 'skill',
      level: 'vision',
      timeline: '1y',
      energyLevel: 'high',
      aiGenerated: true,
      metadata: '{"k":"v"}',
    });

    const stored = getGoalById(id);
    expect(stored).toMatchObject({
      id,
      userId: USER,
      title: 'Learn the cello',
      description: 'one phrase a day',
      goalType: 'skill',
      level: 'vision',
      timeline: '1y',
      status: 'active',
      energyLevel: 'high',
      aiGenerated: true,
      metadata: '{"k":"v"}',
    });
    expect(stored?.createdAt).toBeTruthy();
    expect(stored?.updatedAt).toBeTruthy();
  });

  it('records an insert mutation with before:null and the full row in after', () => {
    const id = createGoal({
      userId: USER,
      title: 'Run a 5k',
      goalType: 'fitness',
      level: 'milestone',
    });

    expect(recordMutationMock).toHaveBeenCalledTimes(1);
    expect(recordMutationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'goals',
        entityId: id,
        op: 'insert',
        before: null,
        after: expect.objectContaining({ id, title: 'Run a 5k', status: 'active' }),
      }),
    );
  });
});

describe('getGoalsByUser (web)', () => {
  it('returns only the user\'s non-deleted goals', () => {
    const a = createGoal({ userId: USER, title: 'A', goalType: 'g', level: 'milestone' });
    createGoal({ userId: 'other-user', title: 'B', goalType: 'g', level: 'milestone' });
    const c = createGoal({ userId: USER, title: 'C', goalType: 'g', level: 'milestone' });

    const titles = getGoalsByUser(USER).map((g) => g.title).sort();
    expect(titles).toEqual(['A', 'C']);
    expect(getGoalsByUser(USER).map((g) => g.id).sort()).toEqual([a, c].sort());
  });

  it('excludes a soft-deleted goal, and restore brings it back (round-trip)', () => {
    const id = createGoal({ userId: USER, title: 'Tidy', goalType: 'g', level: 'milestone' });
    expect(getGoalsByUser(USER).map((g) => g.id)).toContain(id);

    softDeleteGoal(id);
    expect(getGoalsByUser(USER).map((g) => g.id)).not.toContain(id);

    restoreGoal(id);
    expect(getGoalsByUser(USER).map((g) => g.id)).toContain(id);
  });
});

describe('getChildGoals (web)', () => {
  it('returns non-deleted children of a parent', () => {
    const parent = createGoal({ userId: USER, title: 'Parent', goalType: 'g', level: 'vision' });
    const child1 = createGoal({ userId: USER, title: 'Child1', goalType: 'g', level: 'milestone', parentId: parent });
    const child2 = createGoal({ userId: USER, title: 'Child2', goalType: 'g', level: 'milestone', parentId: parent });
    createGoal({ userId: USER, title: 'Unrelated', goalType: 'g', level: 'milestone' });

    expect(getChildGoals(parent).map((g) => g.id).sort()).toEqual([child1, child2].sort());

    softDeleteGoal(child1);
    expect(getChildGoals(parent).map((g) => g.id)).toEqual([child2]);
  });
});

describe('updateGoalStatus (web)', () => {
  it('persists the new status and logs an update with before/after snapshots', () => {
    const id = createGoal({ userId: USER, title: 'X', goalType: 'g', level: 'milestone' });
    recordMutationMock.mockClear();

    updateGoalStatus(id, 'completed');

    expect(getGoalById(id)?.status).toBe('completed');
    expect(recordMutationMock).toHaveBeenCalledTimes(1);
    const call = recordMutationMock.mock.calls[0][0];
    expect(call.entity).toBe('goals');
    expect(call.entityId).toBe(id);
    expect(call.op).toBe('update');
    expect((call.before as Record<string, unknown>).status).toBe('active');
    expect((call.after as Record<string, unknown>).status).toBe('completed');
  });
});

describe('updateGoalDescription (web)', () => {
  it('persists the new description and logs before/after', () => {
    const id = createGoal({ userId: USER, title: 'X', goalType: 'g', level: 'milestone', description: 'old' });
    recordMutationMock.mockClear();

    updateGoalDescription(id, 'new');

    expect(getGoalById(id)?.description).toBe('new');
    const call = recordMutationMock.mock.calls[0][0];
    expect(call.op).toBe('update');
    expect((call.before as Record<string, unknown>).description).toBe('old');
    expect((call.after as Record<string, unknown>).description).toBe('new');
  });
});

describe('setGoalPriorities (web)', () => {
  it('is a no-op (no write, no mutation) for an empty update list', () => {
    setGoalPriorities([]);
    expect(recordMutationMock).not.toHaveBeenCalled();
  });

  it('persists each priority and logs one update mutation per goal', () => {
    const a = createGoal({ userId: USER, title: 'A', goalType: 'g', level: 'milestone' });
    const b = createGoal({ userId: USER, title: 'B', goalType: 'g', level: 'milestone' });
    recordMutationMock.mockClear();

    setGoalPriorities([
      { id: a, priority: 2 },
      { id: b, priority: 1 },
    ]);

    expect(getGoalById(a)?.priority).toBe(2);
    expect(getGoalById(b)?.priority).toBe(1);
    expect(recordMutationMock).toHaveBeenCalledTimes(2);
    const byId = new Map(
      recordMutationMock.mock.calls.map((c) => [c[0].entityId, c[0]]),
    );
    expect((byId.get(a)?.after as Record<string, unknown>).priority).toBe(2);
    expect((byId.get(b)?.after as Record<string, unknown>).priority).toBe(1);
    expect(byId.get(a)?.op).toBe('update');
  });
});

describe('softDeleteGoal (web)', () => {
  it('logs a delete mutation (tombstone) with before populated and after:null', () => {
    const id = createGoal({ userId: USER, title: 'X', goalType: 'g', level: 'milestone' });
    recordMutationMock.mockClear();

    softDeleteGoal(id);

    const call = recordMutationMock.mock.calls[0][0];
    expect(call.op).toBe('delete');
    expect(call.entity).toBe('goals');
    expect(call.after).toBeNull();
    expect((call.before as Record<string, unknown>).id).toBe(id);
  });
});

describe('getDeletedGoals (web)', () => {
  it('returns soft-deleted goals most-recently-deleted first', () => {
    const first = createGoal({ userId: USER, title: 'First', goalType: 'g', level: 'milestone' });
    const second = createGoal({ userId: USER, title: 'Second', goalType: 'g', level: 'milestone' });

    // Drive deletedAt ordering deterministically via spied timestamps rather
    // than relying on wall-clock resolution between two synchronous calls.
    const seq = ['2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z'];
    let i = 0;
    const spy = jest.spyOn(Date.prototype, 'toISOString').mockImplementation(() => seq[i++] ?? '2026-03-01T00:00:00.000Z');
    softDeleteGoal(first);   // deletedAt = 2026-01-01
    softDeleteGoal(second);  // deletedAt = 2026-02-01
    spy.mockRestore();

    const order = getDeletedGoals(USER).map((g) => g.id);
    expect(order).toEqual([second, first]);
  });

  it('does not return live goals', () => {
    const live = createGoal({ userId: USER, title: 'Live', goalType: 'g', level: 'milestone' });
    const dead = createGoal({ userId: USER, title: 'Dead', goalType: 'g', level: 'milestone' });
    softDeleteGoal(dead);

    const ids = getDeletedGoals(USER).map((g) => g.id);
    expect(ids).toContain(dead);
    expect(ids).not.toContain(live);
  });
});

describe('restoreGoal (web)', () => {
  it('clears deletedAt and logs an update mutation with after.deletedAt = null', () => {
    const id = createGoal({ userId: USER, title: 'X', goalType: 'g', level: 'milestone' });
    softDeleteGoal(id);
    recordMutationMock.mockClear();

    restoreGoal(id);

    expect(getGoalById(id)?.deletedAt).toBeUndefined();
    const call = recordMutationMock.mock.calls[0][0];
    expect(call.op).toBe('update');
    expect((call.after as Record<string, unknown>).deletedAt).toBeNull();
  });
});

describe('echo-safety: webUpsertGoalById (sync reducer path)', () => {
  it('does NOT record a mutation when applying a remote goal row', () => {
    const remote: WebGoal = {
      id: 'remote-goal-1',
      userId: USER,
      title: 'Synced from another device',
      goalType: 'g',
      level: 'milestone',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    webUpsertGoalById(remote);

    // The reducer-facing upsert must never re-emit a mutation (would loop).
    expect(recordMutationMock).not.toHaveBeenCalled();
    // But it must still land in storage.
    expect(getGoalById('remote-goal-1')?.title).toBe('Synced from another device');
  });
});
