/**
 * Tests for the web sink. Native sink uses expo-sqlite which can't run under
 * jest-node; we smoke-test it manually after deploy.
 */
import { Platform } from 'react-native';
import { MutationLog, type MutationRecord } from '../mutationLog';
import { testHasher } from './testHasher';

// localStorage shim — jest's node env has no DOM.
function installLocalStorage(): { clear: () => void; store: Map<string, string> } {
  const store = new Map<string, string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    get length() { return store.size; },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
  };
  return { clear: () => store.clear(), store };
}

describe('web sink', () => {
  let cleanup: { clear: () => void; store: Map<string, string> };

  beforeEach(() => {
    Platform.OS = 'web' as typeof Platform.OS;
    cleanup = installLocalStorage();
  });

  afterEach(() => {
    cleanup.clear();
    Platform.OS = 'node' as typeof Platform.OS;
  });

  test('append persists records that survive a "reload"', async () => {
    // Re-import after Platform.OS switch so the module sees web.
    const { createLocalSink } = await import('../sink');
    const sink = createLocalSink();

    const log = new MutationLog({
      hasher: testHasher,
      deviceId: 'device-a',
      userId: 'user-1',
      sink: sink.append,
    });

    await log.record({ entity: 'goals', entityId: 'g1', op: 'insert', before: null, after: { id: 'g1', title: 'Run' } });
    await log.record({ entity: 'goals', entityId: 'g1', op: 'update', before: { id: 'g1', title: 'Run' }, after: { id: 'g1', title: 'Run 5km' } });

    // Simulated reload — fresh sink instance reads from same localStorage.
    const sink2 = createLocalSink();
    const resume = await sink2.resume();

    // Two records appended, so the tail's lamport is 2 and there's a non-null head.
    expect(resume.lamport).toBe(2);
    expect(resume.headHash).not.toBeNull();
  });

  test('resume on a fresh store returns the empty chain', async () => {
    const { createLocalSink } = await import('../sink');
    const sink = createLocalSink();
    const resume = await sink.resume();
    expect(resume).toEqual({ headHash: null, lamport: 0 });
  });

  test('ring buffer caps at 5000 records', async () => {
    const { createLocalSink } = await import('../sink');
    const sink = createLocalSink();
    // Forge a buffer just over the cap and check the next append still works.
    const fakeRecords: MutationRecord[] = [];
    for (let i = 0; i < 4999; i++) {
      fakeRecords.push({
        id: `m${i}`, entity: 'goals', entityId: `g${i}`, op: 'insert',
        before: null, after: { v: i }, fields: ['v'],
        ts: new Date().toISOString(), lamport: i + 1,
        deviceId: 'd', userId: 'u', prevHash: null, hash: 'h' + i,
      });
    }
    cleanup.store.set('lifeos_mutation_log', JSON.stringify(fakeRecords));

    // Append two more — should cap to 5000.
    const log = new MutationLog({
      hasher: testHasher,
      deviceId: 'd',
      userId: 'u',
      sink: sink.append,
      initialLamport: 4999,
      headHash: 'h4998',
    });
    await log.record({ entity: 'goals', entityId: 'x', op: 'insert', before: null, after: { v: 'last' } });
    await log.record({ entity: 'goals', entityId: 'y', op: 'insert', before: null, after: { v: 'after' } });

    const stored = JSON.parse(cleanup.store.get('lifeos_mutation_log') ?? '[]') as MutationRecord[];
    expect(stored.length).toBe(5000);
    // The oldest entry got rotated out; the newest is the latest append.
    expect(stored[stored.length - 1].entityId).toBe('y');
    expect(stored[0].entityId).not.toBe('g0'); // oldest was rotated out
  });

  test('applyCompaction re-chains survivors, inserts the checkpoint, and resume() still returns the max-lamport local head (T9)', async () => {
    const { createLocalSink } = await import('../sink');
    const { planCompaction, COMMUTATIVE_ENTITIES } = await import('../compaction');
    const { validateChain } = await import('../hashChain');
    const { chainPayload } = await import('../mutationLog');

    const sink = createLocalSink();
    const log = new MutationLog({ hasher: testHasher, deviceId: 'A', userId: 'u', sink: sink.append });
    const gamiAfter = (xp: number) => ({ id: 'grow', userId: 'u', totalXP: xp, weeklyXP: 0, badges: '[]', streaks: '{}', domainScores: '{}', updatedAt: 't' });
    // 3 commutative gamification writes (collapsible) + a LATER goal that survives.
    await log.record({ entity: 'gamification', entityId: 'u', op: 'update', before: null, after: gamiAfter(100) });
    await log.record({ entity: 'gamification', entityId: 'u', op: 'update', before: null, after: gamiAfter(150) });
    await log.record({ entity: 'gamification', entityId: 'u', op: 'update', before: null, after: gamiAfter(120) });
    await log.record({ entity: 'goals', entityId: 'g1', op: 'insert', before: null, after: { id: 'g1', title: 'Keep' } });

    // planCompaction never touches pending rows → mark everything acked first.
    const all = await sink.readAllWithState();
    await sink.markSynced(all.map((x) => x.record.id));
    const goalHashBefore = (await sink.readAllWithState()).find((x) => x.record.entity === 'goals')!.record.hash;

    const plan = await planCompaction(
      await sink.readAllWithState(),
      { minMutations: 3, retainCutoffTs: '2000-01-01T00:00:00.000Z', commutative: COMMUTATIVE_ENTITIES },
      testHasher,
    );
    expect(plan.checkpoints).toHaveLength(1);
    const reGoal = plan.rechained.find((r) => r.entity === 'goals');
    expect(reGoal).toBeTruthy(); // the goal sits after the collapsed run → re-linked

    await sink.applyCompaction(plan);

    const after = await sink.readAllWithState();
    // Gamification collapsed to one checkpoint; the goal survives.
    expect(after.filter((x) => x.record.entity === 'gamification')).toHaveLength(1);
    expect(after.find((x) => x.record.id === 'ckpt:gamification:u')).toBeTruthy();

    // The re-chain UPDATE actually landed in the buffer (not just the plan).
    const goalAfter = after.find((x) => x.record.entity === 'goals')!.record;
    expect(goalAfter.hash).toBe(reGoal!.hash);
    expect(goalAfter.hash).not.toBe(goalHashBefore);

    // resume head = the highest-lamport LOCAL record (the goal), NOT the
    // checkpoint (which carries an older lamport). Regression guard for the
    // unsorted-append bug where a checkpoint would wrongly become the head.
    const localMax = after
      .filter((x) => x.syncState !== 'applied_remote')
      .map((x) => x.record)
      .sort((a, b) => a.lamport - b.lamport)
      .pop()!;
    expect(localMax.entity).toBe('goals');
    const resumed = await sink.resume();
    expect(resumed.headHash).toBe(localMax.hash);

    // The post-compaction local chain validates end-to-end.
    const local = after
      .filter((x) => x.syncState !== 'applied_remote')
      .map((x) => x.record)
      .sort((a, b) => a.lamport - b.lamport);
    const broke = await validateChain(
      local.map((r) => ({ prevHash: r.prevHash, hash: r.hash, payload: chainPayload(r) })),
      testHasher,
    );
    expect(broke).toBe(-1);

    // A fresh write chains cleanly off the resumed head.
    const log2 = new MutationLog({ hasher: testHasher, deviceId: 'A', userId: 'u', sink: sink.append, headHash: resumed.headHash, initialLamport: resumed.lamport });
    const next = await log2.record({ entity: 'goals', entityId: 'g1', op: 'update', before: null, after: { id: 'g1', title: 'Updated' } });
    expect(next.prevHash).toBe(localMax.hash);
  });
});
