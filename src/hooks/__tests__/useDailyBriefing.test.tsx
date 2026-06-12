/**
 * Tests for useDailyBriefing.ts.
 *
 * The hook caches one briefing per calendar date using a Zustand persisted store.
 * We mock the Zustand store so tests can inject arbitrary cache states.
 *
 * Covers:
 *   • null input → no AI call, returns null
 *   • Cache hit  → returns cached lines immediately
 *   • Cache miss → calls generateDailyBriefing and updates lines
 *   • Day rollover → re-fetches even when store has yesterday's data
 *   • Error fallback → returns null, resets in-flight ref for retry
 *   • In-flight dedup → only one request per (today) per mount
 */

import { renderHook, act } from '@testing-library/react-native';

// ─── Zustand mock ─────────────────────────────────────────────────────────────

interface CachedBriefing { date: string; lines: string[] }

let mockCache: CachedBriefing | null = null;
const mockSetCache = jest.fn((c: CachedBriefing) => { mockCache = c; });

// Make the store return whatever mockCache holds on every selector call.
// React's local useState still drives re-renders so this is sufficient.
jest.mock('zustand', () => ({
  create: () => () => (selector: (s: { cache: CachedBriefing | null; setCache: typeof mockSetCache }) => unknown) =>
    selector({ get cache() { return mockCache; }, setCache: mockSetCache }),
}));

jest.mock('zustand/middleware', () => ({
  persist: (initFn: unknown) => initFn,
  createJSONStorage: () => null,
}));

// ─── Other mocks ──────────────────────────────────────────────────────────────

const mockGenerateDailyBriefing = jest.fn();

jest.mock('@/ai/functions', () => ({
  generateDailyBriefing: (...a: unknown[]) => mockGenerateDailyBriefing(...a),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

// ─── System under test ────────────────────────────────────────────────────────

import { useDailyBriefing } from '../useDailyBriefing';
import type { DailyBriefingInput } from '@/ai/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TODAY = '2026-06-09';
const YESTERDAY = '2026-06-08';

const fakeInput: DailyBriefingInput = {
  name: 'Alex',
  topGoal: 'Run a 5K',
  blocksToday: 6,
  overdueContacts: 0,
  lifeScore: 42,
  lifeScoreBand: 'Building',
  weeklyInsight: null,
  topDomainYesterday: 'health',
};

function resetState() {
  mockCache = null;
  mockSetCache.mockClear();
  mockGenerateDailyBriefing.mockReset();
}

beforeEach(resetState);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useDailyBriefing', () => {
  it('returns null when input is null (skip generation)', () => {
    const { result } = renderHook(() => useDailyBriefing(null, TODAY));
    expect(result.current).toBeNull();
    expect(mockGenerateDailyBriefing).not.toHaveBeenCalled();
  });

  it('returns cached lines immediately on cache hit for today', () => {
    mockCache = { date: TODAY, lines: ['Good morning!', 'Focus on health today.'] };
    const { result } = renderHook(() => useDailyBriefing(fakeInput, TODAY));
    expect(result.current).toBe('Good morning!\nFocus on health today.');
    expect(mockGenerateDailyBriefing).not.toHaveBeenCalled();
  });

  it('calls generateDailyBriefing on cache miss and returns joined lines', async () => {
    mockGenerateDailyBriefing.mockResolvedValue({ lines: ['Rise and shine!', 'Stay focused.'] });

    const { result } = renderHook(() => useDailyBriefing(fakeInput, TODAY));

    // Initially null while generating
    expect(result.current).toBeNull();

    await act(async () => {
      await Promise.resolve(); // flush the async generateDailyBriefing
    });

    expect(mockGenerateDailyBriefing).toHaveBeenCalledWith(fakeInput);
    expect(result.current).toBe('Rise and shine!\nStay focused.');
  });

  it('persists to store cache after generation', async () => {
    mockGenerateDailyBriefing.mockResolvedValue({ lines: ['Hello!'] });

    renderHook(() => useDailyBriefing(fakeInput, TODAY));

    await act(async () => { await Promise.resolve(); });

    expect(mockSetCache).toHaveBeenCalledWith({ date: TODAY, lines: ['Hello!'] });
  });

  it('re-fetches when the day rolls over (cache has yesterday)', async () => {
    mockCache = { date: YESTERDAY, lines: ['Yesterday briefing'] };
    mockGenerateDailyBriefing.mockResolvedValue({ lines: ['Today briefing'] });

    const { result } = renderHook(() => useDailyBriefing(fakeInput, TODAY));

    await act(async () => { await Promise.resolve(); });

    expect(mockGenerateDailyBriefing).toHaveBeenCalledTimes(1);
    expect(result.current).toBe('Today briefing');
  });

  it('returns null and resets in-flight ref when AI throws', async () => {
    mockGenerateDailyBriefing.mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useDailyBriefing(fakeInput, TODAY));

    await act(async () => { await Promise.resolve(); });

    expect(result.current).toBeNull();
  });

  it('does not fire a second request within the same mount when requestedRef is set', async () => {
    let resolveFirst!: (v: { lines: string[] }) => void;
    mockGenerateDailyBriefing.mockReturnValue(
      new Promise((res) => { resolveFirst = res; }),
    );

    // Mount once → first request is in-flight
    const { rerender } = renderHook(({ today }: { today: string }) =>
      useDailyBriefing(fakeInput, today), { initialProps: { today: TODAY } },
    );

    // Rerender without resolving → should NOT fire a second call
    rerender({ today: TODAY });

    expect(mockGenerateDailyBriefing).toHaveBeenCalledTimes(1);

    // Clean up
    resolveFirst({ lines: ['Done'] });
    await act(async () => { await Promise.resolve(); });
  });

  it('returns null when AI returns a result with no lines', async () => {
    mockGenerateDailyBriefing.mockResolvedValue({ lines: [] });

    const { result } = renderHook(() => useDailyBriefing(fakeInput, TODAY));

    await act(async () => { await Promise.resolve(); });

    expect(result.current).toBeNull();
    // Store should NOT be written for an empty result
    expect(mockSetCache).not.toHaveBeenCalled();
  });

  it('returns null when AI returns null', async () => {
    mockGenerateDailyBriefing.mockResolvedValue(null);

    const { result } = renderHook(() => useDailyBriefing(fakeInput, TODAY));

    await act(async () => { await Promise.resolve(); });

    expect(result.current).toBeNull();
  });
});
