/**
 * Tests for profileLearning.ts.
 *
 * Covers:
 *   • computeInferredPreferences — pure computation from mocked DB data
 *   • refreshInferredPreferences — weekly throttle + DB write
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGetEventsLastNDays = jest.fn();
const mockGetRoutineBlocksInRange = jest.fn();
const mockGetUserProfile = jest.fn();
const mockUpsertUserProfile = jest.fn();

jest.mock('@/db/queries/behaviour', () => ({
  getEventsLastNDays: (...a: unknown[]) => mockGetEventsLastNDays(...a),
}));
jest.mock('@/db/queries/routine', () => ({
  getRoutineBlocksInRange: (...a: unknown[]) => mockGetRoutineBlocksInRange(...a),
}));
jest.mock('@/db/queries/userProfile', () => ({
  getUserProfile: (...a: unknown[]) => mockGetUserProfile(...a),
  upsertUserProfile: (...a: unknown[]) => mockUpsertUserProfile(...a),
}));

// ─── System under test ────────────────────────────────────────────────────────

import { computeInferredPreferences, refreshInferredPreferences } from '../profileLearning';
import { emptyUserProfile } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mkEvent(eventType: string, hour: number) {
  return { eventType, hour, module: 'health', createdAt: new Date().toISOString() };
}

function mkBlock(opts: {
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  status: 'completed' | 'skipped' | 'upcoming';
}) {
  return { id: `blk-${Math.random()}`, ...opts };
}

function silentMocks() {
  mockGetEventsLastNDays.mockReturnValue([]);
  mockGetRoutineBlocksInRange.mockReturnValue([]);
  mockGetUserProfile.mockResolvedValue(null);
  mockUpsertUserProfile.mockResolvedValue(undefined);
}

beforeEach(() => {
  jest.clearAllMocks();
  silentMocks();
});

// ─── computeInferredPreferences ───────────────────────────────────────────────

describe('computeInferredPreferences', () => {
  it('returns all-empty preferences when there is no data', () => {
    const { preferences, hasSignal } = computeInferredPreferences();
    expect(preferences.productiveHours).toEqual([]);
    expect(preferences.preferredBlockMinutes).toBeNull();
    expect(preferences.droppedHabits).toEqual([]);
    expect(preferences.preferredRestDays).toEqual([]);
    expect(hasSignal).toBe(false);
  });

  describe('productiveHours', () => {
    it('picks the top 3 hours by completion event count', () => {
      mockGetEventsLastNDays.mockReturnValue([
        mkEvent('block_completed', 9),
        mkEvent('block_completed', 9),
        mkEvent('block_completed', 9),
        mkEvent('block_completed', 14),
        mkEvent('block_completed', 14),
        mkEvent('block_completed', 7),
      ]);
      const { preferences } = computeInferredPreferences();
      expect(preferences.productiveHours[0]).toBe(9);
      expect(preferences.productiveHours[1]).toBe(14);
      expect(preferences.productiveHours[2]).toBe(7);
    });

    it('caps at 3 even when more hours have completions', () => {
      const events = [8, 9, 10, 11, 12].map((h) => mkEvent('block_completed', h));
      mockGetEventsLastNDays.mockReturnValue(events);
      const { preferences } = computeInferredPreferences();
      expect(preferences.productiveHours.length).toBeLessThanOrEqual(3);
    });

    it('ignores non-completed event types', () => {
      mockGetEventsLastNDays.mockReturnValue([
        mkEvent('block_skipped', 9),
        mkEvent('screen_view', 9),
        mkEvent('block_completed', 10),
      ]);
      const { preferences } = computeInferredPreferences();
      expect(preferences.productiveHours).toEqual([10]);
    });

    it('excludes invalid hours (out of 0-23 range)', () => {
      mockGetEventsLastNDays.mockReturnValue([
        { ...mkEvent('block_completed', 25), hour: 25 },
        mkEvent('block_completed', 9),
      ]);
      const { preferences } = computeInferredPreferences();
      expect(preferences.productiveHours).not.toContain(25);
    });
  });

  describe('preferredBlockMinutes', () => {
    it('returns median duration of completed blocks', () => {
      // Three completed blocks: 30min, 45min, 60min → median = 45
      mockGetRoutineBlocksInRange.mockReturnValue([
        mkBlock({ date: '2026-05-01', startTime: '08:00', endTime: '08:30', title: 'A', status: 'completed' }),
        mkBlock({ date: '2026-05-02', startTime: '09:00', endTime: '09:45', title: 'B', status: 'completed' }),
        mkBlock({ date: '2026-05-03', startTime: '10:00', endTime: '11:00', title: 'C', status: 'completed' }),
      ]);
      const { preferences } = computeInferredPreferences();
      expect(preferences.preferredBlockMinutes).toBe(45);
    });

    it('returns null when there are no completed blocks', () => {
      mockGetRoutineBlocksInRange.mockReturnValue([
        mkBlock({ date: '2026-05-01', startTime: '08:00', endTime: '09:00', title: 'X', status: 'skipped' }),
      ]);
      const { preferences } = computeInferredPreferences();
      expect(preferences.preferredBlockMinutes).toBeNull();
    });

    it('ignores blocks with duration > 240 min (sanity cap)', () => {
      mockGetRoutineBlocksInRange.mockReturnValue([
        mkBlock({ date: '2026-05-01', startTime: '00:00', endTime: '05:00', title: 'Long', status: 'completed' }), // 300min
        mkBlock({ date: '2026-05-02', startTime: '09:00', endTime: '10:00', title: 'Short', status: 'completed' }), // 60min
      ]);
      const { preferences } = computeInferredPreferences();
      expect(preferences.preferredBlockMinutes).toBe(60);
    });

    it('uses even-count median (average of two middle values)', () => {
      // Durations: 20, 40 → median = 30
      mockGetRoutineBlocksInRange.mockReturnValue([
        mkBlock({ date: '2026-05-01', startTime: '08:00', endTime: '08:20', title: 'A', status: 'completed' }),
        mkBlock({ date: '2026-05-02', startTime: '09:00', endTime: '09:40', title: 'B', status: 'completed' }),
      ]);
      const { preferences } = computeInferredPreferences();
      expect(preferences.preferredBlockMinutes).toBe(30);
    });
  });

  describe('droppedHabits', () => {
    it('returns titles where skipped ≥ 3 and skipped > completed', () => {
      mockGetRoutineBlocksInRange.mockReturnValue([
        mkBlock({ date: '2026-05-01', startTime: '08:00', endTime: '09:00', title: 'Meditate', status: 'skipped' }),
        mkBlock({ date: '2026-05-02', startTime: '08:00', endTime: '09:00', title: 'Meditate', status: 'skipped' }),
        mkBlock({ date: '2026-05-03', startTime: '08:00', endTime: '09:00', title: 'Meditate', status: 'skipped' }),
        mkBlock({ date: '2026-05-04', startTime: '08:00', endTime: '09:00', title: 'Meditate', status: 'completed' }),
      ]);
      const { preferences } = computeInferredPreferences();
      expect(preferences.droppedHabits).toContain('Meditate');
    });

    it('excludes habits where skipped < 3', () => {
      mockGetRoutineBlocksInRange.mockReturnValue([
        mkBlock({ date: '2026-05-01', startTime: '08:00', endTime: '09:00', title: 'Yoga', status: 'skipped' }),
        mkBlock({ date: '2026-05-02', startTime: '08:00', endTime: '09:00', title: 'Yoga', status: 'skipped' }),
      ]);
      const { preferences } = computeInferredPreferences();
      expect(preferences.droppedHabits).not.toContain('Yoga');
    });

    it('excludes habits where skipped ≤ completed', () => {
      mockGetRoutineBlocksInRange.mockReturnValue([
        mkBlock({ date: '2026-05-01', startTime: '08:00', endTime: '09:00', title: 'Run', status: 'skipped' }),
        mkBlock({ date: '2026-05-02', startTime: '08:00', endTime: '09:00', title: 'Run', status: 'skipped' }),
        mkBlock({ date: '2026-05-03', startTime: '08:00', endTime: '09:00', title: 'Run', status: 'skipped' }),
        mkBlock({ date: '2026-05-04', startTime: '08:00', endTime: '09:00', title: 'Run', status: 'completed' }),
        mkBlock({ date: '2026-05-05', startTime: '08:00', endTime: '09:00', title: 'Run', status: 'completed' }),
        mkBlock({ date: '2026-05-06', startTime: '08:00', endTime: '09:00', title: 'Run', status: 'completed' }),
      ]);
      // skipped=3, completed=3 → not dropped (skipped NOT > completed)
      const { preferences } = computeInferredPreferences();
      expect(preferences.droppedHabits).not.toContain('Run');
    });

    it('caps at 5 entries', () => {
      const habits = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
      const blocks = habits.flatMap((title) =>
        Array.from({ length: 4 }, (_, i) =>
          mkBlock({ date: `2026-05-0${i + 1}`, startTime: '08:00', endTime: '09:00', title, status: 'skipped' }),
        ),
      );
      mockGetRoutineBlocksInRange.mockReturnValue(blocks);
      const { preferences } = computeInferredPreferences();
      expect(preferences.droppedHabits.length).toBeLessThanOrEqual(5);
    });
  });

  describe('preferredRestDays', () => {
    it('returns the 2 days of week with worst completion rate (min 3 samples)', () => {
      // Mondays (day 1) and Sundays (day 0) will have 0% completion (all skipped)
      // with 3 samples each.
      // Tuesdays (day 2) will have 100% completion.
      const blocks = [
        // 3 Mondays (2026-06-01, 2026-06-08 = Monday)
        mkBlock({ date: '2026-06-01', startTime: '08:00', endTime: '09:00', title: 'A', status: 'skipped' }),
        mkBlock({ date: '2026-06-01', startTime: '10:00', endTime: '11:00', title: 'B', status: 'skipped' }),
        mkBlock({ date: '2026-06-08', startTime: '08:00', endTime: '09:00', title: 'C', status: 'skipped' }),
        // 3 Sundays — 2026-05-31, 2026-06-07
        mkBlock({ date: '2026-05-31', startTime: '08:00', endTime: '09:00', title: 'D', status: 'skipped' }),
        mkBlock({ date: '2026-05-31', startTime: '10:00', endTime: '11:00', title: 'E', status: 'skipped' }),
        mkBlock({ date: '2026-06-07', startTime: '08:00', endTime: '09:00', title: 'F', status: 'skipped' }),
        // 3 Tuesdays — all completed (2026-06-02, 2026-06-09)
        mkBlock({ date: '2026-06-02', startTime: '08:00', endTime: '09:00', title: 'G', status: 'completed' }),
        mkBlock({ date: '2026-06-02', startTime: '10:00', endTime: '11:00', title: 'H', status: 'completed' }),
        mkBlock({ date: '2026-06-09', startTime: '08:00', endTime: '09:00', title: 'I', status: 'completed' }),
      ];
      mockGetRoutineBlocksInRange.mockReturnValue(blocks);
      const { preferences } = computeInferredPreferences();
      // Should be day 0 (Sun) and day 1 (Mon) in some order
      expect(preferences.preferredRestDays).toHaveLength(2);
      expect(preferences.preferredRestDays).toContain(0); // Sunday
      expect(preferences.preferredRestDays).toContain(1); // Monday
    });

    it('excludes days with fewer than 3 samples', () => {
      // Only 2 samples for day 3 (Wednesday)
      mockGetRoutineBlocksInRange.mockReturnValue([
        mkBlock({ date: '2026-06-03', startTime: '08:00', endTime: '09:00', title: 'A', status: 'skipped' }),
        mkBlock({ date: '2026-06-03', startTime: '10:00', endTime: '11:00', title: 'B', status: 'skipped' }),
      ]);
      const { preferences } = computeInferredPreferences();
      expect(preferences.preferredRestDays).not.toContain(3);
    });

    it('returns at most 2 days', () => {
      // Many days with bad rates
      const blocks = [0, 1, 2, 3, 4].flatMap((dow) => {
        // Use known dates for each DOW
        const dates: Record<number, string[]> = {
          0: ['2026-05-31', '2026-06-07', '2026-05-24'],
          1: ['2026-06-01', '2026-06-08', '2026-05-25'],
          2: ['2026-06-02', '2026-06-09', '2026-05-26'],
          3: ['2026-06-03', '2026-05-27', '2026-05-20'],
          4: ['2026-06-04', '2026-05-28', '2026-05-21'],
        };
        return dates[dow]!.map((date) =>
          mkBlock({ date, startTime: '08:00', endTime: '09:00', title: 'X', status: 'skipped' }),
        );
      });
      mockGetRoutineBlocksInRange.mockReturnValue(blocks);
      const { preferences } = computeInferredPreferences();
      expect(preferences.preferredRestDays.length).toBeLessThanOrEqual(2);
    });
  });

  describe('hasSignal', () => {
    it('is true when there are ≥ 10 events', () => {
      mockGetEventsLastNDays.mockReturnValue(
        Array.from({ length: 10 }, (_, i) => mkEvent('block_completed', i)),
      );
      const { hasSignal } = computeInferredPreferences();
      expect(hasSignal).toBe(true);
    });

    it('is true when there are ≥ 10 blocks', () => {
      mockGetRoutineBlocksInRange.mockReturnValue(
        Array.from({ length: 10 }, (_, i) =>
          mkBlock({ date: `2026-05-0${String(i + 1).padStart(2, '0')}`, startTime: '08:00', endTime: '09:00', title: 'X', status: 'skipped' }),
        ),
      );
      const { hasSignal } = computeInferredPreferences();
      expect(hasSignal).toBe(true);
    });

    it('is false with fewer than 10 events and no droppedHabits/productiveHours', () => {
      mockGetEventsLastNDays.mockReturnValue(Array.from({ length: 5 }, () => mkEvent('screen_view', 8)));
      const { hasSignal } = computeInferredPreferences();
      expect(hasSignal).toBe(false);
    });
  });

  it('respects a custom lookbackDays argument', () => {
    computeInferredPreferences(60);
    expect(mockGetEventsLastNDays).toHaveBeenCalledWith(60);
  });
});

// ─── refreshInferredPreferences ───────────────────────────────────────────────

describe('refreshInferredPreferences', () => {
  it('returns null when no profile exists for the user', async () => {
    mockGetUserProfile.mockResolvedValue(null);
    const result = await refreshInferredPreferences('u1');
    expect(result).toBeNull();
    expect(mockUpsertUserProfile).not.toHaveBeenCalled();
  });

  it('skips refresh when last inference was within the weekly window', async () => {
    const recentTs = new Date(Date.now() - 60_000).toISOString(); // 1 min ago
    const profile = {
      ...emptyUserProfile(),
      inferredPreferences: { ...emptyUserProfile().inferredPreferences, lastInferredAt: recentTs },
    };
    mockGetUserProfile.mockResolvedValue(profile);

    const result = await refreshInferredPreferences('u1', false);
    expect(result).toBeNull();
    expect(mockUpsertUserProfile).not.toHaveBeenCalled();
  });

  it('refreshes when last inference was more than a week ago', async () => {
    const oldTs = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const profile = {
      ...emptyUserProfile(),
      inferredPreferences: { ...emptyUserProfile().inferredPreferences, lastInferredAt: oldTs },
    };
    mockGetUserProfile.mockResolvedValue(profile);
    mockUpsertUserProfile.mockResolvedValue(undefined);

    const result = await refreshInferredPreferences('u1', false);
    expect(result).not.toBeNull();
    expect(mockUpsertUserProfile).toHaveBeenCalledTimes(1);
  });

  it('refreshes unconditionally when force=true', async () => {
    const recentTs = new Date(Date.now() - 60_000).toISOString();
    const profile = {
      ...emptyUserProfile(),
      inferredPreferences: { ...emptyUserProfile().inferredPreferences, lastInferredAt: recentTs },
    };
    mockGetUserProfile.mockResolvedValue(profile);
    mockUpsertUserProfile.mockResolvedValue(undefined);

    const result = await refreshInferredPreferences('u1', true);
    expect(result).not.toBeNull();
    expect(mockUpsertUserProfile).toHaveBeenCalledTimes(1);
  });

  it('always stamps lastInferredAt even when hasSignal is false', async () => {
    const profile = emptyUserProfile();
    profile.inferredPreferences.lastInferredAt = new Date(0).toISOString(); // old timestamp
    mockGetUserProfile.mockResolvedValue(profile);
    mockUpsertUserProfile.mockResolvedValue(undefined);

    await refreshInferredPreferences('u1', true);

    const savedProfile = mockUpsertUserProfile.mock.calls[0][1];
    expect(savedProfile.inferredPreferences.lastInferredAt).toBeTruthy();
    expect(Date.parse(savedProfile.inferredPreferences.lastInferredAt)).toBeGreaterThan(Date.now() - 5000);
  });

  it('treats missing lastInferredAt as time 0 (always stale)', async () => {
    const profile = { ...emptyUserProfile(), inferredPreferences: { ...emptyUserProfile().inferredPreferences, lastInferredAt: null } };
    mockGetUserProfile.mockResolvedValue(profile);
    mockUpsertUserProfile.mockResolvedValue(undefined);

    const result = await refreshInferredPreferences('u1', false);
    expect(result).not.toBeNull();
    expect(mockUpsertUserProfile).toHaveBeenCalledTimes(1);
  });
});
