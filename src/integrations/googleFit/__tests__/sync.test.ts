/**
 * syncAndPersistFit — the shared "sync Google Fit + persist" path used by both
 * the Health screen and the voice agent's syncGoogleFit tool. Mocks the REST
 * client + the stores/queries it writes through, and asserts the returned
 * summary plus the persistence side-effects across the full and empty branches.
 */

const mockSyncFit = jest.fn();
const mockCreateHealthLog = jest.fn();
const mockTriggerStreak = jest.fn();
const mockSetSync = jest.fn();
const mockGetUser = jest.fn(() => ({ sleepTargetHours: 8 }));
const mockRecovery = jest.fn(() => ({ hasData: true, score: 72 }));

jest.mock('../client', () => ({ syncFitDailyData: mockSyncFit }));
jest.mock('@/db/queries/health', () => ({ createHealthLog: mockCreateHealthLog }));
jest.mock('@/db/queries/users', () => ({ getUser: mockGetUser }));
jest.mock('@/utils/recovery', () => ({ recoveryFromFitDays: mockRecovery }));
jest.mock('@/store/useFitSyncStore', () => ({ useFitSyncStore: { getState: () => ({ setSync: mockSetSync }) } }));
jest.mock('@/store/useGameStore', () => ({ useGameStore: { getState: () => ({ triggerStreak: mockTriggerStreak }) } }));
jest.mock('@/store/useUserStore', () => ({ useUserStore: { getState: () => ({ userId: 'u1' }) } }));

import { syncAndPersistFit } from '../sync';

const day = (date: string, steps: number, sleepMins: number, weightKg: number | null) => ({
  date, steps, sleep: { awake: 0, light: 0, deep: 0, rem: 0, total: sleepMins }, weightKg,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockReturnValue({ sleepTargetHours: 8 });
  mockRecovery.mockReturnValue({ hasData: true, score: 72 });
});

describe('syncAndPersistFit', () => {
  it('persists weight/sleep/recovery + the workout streak and summarises the window', async () => {
    mockSyncFit.mockResolvedValue({
      days: [day('2026-06-01', 5000, 420, null), day('2026-06-02', 8000, 480, 72)],
      workouts: [{ date: '2026-06-02' }],
      errors: [],
    });

    const summary = await syncAndPersistFit('client-id', 14);

    expect(summary.daysSynced).toBe(2);
    expect(summary.totalSteps).toBe(13000);
    expect(summary.workouts).toBe(1);
    expect(summary.latestWeightKg).toBe(72);
    expect(summary.recoveryScore).toBe(72);
    expect(summary.avgSleepHours).toBe(7.5); // (7 + 8) / 2
    expect(summary.errors).toEqual([]);

    expect(mockSetSync).toHaveBeenCalledTimes(1);
    // weight (1) + sleep (2 days) + recovery (1) = 4 health logs
    expect(mockCreateHealthLog).toHaveBeenCalledTimes(4);
    expect(mockTriggerStreak).toHaveBeenCalledWith('u1', 'workout');
  });

  it('handles the empty branches: no weight, no sleep, no recovery, no workout', async () => {
    mockRecovery.mockReturnValue({ hasData: false, score: 0 });
    mockSyncFit.mockResolvedValue({
      days: [day('2026-06-01', 100, 0, null)],
      workouts: [],
      errors: ['one bucket failed'],
    });

    const summary = await syncAndPersistFit('client-id', 7);

    expect(summary.latestWeightKg).toBeNull();
    expect(summary.avgSleepHours).toBeNull();
    expect(summary.recoveryScore).toBeNull();
    expect(summary.workouts).toBe(0);
    expect(summary.errors).toEqual(['one bucket failed']);
    expect(mockCreateHealthLog).not.toHaveBeenCalled();
    expect(mockTriggerStreak).not.toHaveBeenCalled();
  });
});
