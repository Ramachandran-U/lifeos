/**
 * Sync engine tests (P1-T5/T6) — push/pull orchestration.
 *
 * Covers the safety contract the devil's-advocate flagged: gating (flags off /
 * signed out / no token), the push drain loop (batching, partial-ack leaves the
 * rest pending, 429 + 5xx stop the loop without throwing), the pull loop
 * (cursor advance, own-device dedup, no-forward-progress stop, idempotency via
 * the reducer), and start/stop wiring. All transport/stores/sink are mocked;
 * `_resetSyncEngineForTests` clears module state between cases.
 */
import type { MutationRecord } from '../mutationLog';

let mockFlagsOn = true;
let mockUserId: string | null = 'u1';
const mockSyncStore = { setPhase: jest.fn(), noteSynced: jest.fn(), markApplied: jest.fn() };
const mockSink = {
  readPending: jest.fn(),
  markSynced: jest.fn(),
  getCursor: jest.fn(),
  setCursor: jest.fn(),
  count: jest.fn(async () => 0),
  readAllWithState: jest.fn(async () => []),
  applyCompaction: jest.fn(),
};

jest.mock('@/store/useFlagStore', () => ({ useFlagStore: { getState: () => ({ isEnabled: () => mockFlagsOn }) } }));
jest.mock('@/store/useUserStore', () => ({ useUserStore: { getState: () => ({ userId: mockUserId }) } }));
jest.mock('@/store/useSyncStore', () => ({ useSyncStore: { getState: () => mockSyncStore } }));
jest.mock('@/integrations/supabase/session', () => ({ getSupabaseAccessToken: jest.fn() }));
jest.mock('@/utils/telemetry', () => ({ getDeviceId: jest.fn(async () => 'myDevice') }));
jest.mock('@/ai/tracing', () => ({ withSpan: (_n: string, fn: () => unknown) => fn() }));
jest.mock('@/observability/metrics', () => ({ increment: jest.fn(), gauge: jest.fn() }));
jest.mock('../reducer', () => ({ applyRemoteMutation: jest.fn() }));
jest.mock('../compaction', () => ({
  planCompaction: jest.fn(() => ({ deleteIds: [], checkpoints: [] })),
  COMMUTATIVE_ENTITIES: new Set<string>(),
}));
jest.mock('../sink', () => ({ getLocalSink: () => mockSink }));
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
}));

import { pushPending, pullRemote, syncEngine, _resetSyncEngineForTests } from '../engine';
import { getSupabaseAccessToken } from '@/integrations/supabase/session';
import { applyRemoteMutation } from '../reducer';
import { AppState } from 'react-native';

const mToken = getSupabaseAccessToken as jest.Mock;
const mApply = applyRemoteMutation as jest.Mock;

function rec(id: string, deviceId = 'remote'): MutationRecord {
  return {
    id, entity: 'goals', entityId: `g${id}`, op: 'insert', before: null,
    after: { id: `g${id}` }, fields: [], ts: 't', lamport: Number(id) || 1,
    deviceId, userId: 'u1', prevHash: null, hash: `h${id}`,
  };
}

function httpOnce(status: number, body: unknown) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  _resetSyncEngineForTests();
  // Reset the sink's queued once-values (clearAllMocks leaves them) and set
  // harmless defaults so an unconsumed queue can't leak into the next test.
  mockSink.readPending.mockReset().mockResolvedValue([]);
  mockSink.getCursor.mockReset().mockResolvedValue(0);
  mockSink.setCursor.mockReset();
  mockSink.markSynced.mockReset();
  mockSink.count.mockReset().mockResolvedValue(0);
  mockSink.readAllWithState.mockReset().mockResolvedValue([]);
  mockSink.applyCompaction.mockReset();
  mockFlagsOn = true;
  mockUserId = 'u1';
  mToken.mockResolvedValue('tok');
  mApply.mockResolvedValue(true);
  global.fetch = jest.fn();
});

// ─── pushPending ────────────────────────────────────────────────────────────
describe('pushPending', () => {
  test('gating: disabled flags / signed out / no token are no-ops', async () => {
    mockFlagsOn = false;
    expect(await pushPending()).toEqual({ pushed: 0, skipped: 'disabled' });

    mockFlagsOn = true; mockUserId = null;
    expect(await pushPending()).toEqual({ pushed: 0, skipped: 'signed_out' });

    mockUserId = 'u1'; mToken.mockResolvedValue(null);
    expect(await pushPending()).toEqual({ pushed: 0, skipped: 'signed_out' });
  });

  test('drains pending in batches and marks acked', async () => {
    mockSink.readPending.mockResolvedValueOnce([rec('1'), rec('2')]).mockResolvedValueOnce([]);
    httpOnce(200, { acked: ['1', '2'] });

    const out = await pushPending();
    expect(out.pushed).toBe(2);
    expect(mockSink.markSynced).toHaveBeenCalledWith(['1', '2']);
  });

  test('partial ack: only acked are marked; the rest stay pending', async () => {
    // a short batch (< PUSH_BATCH) ends the loop after one round
    mockSink.readPending.mockResolvedValueOnce([rec('1'), rec('2'), rec('3')]);
    httpOnce(200, { acked: ['1', '2'] }); // server didn't ack '3'

    const out = await pushPending();
    expect(out.pushed).toBe(2);
    expect(mockSink.markSynced).toHaveBeenCalledWith(['1', '2']);
  });

  test('429 rate-limit stops the loop without throwing', async () => {
    mockSink.readPending.mockResolvedValueOnce([rec('1')]);
    httpOnce(429, { error: 'slow down' });
    const out = await pushPending();
    expect(out.pushed).toBe(0);
    expect(mockSink.markSynced).not.toHaveBeenCalled();
  });

  test('5xx error stops the loop without throwing', async () => {
    mockSink.readPending.mockResolvedValueOnce([rec('1')]);
    httpOnce(500, 'boom');
    await expect(pushPending()).resolves.toEqual({ pushed: 0 });
  });
});

// ─── pullRemote ─────────────────────────────────────────────────────────────
describe('pullRemote', () => {
  test('gating: disabled / signed out / no token are no-ops', async () => {
    mockFlagsOn = false;
    expect(await pullRemote()).toEqual({ applied: 0, skipped: 'disabled' });
    mockFlagsOn = true; mockUserId = null;
    expect(await pullRemote()).toEqual({ applied: 0, skipped: 'signed_out' });
  });

  test('applies remote mutations, skips own-device records, advances the cursor', async () => {
    mockSink.getCursor.mockResolvedValueOnce(0).mockResolvedValueOnce(5);
    httpOnce(200, { mutations: [rec('1', 'remote'), rec('2', 'myDevice')], cursor: 5 }); // 2 is ours
    httpOnce(200, { mutations: [], cursor: 5 }); // caught up

    const out = await pullRemote();
    expect(out.applied).toBe(1); // only the remote one
    expect(mApply).toHaveBeenCalledTimes(1); // own-device record skipped before apply
    expect(mockSink.setCursor).toHaveBeenCalledWith(5);
    expect(mockSyncStore.noteSynced).toHaveBeenCalled();
    expect(mockSyncStore.markApplied).toHaveBeenCalledWith(1);
  });

  test('stops when the cursor does not advance (no infinite loop)', async () => {
    mockSink.getCursor.mockResolvedValue(5);
    httpOnce(200, { mutations: [rec('1')], cursor: 5 }); // cursor == since ⇒ stop after applying
    const out = await pullRemote();
    expect(out.applied).toBe(1);
    expect(mockSink.setCursor).not.toHaveBeenCalled();
  });

  test('a transport error is swallowed (applied: 0)', async () => {
    mockSink.getCursor.mockResolvedValue(0);
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network'));
    await expect(pullRemote()).resolves.toEqual({ applied: 0 });
  });
});

// ─── lifecycle ──────────────────────────────────────────────────────────────
describe('syncEngine start/stop/flush/status', () => {
  test('start wires a timer + AppState listener (idempotent); stop releases them', () => {
    jest.useFakeTimers();
    const remove = jest.fn();
    (AppState.addEventListener as jest.Mock).mockReturnValue({ remove });

    syncEngine.start();
    syncEngine.start(); // idempotent — second call no-ops
    expect(AppState.addEventListener).toHaveBeenCalledTimes(1);
    expect(syncEngine.status().started).toBe(true);

    syncEngine.stop();
    expect(remove).toHaveBeenCalled();
    expect(syncEngine.status().started).toBe(false);
    jest.useRealTimers();
  });

  test('flush runs push then pull', async () => {
    mockSink.readPending.mockResolvedValue([]);
    mockSink.getCursor.mockResolvedValue(0);
    httpOnce(200, { mutations: [], cursor: 0 });
    const out = await syncEngine.flush();
    expect(out).toEqual({ pushed: 0, applied: 0 });
  });
});
