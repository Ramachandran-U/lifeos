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
});
