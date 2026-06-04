/**
 * End-to-end write-path smoke. Exercises the real production path:
 *
 *   queries/goals.ts createGoal()
 *     → webInsertGoal (real localStorage write)
 *     → recordMutation (runtime singleton)
 *     → sink.append (real localStorage write)
 *
 * Verifies a hash-chained mutation log accumulates as the app does writes,
 * surviving a simulated reload, with the chain head propagating correctly.
 *
 * This is the wiring test the unit tests don't cover — it catches bugs like
 * "the query updated but forgot to record" or "the runtime singleton leaks
 * state between users."
 */
import type { MutationRecord } from '../mutationLog';

// Re-imported per test after jest.resetModules() so Platform/stores resolve to
// fresh module instances. Importing them at the top would bind to stale refs.

interface FakeStorage {
  store: Map<string, string>;
  install(): void;
  clear(): void;
}

function makeStorage(): FakeStorage {
  const store = new Map<string, string>();
  return {
    store,
    install(): void {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).localStorage = {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => { store.set(k, v); },
        removeItem: (k: string) => { store.delete(k); },
        get length() { return store.size; },
        key: (i: number) => Array.from(store.keys())[i] ?? null,
      };
    },
    clear(): void {
      store.clear();
    },
  };
}

async function flushAndRead(storage: FakeStorage): Promise<MutationRecord[]> {
  const { _flushMutationLogForTests } = await import('../runtime');
  await _flushMutationLogForTests();
  const raw = storage.store.get('lifeos_mutation_log');
  return raw ? (JSON.parse(raw) as MutationRecord[]) : [];
}

async function setupWebEnv(
  storage: FakeStorage,
  opts: { userId: string | null; mutationLogEnabled?: boolean } = { userId: 'user-1' },
): Promise<void> {
  jest.resetModules();
  storage.install();
  const { Platform } = await import('react-native');
  (Platform as { OS: string }).OS = 'web';
  const { useUserStore } = await import('@/store/useUserStore');
  const { useFlagStore } = await import('@/store/useFlagStore');
  useUserStore.getState().reset();
  if (opts.userId) {
    useUserStore.setState({ userId: opts.userId, name: 'Test', email: 't@x', onboardingStage: 100 });
  }
  useFlagStore.setState({
    flags: { ...useFlagStore.getState().flags, mutation_log_enabled: opts.mutationLogEnabled ?? true },
  });
}

describe('write-path integration (web)', () => {
  jest.setTimeout(20_000);
  let storage: FakeStorage;

  beforeEach(() => {
    storage = makeStorage();
  });

  afterEach(async () => {
    // Drain any in-flight mutations, then fully reset the process-wide singletons
    // and the fake global so nothing can leak into a sibling test file. This
    // matters under CI's single-process `--coverage --runInBand` gate, where one
    // Node process runs every suite back-to-back and a stray in-flight write or a
    // leftover `globalThis.localStorage` could perturb a later suite.
    try {
      const { _flushMutationLogForTests, _resetMutationLogForTests } = await import('../runtime');
      await _flushMutationLogForTests();
      _resetMutationLogForTests();
    } catch { /* runtime may not be loaded yet */ }
    try {
      const { _resetLocalSinkForTests } = await import('../sink');
      _resetLocalSinkForTests();
    } catch { /* sink may not be loaded yet */ }
    storage.clear();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).localStorage;
  });

  test('createGoal writes both the goal and a chained mutation', async () => {
    await setupWebEnv(storage, { userId: 'user-1' });
    const { createGoal, updateGoalStatus, softDeleteGoal } = await import('@/db/queries/goals');

    const id = createGoal({
      userId: 'user-1',
      title: 'Run a 10k',
      goalType: 'health',
      level: 'life',
    });

    // Goal landed in webStorage.
    const goalsRaw = storage.store.get('lifeos_goals');
    expect(goalsRaw).toBeTruthy();
    const goals = JSON.parse(goalsRaw!) as { id: string; title: string }[];
    expect(goals).toHaveLength(1);
    expect(goals[0].id).toBe(id);

    // Mutation landed in the log.
    const afterInsert = await flushAndRead(storage);
    expect(afterInsert).toHaveLength(1);
    expect(afterInsert[0]).toMatchObject({
      entity: 'goals',
      entityId: id,
      op: 'insert',
      userId: 'user-1',
      lamport: 1,
      prevHash: null,
    });
    expect(afterInsert[0].hash).toMatch(/^[0-9a-f]{64}$/);
    expect(afterInsert[0].after).toMatchObject({ title: 'Run a 10k', status: 'active' });

    // Update — must chain from the previous head.
    updateGoalStatus(id, 'completed');
    const afterUpdate = await flushAndRead(storage);
    expect(afterUpdate).toHaveLength(2);
    expect(afterUpdate[1]).toMatchObject({
      entity: 'goals',
      entityId: id,
      op: 'update',
      lamport: 2,
      prevHash: afterInsert[0].hash,
    });
    expect(afterUpdate[1].fields).toContain('status');

    // Soft-delete — logged as tombstone.
    softDeleteGoal(id);
    const afterDelete = await flushAndRead(storage);
    expect(afterDelete).toHaveLength(3);
    expect(afterDelete[2]).toMatchObject({
      entity: 'goals',
      entityId: id,
      op: 'delete',
      lamport: 3,
      prevHash: afterUpdate[1].hash,
      after: null,
    });
  });

  test('the chain resumes correctly across a simulated reload', async () => {
    await setupWebEnv(storage, { userId: 'user-1' });
    const goalsMod = await import('@/db/queries/goals');

    const id1 = goalsMod.createGoal({ userId: 'user-1', title: 'A', goalType: 'health', level: 'life' });
    const afterFirst = await flushAndRead(storage);
    expect(afterFirst).toHaveLength(1);

    // Simulate process restart — full env re-init.
    await setupWebEnv(storage, { userId: 'user-1' });
    const goalsMod2 = await import('@/db/queries/goals');

    const id2 = goalsMod2.createGoal({ userId: 'user-1', title: 'B', goalType: 'health', level: 'life' });
    const all = await flushAndRead(storage);

    expect(all).toHaveLength(2);
    expect(all[0].entityId).toBe(id1);
    expect(all[1].entityId).toBe(id2);
    // Critical: the second session's first mutation must chain from the first
    // session's head, not start a new chain.
    expect(all[1].prevHash).toBe(all[0].hash);
    expect(all[1].lamport).toBe(2);
  });

  test('kill switch disables the log without affecting the primary write', async () => {
    await setupWebEnv(storage, { userId: 'user-1', mutationLogEnabled: false });
    const { createGoal } = await import('@/db/queries/goals');

    const id = createGoal({ userId: 'user-1', title: 'Killed', goalType: 'health', level: 'life' });
    expect(id).toBeTruthy();

    // Goal still landed.
    const goalsRaw = storage.store.get('lifeos_goals');
    expect(goalsRaw).toBeTruthy();

    // Log did NOT.
    const records = await flushAndRead(storage);
    expect(records).toHaveLength(0);
  });

  test('writes before sign-in do not crash and do not record', async () => {
    // No userId — pre-signin path.
    await setupWebEnv(storage, { userId: null });
    const { createGoal } = await import('@/db/queries/goals');

    const id = createGoal({ userId: 'anon', title: 'Pre-signin', goalType: 'health', level: 'life' });
    expect(id).toBeTruthy();
    const records = await flushAndRead(storage);
    expect(records).toHaveLength(0);
  });
});
