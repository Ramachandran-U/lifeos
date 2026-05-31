/**
 * Tests for the sync outbox API (readPending / markSynced) on the web sink.
 * The native sink uses expo-sqlite which can't run under jest-node; it's
 * smoke-tested manually after deploy (same constraint as sink.test.ts).
 */
import { Platform } from 'react-native';
import type { MutationRecord } from '../mutationLog';

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

function rec(id: string, lamport: number): MutationRecord {
  return {
    id,
    entity: 'goals',
    entityId: `g${id}`,
    op: 'insert',
    before: null,
    after: { id: `g${id}`, v: id },
    fields: [],
    ts: new Date(lamport * 1000).toISOString(),
    lamport,
    deviceId: 'd',
    userId: 'u',
    prevHash: null,
    hash: `h${id}`,
  };
}

describe('web sync outbox', () => {
  let cleanup: { clear: () => void; store: Map<string, string> };

  beforeEach(() => {
    Platform.OS = 'web' as typeof Platform.OS;
    cleanup = installLocalStorage();
  });

  afterEach(() => {
    cleanup.clear();
    Platform.OS = 'node' as typeof Platform.OS;
  });

  test('readPending returns pending records oldest-first, capped at limit', async () => {
    const { createLocalSink } = await import('../sink');
    const sink = createLocalSink();

    // Append out of lamport order; outbox must return them sorted by lamport.
    await sink.append(rec('3', 3));
    await sink.append(rec('1', 1));
    await sink.append(rec('2', 2));

    const all = await sink.readPending(10);
    expect(all.map((r) => r.id)).toEqual(['1', '2', '3']);

    const limited = await sink.readPending(2);
    expect(limited.map((r) => r.id)).toEqual(['1', '2']);

    // The web-only syncState marker must not leak into handed-out records.
    expect((all[0] as Record<string, unknown>).syncState).toBeUndefined();
  });

  test('markSynced removes records from the pending set and is idempotent', async () => {
    const { createLocalSink } = await import('../sink');
    const sink = createLocalSink();

    await sink.append(rec('1', 1));
    await sink.append(rec('2', 2));
    await sink.append(rec('3', 3));

    await sink.markSynced(['1', '2']);
    expect((await sink.readPending(10)).map((r) => r.id)).toEqual(['3']);

    // Re-marking the same ids changes nothing (idempotent).
    await sink.markSynced(['1', '2']);
    expect((await sink.readPending(10)).map((r) => r.id)).toEqual(['3']);

    // Empty id list is a safe no-op.
    await sink.markSynced([]);
    expect((await sink.readPending(10)).map((r) => r.id)).toEqual(['3']);
  });

  test('newly appended records are pending and re-appear in the outbox', async () => {
    const { createLocalSink } = await import('../sink');
    const sink = createLocalSink();

    await sink.append(rec('1', 1));
    await sink.markSynced(['1']);
    expect(await sink.readPending(10)).toHaveLength(0);

    // A later write must show up as pending again.
    await sink.append(rec('2', 2));
    expect((await sink.readPending(10)).map((r) => r.id)).toEqual(['2']);
  });
});
