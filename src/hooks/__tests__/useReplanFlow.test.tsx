import { renderHook, act } from '@testing-library/react-native';
import { useReplanFlow } from '../useReplanFlow';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockRebalance = jest.fn();
const mockIsRecoveryLow = jest.fn();
const mockGenerateAndSaveWeek = jest.fn();
const mockGetUserProfile = jest.fn();
const mockGetReflectionByDate = jest.fn();
const mockGetLatestSleepHours = jest.fn();
const mockGetLatestRecoveryScore = jest.fn();
const mockTrack = jest.fn();

jest.mock('@/ai/replanApply', () => ({
  rebalanceRestOfToday: (...args: unknown[]) => mockRebalance(...args),
  isRecoveryLow: (...args: unknown[]) => mockIsRecoveryLow(...args),
  generateAndSaveWeek: (...args: unknown[]) => mockGenerateAndSaveWeek(...args),
}));
jest.mock('@/db/queries/userProfile', () => ({
  getUserProfile: (...args: unknown[]) => mockGetUserProfile(...args),
}));
jest.mock('@/db/queries/reflections', () => ({
  getReflectionByDate: (...args: unknown[]) => mockGetReflectionByDate(...args),
}));
jest.mock('@/db/queries/health', () => ({
  getLatestSleepHours: (...args: unknown[]) => mockGetLatestSleepHours(...args),
  getLatestRecoveryScore: (...args: unknown[]) => mockGetLatestRecoveryScore(...args),
}));
jest.mock('@/utils/telemetry', () => ({
  track: (...args: unknown[]) => mockTrack(...args),
  EVENTS: { routineReplanned: 'routine_replanned' },
}));
// RECOVERY_SOFTEN_THRESHOLD is a constant — stub returns a value (0.4)
jest.mock('@/utils/recovery', () => ({ RECOVERY_SOFTEN_THRESHOLD: 0.4 }));
jest.mock('@/ai/types', () => ({
  emptyUserProfile: () => ({ source: 'form', version: 1 }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BASE_ARGS = {
  userId: 'u1',
  today: '2026-06-09',
  primaryDomains: ['health', 'career'],
  skippedCount: 0,
  onboardingV2: true,
  refresh: jest.fn(),
};

function silentMocks() {
  mockGetUserProfile.mockResolvedValue({ source: 'chat', version: 1 });
  mockGetReflectionByDate.mockReturnValue(null);
  mockGetLatestSleepHours.mockReturnValue(null);
  mockGetLatestRecoveryScore.mockReturnValue(null);
  mockIsRecoveryLow.mockReturnValue(false);
  mockRebalance.mockResolvedValue({ rationale: 'All good.', changeCount: 2 });
  mockGenerateAndSaveWeek.mockResolvedValue(undefined);
}

beforeEach(() => {
  jest.clearAllMocks();
  silentMocks();
  BASE_ARGS.refresh = jest.fn();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useReplanFlow', () => {
  describe('showReplanCta', () => {
    it('is true when onboardingV2 and skippedCount > 0', () => {
      const { result } = renderHook(() =>
        useReplanFlow({ ...BASE_ARGS, skippedCount: 2 }),
      );
      expect(result.current.showReplanCta).toBe(true);
    });

    it('is false when skippedCount is 0', () => {
      const { result } = renderHook(() =>
        useReplanFlow({ ...BASE_ARGS, skippedCount: 0 }),
      );
      expect(result.current.showReplanCta).toBe(false);
    });

    it('is false when onboardingV2 is false', () => {
      const { result } = renderHook(() =>
        useReplanFlow({ ...BASE_ARGS, skippedCount: 3, onboardingV2: false }),
      );
      expect(result.current.showReplanCta).toBe(false);
    });
  });

  describe('handleReplan', () => {
    it('calls rebalanceRestOfToday and sets rationale on success', async () => {
      const { result } = renderHook(() => useReplanFlow(BASE_ARGS));
      await act(async () => { await result.current.handleReplan(); });
      expect(mockRebalance).toHaveBeenCalledTimes(1);
      expect(result.current.rationale).toBe('All good.');
    });

    it('shows "no changes needed" when changeCount is 0', async () => {
      mockRebalance.mockResolvedValue({ rationale: 'Balanced.', changeCount: 0 });
      const { result } = renderHook(() => useReplanFlow(BASE_ARGS));
      await act(async () => { await result.current.handleReplan(); });
      expect(result.current.rationale).toBe('Looks balanced — no changes needed.');
    });

    it('calls refresh() after a successful replan', async () => {
      const { result } = renderHook(() => useReplanFlow(BASE_ARGS));
      await act(async () => { await result.current.handleReplan(); });
      expect(BASE_ARGS.refresh).toHaveBeenCalled();
    });

    it('sets rationale to error message on failure', async () => {
      mockRebalance.mockRejectedValue(new Error('planner failed'));
      const { result } = renderHook(() => useReplanFlow(BASE_ARGS));
      await act(async () => { await result.current.handleReplan(); });
      expect(result.current.rationale).toBe('planner failed');
    });

    it('sets rationale to "No profile" message when profile is null', async () => {
      mockGetUserProfile.mockResolvedValue(null);
      const { result } = renderHook(() => useReplanFlow(BASE_ARGS));
      await act(async () => { await result.current.handleReplan(); });
      expect(result.current.rationale).toContain('No profile yet');
      expect(mockRebalance).not.toHaveBeenCalled();
    });

    it('no-ops when userId is null', async () => {
      const { result } = renderHook(() =>
        useReplanFlow({ ...BASE_ARGS, userId: null }),
      );
      await act(async () => { await result.current.handleReplan(); });
      expect(mockGetUserProfile).not.toHaveBeenCalled();
    });

    it('softens for recovery when recoveryScore is below threshold', async () => {
      mockGetLatestRecoveryScore.mockReturnValue(0.2); // below 0.4
      const { result } = renderHook(() => useReplanFlow(BASE_ARGS));
      await act(async () => { await result.current.handleReplan(); });
      const call = mockRebalance.mock.calls[0]?.[0];
      expect(call?.softenForRecovery).toBe(true);
    });

    it('fires track(EVENTS.routineReplanned) with soften and changeCount', async () => {
      const { result } = renderHook(() => useReplanFlow(BASE_ARGS));
      await act(async () => { await result.current.handleReplan(); });
      expect(mockTrack).toHaveBeenCalledWith(
        'routine_replanned',
        expect.objectContaining({ soften: false, changes: 2 }),
      );
    });
  });

  describe('handlePlanWeek', () => {
    it('calls generateAndSaveWeek with correct args', async () => {
      const { result } = renderHook(() => useReplanFlow(BASE_ARGS));
      await act(async () => { await result.current.handlePlanWeek(); });
      expect(mockGenerateAndSaveWeek).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u1',
          startDate: '2026-06-09',
          primaryDomains: ['health', 'career'],
        }),
      );
    });

    it('sets rationale to success message and calls refresh on success', async () => {
      const { result } = renderHook(() => useReplanFlow(BASE_ARGS));
      await act(async () => { await result.current.handlePlanWeek(); });
      expect(result.current.rationale).toBe('Your next 7 days are planned.');
      expect(BASE_ARGS.refresh).toHaveBeenCalled();
    });

    it('sets rationale to error message on failure', async () => {
      mockGenerateAndSaveWeek.mockRejectedValue(new Error('week plan timeout'));
      const { result } = renderHook(() => useReplanFlow(BASE_ARGS));
      await act(async () => { await result.current.handlePlanWeek(); });
      expect(result.current.rationale).toBe('week plan timeout');
    });

    it('uses emptyUserProfile when getUserProfile returns null', async () => {
      mockGetUserProfile.mockResolvedValue(null);
      const { result } = renderHook(() => useReplanFlow(BASE_ARGS));
      await act(async () => { await result.current.handlePlanWeek(); });
      // Should not throw; generateAndSaveWeek still called with the fallback profile
      expect(mockGenerateAndSaveWeek).toHaveBeenCalledWith(
        expect.objectContaining({ profile: { source: 'form', version: 1 } }),
      );
    });

    it('no-ops when userId is null', async () => {
      const { result } = renderHook(() =>
        useReplanFlow({ ...BASE_ARGS, userId: null }),
      );
      await act(async () => { await result.current.handlePlanWeek(); });
      expect(mockGenerateAndSaveWeek).not.toHaveBeenCalled();
    });
  });
});
