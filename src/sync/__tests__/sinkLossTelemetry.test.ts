/**
 * The web mutation log can lose records in two places, and both used to be
 * completely silent:
 *
 *   1. Ring-buffer eviction. The buffer is capped at WEB_CAP (5000) and evicts
 *      from the HEAD by position — it does not care whether the record it is
 *      discarding was ever pushed. A record still marked `pending` is un-synced
 *      local history, and dropping it is permanent loss.
 *   2. localStorage quota. On QuotaExceededError the writer sheds the oldest 20%
 *      and retries once; if that still fails it gives up so the primary write is
 *      never broken.
 *
 * Neither path is being changed here — the eviction policy is deliberately left
 * alone. These tests pin the TELEMETRY, so the loss is measurable in the field
 * before anyone argues about the policy. `sync.log.evicted{state=pending}` > 0 is
 * the signal that the cap (or the eviction order) actually needs to change.
 */
import { Platform } from 'react-native';
import { getCounter, resetMetrics } from '@/observability/metrics';
import { createLocalSink } from '../sink';
import type { MutationRecord } from '../mutationLog';

const WEB_KEY = 'lifeos_mutation_log';
const WEB_CAP = 5000;

function installLocalStorage(): { clear: () => void; store: Map<string, string> } {
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
  return { clear: () => store.clear(), store };
}

function record(n: number): MutationRecord {
  return {
    id: `m${n}`,
    entity: 'goals',
    entityId: `g${n}`,
    op: 'update',
    before: null,
    after: { title: `t${n}` },
    fields: ['title'],
    ts: `2026-09-29T00:00:00.000Z`,
    lamport: n,
    deviceId: 'dev-1',
    userId: 'u1',
    prevHash: null,
    hash: `h${n}`,
  } as unknown as MutationRecord;
}

/** Seed the buffer at exactly the cap, with a known syncState on every entry. */
function seedAtCap(state: 'pending' | 'acked'): void {
  const buf = Array.from({ length: WEB_CAP }, (_, i) => ({ ...record(i), syncState: state }));
  localStorage.setItem(WEB_KEY, JSON.stringify(buf));
}

describe('web sink — loss telemetry', () => {
  let cleanup: { clear: () => void; store: Map<string, string> };

  beforeEach(() => {
    Platform.OS = 'web' as typeof Platform.OS;
    cleanup = installLocalStorage();
    resetMetrics();
  });

  afterEach(() => {
    cleanup.clear();
    Platform.OS = 'node' as typeof Platform.OS;
    resetMetrics();
  });

  it('counts evicted UN-PUSHED records separately — this is real data loss', async () => {
    seedAtCap('pending');
    const sink = createLocalSink();

    await sink.append(record(WEB_CAP + 1));
    await sink.append(record(WEB_CAP + 2));
    await sink.append(record(WEB_CAP + 3));

    expect(getCounter('sync.log.evicted', { state: 'pending' })).toBe(3);
    expect(getCounter('sync.log.evicted', { state: 'acked' })).toBe(0);
  });

  it('counts evicted ACKED records under a different tag — that loss is benign', async () => {
    seedAtCap('acked');
    const sink = createLocalSink();

    await sink.append(record(WEB_CAP + 1));

    expect(getCounter('sync.log.evicted', { state: 'acked' })).toBe(1);
    expect(getCounter('sync.log.evicted', { state: 'pending' })).toBe(0);
  });

  it('stays silent when nothing is evicted', async () => {
    const sink = createLocalSink();

    await sink.append(record(1));
    await sink.append(record(2));

    expect(getCounter('sync.log.evicted', { state: 'pending' })).toBe(0);
    expect(getCounter('sync.log.quota_shed')).toBe(0);
  });

  it('reports the shed batch and the un-pushed share when the quota is exceeded', async () => {
    seedAtCap('pending');
    const sink = createLocalSink();

    // Fail the next write once (QuotaExceededError), then let the retry through.
    const real = localStorage.setItem.bind(localStorage);
    let failed = false;
    localStorage.setItem = (k: string, v: string) => {
      if (!failed && k === WEB_KEY) {
        failed = true;
        throw new Error('QuotaExceededError');
      }
      real(k, v);
    };

    await sink.append(record(WEB_CAP + 1));
    localStorage.setItem = real;

    // 20% of the buffer is shed on the retry path...
    expect(getCounter('sync.log.quota_shed')).toBe(Math.floor(WEB_CAP * 0.2));
    // ...and every shed row was un-pushed, so it is attributed as such.
    expect(getCounter('sync.log.evicted', { state: 'pending', cause: 'quota' })).toBe(
      Math.floor(WEB_CAP * 0.2),
    );
  });

  it('reports a give-up when even the post-shed write fails', async () => {
    seedAtCap('pending');
    const sink = createLocalSink();

    const real = localStorage.setItem.bind(localStorage);
    localStorage.setItem = (k: string, v: string) => {
      if (k === WEB_KEY) throw new Error('QuotaExceededError');
      real(k, v);
    };

    // Must not throw: a logging failure may never break the primary write.
    await expect(sink.append(record(WEB_CAP + 1))).resolves.toBeUndefined();
    localStorage.setItem = real;

    expect(getCounter('sync.log.write_failed')).toBe(1);
  });
});
