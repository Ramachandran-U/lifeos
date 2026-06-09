import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useActivityFeed } from '../useActivityFeed';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockReadAllWithState = jest.fn();
const mockGetEntityHistory = jest.fn();
const mockRestoreEntityTo = jest.fn();
const mockGetDeviceId = jest.fn();
const mockBuildActivityFeed = jest.fn();

jest.mock('@/sync/sink', () => ({
  getLocalSink: () => ({ readAllWithState: mockReadAllWithState }),
}));
jest.mock('@/sync/history', () => ({
  getEntityHistory: (...args: unknown[]) => mockGetEntityHistory(...args),
  restoreEntityTo: (...args: unknown[]) => mockRestoreEntityTo(...args),
}));
jest.mock('@/utils/telemetry', () => ({
  getDeviceId: (...args: unknown[]) => mockGetDeviceId(...args),
}));
jest.mock('@/sync/activityFeed', () => ({
  buildActivityFeed: (...args: unknown[]) => mockBuildActivityFeed(...args),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fakeDay = { date: '2026-06-09', events: [] };

function silentMocks() {
  mockReadAllWithState.mockResolvedValue([]);
  mockGetDeviceId.mockResolvedValue('device-1');
  mockBuildActivityFeed.mockReturnValue([fakeDay]);
}

beforeEach(() => {
  jest.clearAllMocks();
  silentMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useActivityFeed', () => {
  it('starts in loading state', () => {
    const { result } = renderHook(() => useActivityFeed());
    expect(result.current.status).toBe('loading');
  });

  it('transitions to ready after the initial load', async () => {
    const { result } = renderHook(() => useActivityFeed());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.days).toEqual([fakeDay]);
    expect(result.current.error).toBeNull();
  });

  it('passes rows and deviceId to buildActivityFeed', async () => {
    const fakeRow = { record: { id: 'r1', entity: 'goal' } };
    mockReadAllWithState.mockResolvedValue([fakeRow]);
    mockGetDeviceId.mockResolvedValue('dev-abc');

    const { result } = renderHook(() => useActivityFeed());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(mockBuildActivityFeed).toHaveBeenCalledWith(
      [fakeRow.record],
      'dev-abc',
      expect.any(Function),
    );
  });

  it('transitions to error when readAllWithState rejects', async () => {
    mockReadAllWithState.mockRejectedValue(new Error('sink unavailable'));
    const { result } = renderHook(() => useActivityFeed());
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe('sink unavailable');
  });

  it('reload() re-fetches and returns to ready', async () => {
    const { result } = renderHook(() => useActivityFeed());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    mockBuildActivityFeed.mockReturnValue([fakeDay, fakeDay]);
    await act(async () => { await result.current.reload(); });

    expect(result.current.status).toBe('ready');
    expect(result.current.days).toHaveLength(2);
  });

  it('loadHistory delegates to getEntityHistory', async () => {
    mockGetEntityHistory.mockResolvedValue([{ seq: 1 }]);
    const { result } = renderHook(() => useActivityFeed());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    let entries: unknown;
    await act(async () => {
      entries = await result.current.loadHistory('goal', 'g1');
    });
    expect(mockGetEntityHistory).toHaveBeenCalledWith('goal', 'g1');
    expect(entries).toEqual([{ seq: 1 }]);
  });

  it('restore() calls restoreEntityTo then reloads', async () => {
    mockRestoreEntityTo.mockResolvedValue({ id: 'g1' });
    const { result } = renderHook(() => useActivityFeed());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    let restored: boolean | undefined;
    await act(async () => {
      restored = await result.current.restore('goal', 'g1', { seq: 2 });
    });

    expect(mockRestoreEntityTo).toHaveBeenCalledWith('goal', 'g1', { seq: 2 });
    expect(restored).toBe(true);
    // reload was called again after restore
    expect(mockReadAllWithState).toHaveBeenCalledTimes(2);
  });

  it('restore() returns false when restoreEntityTo returns null', async () => {
    mockRestoreEntityTo.mockResolvedValue(null);
    const { result } = renderHook(() => useActivityFeed());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    let restored: boolean | undefined;
    await act(async () => {
      restored = await result.current.restore('goal', 'g1', { seq: 1 });
    });
    expect(restored).toBe(false);
  });
});
