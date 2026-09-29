/**
 * recordMutation is fire-and-forget and swallows every error, by design: a
 * logging failure must never break the user's primary write. But "never fails"
 * had been implemented as "never tells anyone" — the catch was empty, nothing
 * reconciles local DB state against the log afterwards, and so a row could
 * change while its event-sourced history silently did not.
 *
 * The swallow stays. The silence does not. These tests pin both halves:
 * the primary write still survives a broken log, AND the drop is counted.
 */
// `MutationInput` is not exported from runtime.ts; derive it from the public
// signature rather than widening that shared module's surface for a test.
type MutationInput = Parameters<typeof import('../runtime').recordMutation>[0];

function installLocalStorage(): Map<string, string> {
  const store = new Map<string, string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    get length() {
      return store.size;
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
  };
  return store;
}

const INPUT: MutationInput = {
  entity: 'goals',
  entityId: 'g1',
  op: 'update',
  before: null,
  after: { title: 'x' },
};

/** Boot the runtime with a sink whose append always rejects. */
async function bootWithFailingSink() {
  jest.resetModules();
  installLocalStorage();

  jest.doMock('../sink', () => ({
    getLocalSink: () => ({
      resume: async () => ({ headHash: null, lamport: 0 }),
      append: async () => {
        throw new Error('disk on fire');
      },
      readPending: async () => [],
      markSynced: async () => undefined,
      appendApplied: async () => false,
      readEntityHistory: async () => [],
    }),
    _resetLocalSinkForTests: () => undefined,
  }));

  const { Platform } = await import('react-native');
  Platform.OS = 'web' as typeof Platform.OS;

  const { useUserStore } = await import('@/store/useUserStore');
  const { useFlagStore } = await import('@/store/useFlagStore');
  useUserStore.setState({ userId: 'u1', name: 'T', email: 't@x', onboardingStage: 100 });
  useFlagStore.setState({
    flags: { ...useFlagStore.getState().flags, mutation_log_enabled: true },
  });

  const metrics = await import('@/observability/metrics');
  metrics.resetMetrics();

  const runtime = await import('../runtime');
  runtime._resetMutationLogForTests();
  return { runtime, metrics };
}

describe('recordMutation — a dropped mutation is counted, never silent', () => {
  afterEach(async () => {
    const { Platform } = await import('react-native');
    Platform.OS = 'node' as typeof Platform.OS;
  });

  it('counts the drop, tagged by entity and op', async () => {
    const { runtime, metrics } = await bootWithFailingSink();

    runtime.recordMutation(INPUT);
    await runtime._flushMutationLogForTests();

    expect(
      metrics.getCounter('sync.mutations.dropped', { entity: 'goals', op: 'update' }),
    ).toBe(1);
  });

  it('never throws into the caller — the primary write must still complete', async () => {
    const { runtime } = await bootWithFailingSink();

    expect(() => runtime.recordMutation(INPUT)).not.toThrow();
    await expect(runtime._flushMutationLogForTests()).resolves.toBeUndefined();
  });

  it('accumulates across repeated failures rather than reporting once', async () => {
    const { runtime, metrics } = await bootWithFailingSink();

    runtime.recordMutation(INPUT);
    runtime.recordMutation(INPUT);
    runtime.recordMutation({ ...INPUT, entity: 'routine_blocks', op: 'delete' });
    await runtime._flushMutationLogForTests();

    expect(
      metrics.getCounter('sync.mutations.dropped', { entity: 'goals', op: 'update' }),
    ).toBe(2);
    expect(
      metrics.getCounter('sync.mutations.dropped', {
        entity: 'routine_blocks',
        op: 'delete',
      }),
    ).toBe(1);
  });
});
