/**
 * Tests for replanApply.ts — the day-replan + week-plan orchestrator.
 *
 * Focus areas:
 *   • isRecoveryLow — pure heuristic, no mocks
 *   • applyReplan   — DB write dispatcher
 *   • rebalanceRestOfToday — DB read → AI → DB write flow
 *   • generateAndSaveWeek — week generation + block persistence
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGetRoutineBlocksByDate = jest.fn();
const mockCreateRoutineBlocks = jest.fn();
const mockDeleteRoutineBlock = jest.fn();
const mockDeleteRoutineBlocksByDate = jest.fn();
const mockUpdateRoutineBlock = jest.fn();
const mockReplanRemainingDay = jest.fn();
const mockGenerateWeekRoutine = jest.fn();
const mockApplyLivePlannerGoals = jest.fn();
const mockGetUser = jest.fn();
const mockGetInterestsByUser = jest.fn();
const mockComputeLastWeekDomainMinutes = jest.fn();

jest.mock('@/db/queries/routine', () => ({
  getRoutineBlocksByDate: (...a: unknown[]) => mockGetRoutineBlocksByDate(...a),
  createRoutineBlocks: (...a: unknown[]) => mockCreateRoutineBlocks(...a),
  deleteRoutineBlock: (...a: unknown[]) => mockDeleteRoutineBlock(...a),
  deleteRoutineBlocksByDate: (...a: unknown[]) => mockDeleteRoutineBlocksByDate(...a),
  updateRoutineBlock: (...a: unknown[]) => mockUpdateRoutineBlock(...a),
}));
jest.mock('@/ai/functions', () => ({
  replanRemainingDay: (...a: unknown[]) => mockReplanRemainingDay(...a),
  generateTomorrowRoutine: jest.fn(),
  generateWeekRoutine: (...a: unknown[]) => mockGenerateWeekRoutine(...a),
}));
// Dynamic imports resolved at test time by jest's module registry.
jest.mock('@/utils/routineBalance', () => ({
  computeLastWeekDomainMinutes: (...a: unknown[]) => mockComputeLastWeekDomainMinutes(...a),
}));
jest.mock('@/ai/routineFromProfile', () => ({
  applyLivePlannerGoals: (...a: unknown[]) => mockApplyLivePlannerGoals(...a),
}));
jest.mock('@/db/queries/users', () => ({
  getUser: (...a: unknown[]) => mockGetUser(...a),
}));
jest.mock('@/db/queries/interests', () => ({
  getInterestsByUser: (...a: unknown[]) => mockGetInterestsByUser(...a),
}));

// ─── System under test ────────────────────────────────────────────────────────

import {
  isRecoveryLow,
  applyReplan,
  rebalanceRestOfToday,
  generateAndSaveWeek,
} from '../replanApply';
import { emptyUserProfile } from '../types';
import type { ReplanRemainingDay } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function silentMocks() {
  mockGetRoutineBlocksByDate.mockReturnValue([]);
  mockCreateRoutineBlocks.mockReturnValue(undefined);
  mockDeleteRoutineBlock.mockReturnValue(undefined);
  mockDeleteRoutineBlocksByDate.mockReturnValue(undefined);
  mockUpdateRoutineBlock.mockReturnValue(undefined);
  mockApplyLivePlannerGoals.mockImplementation((p: unknown) => Promise.resolve(p));
  mockGetUser.mockReturnValue(null);
  mockGetInterestsByUser.mockReturnValue([]);
  mockComputeLastWeekDomainMinutes.mockReturnValue({});
}

beforeEach(() => {
  jest.clearAllMocks();
  silentMocks();
});

// ─── isRecoveryLow ────────────────────────────────────────────────────────────

describe('isRecoveryLow', () => {
  it('returns false when all signals are healthy', () => {
    expect(isRecoveryLow({ lastSleepHours: 8, skippedTodayCount: 0, lastMood: 4 })).toBe(false);
  });

  it('returns true when sleep is below 6 hours', () => {
    expect(isRecoveryLow({ lastSleepHours: 5.5, skippedTodayCount: 0, lastMood: 4 })).toBe(true);
  });

  it('returns false when sleep is exactly 6 hours (boundary — not below)', () => {
    expect(isRecoveryLow({ lastSleepHours: 6, skippedTodayCount: 0, lastMood: 4 })).toBe(false);
  });

  it('returns true when skipped count is 3 or more', () => {
    expect(isRecoveryLow({ lastSleepHours: 8, skippedTodayCount: 3, lastMood: 4 })).toBe(true);
    expect(isRecoveryLow({ lastSleepHours: 8, skippedTodayCount: 5, lastMood: 4 })).toBe(true);
  });

  it('returns false when skipped count is below 3', () => {
    expect(isRecoveryLow({ lastSleepHours: 8, skippedTodayCount: 2, lastMood: 4 })).toBe(false);
  });

  it('returns true when last mood is ≤ 2 (rough / meh)', () => {
    expect(isRecoveryLow({ lastSleepHours: 8, skippedTodayCount: 0, lastMood: 2 })).toBe(true);
    expect(isRecoveryLow({ lastSleepHours: 8, skippedTodayCount: 0, lastMood: 1 })).toBe(true);
  });

  it('returns false when mood is exactly 3 (okay)', () => {
    expect(isRecoveryLow({ lastSleepHours: 8, skippedTodayCount: 0, lastMood: 3 })).toBe(false);
  });

  it('ignores null sleep hours', () => {
    expect(isRecoveryLow({ lastSleepHours: null, skippedTodayCount: 0, lastMood: 4 })).toBe(false);
  });

  it('ignores null mood', () => {
    expect(isRecoveryLow({ lastSleepHours: 8, skippedTodayCount: 0, lastMood: null })).toBe(false);
  });
});

// ─── applyReplan ──────────────────────────────────────────────────────────────

describe('applyReplan', () => {
  const date = '2026-06-09';

  it('calls deleteRoutineBlock for each id in plan.drop', () => {
    const plan: ReplanRemainingDay = {
      drop: ['id1', 'id2'],
      edits: [],
      add: [],
      rationale: 'drop two',
    };
    applyReplan(plan, date);
    expect(mockDeleteRoutineBlock).toHaveBeenCalledTimes(2);
    expect(mockDeleteRoutineBlock).toHaveBeenCalledWith('id1');
    expect(mockDeleteRoutineBlock).toHaveBeenCalledWith('id2');
  });

  it('calls updateRoutineBlock for each edit', () => {
    const plan: ReplanRemainingDay = {
      drop: [],
      edits: [{ id: 'blk1', startTime: '10:00', endTime: '11:00', title: 'Walk' }],
      add: [],
      rationale: 'edit one',
    };
    applyReplan(plan, date);
    expect(mockUpdateRoutineBlock).toHaveBeenCalledWith('blk1', {
      startTime: '10:00',
      endTime: '11:00',
      title: 'Walk',
    });
  });

  it('calls createRoutineBlocks for new blocks', () => {
    const plan: ReplanRemainingDay = {
      drop: [],
      edits: [],
      add: [{ startTime: '14:00', endTime: '15:00', title: 'Read', module: 'polymath', energyRequired: 'low' }],
      rationale: 'add one',
    };
    applyReplan(plan, date);
    expect(mockCreateRoutineBlocks).toHaveBeenCalledWith([
      expect.objectContaining({ date, startTime: '14:00', title: 'Read' }),
    ]);
  });

  it('skips createRoutineBlocks when add is empty', () => {
    applyReplan({ drop: [], edits: [], add: [], rationale: 'noop' }, date);
    expect(mockCreateRoutineBlocks).not.toHaveBeenCalled();
  });

  it('handles all three operations in one call', () => {
    const plan: ReplanRemainingDay = {
      drop: ['old1'],
      edits: [{ id: 'blk2', startTime: '09:00', endTime: '10:00' }],
      add: [{ startTime: '15:00', endTime: '16:00', title: 'Gym', module: 'health', energyRequired: 'high' }],
      rationale: 'full replan',
    };
    applyReplan(plan, date);
    expect(mockDeleteRoutineBlock).toHaveBeenCalledWith('old1');
    expect(mockUpdateRoutineBlock).toHaveBeenCalledWith('blk2', { startTime: '09:00', endTime: '10:00' });
    expect(mockCreateRoutineBlocks).toHaveBeenCalledTimes(1);
  });
});

// ─── rebalanceRestOfToday ─────────────────────────────────────────────────────

describe('rebalanceRestOfToday', () => {
  const profile = emptyUserProfile();

  it('calls replanRemainingDay with remaining blocks and skipped blocks', async () => {
    const now = new Date();
    const futureHH = String(now.getHours() + 1).padStart(2, '0');
    const mockBlocks = [
      { id: 'b1', startTime: `${futureHH}:00`, endTime: `${futureHH}:30`, title: 'Walk', module: 'health', status: 'upcoming' },
      { id: 'b2', startTime: '08:00', endTime: '09:00', title: 'Skipped', module: 'goal', status: 'skipped' },
    ];
    mockGetRoutineBlocksByDate.mockReturnValue(mockBlocks);
    mockReplanRemainingDay.mockResolvedValue({ drop: [], edits: [], add: [], rationale: 'Good balance.' });

    await rebalanceRestOfToday({ profile });

    const input = mockReplanRemainingDay.mock.calls[0][0];
    // b1 is in the future so it appears in remaining; b2 is skipped-only
    expect(input.remainingBlocks.some((b: { id: string }) => b.id === 'b1')).toBe(true);
    expect(input.skippedToday.some((b: { id: string }) => b.id === 'b2')).toBe(true);
  });

  it('returns rationale and changeCount from the AI plan', async () => {
    mockGetRoutineBlocksByDate.mockReturnValue([]);
    mockReplanRemainingDay.mockResolvedValue({
      drop: ['x', 'y'],
      edits: [{ id: 'z' }],
      add: [],
      rationale: 'Shifted workout.',
    });

    const { rationale, changeCount } = await rebalanceRestOfToday({ profile });
    expect(rationale).toBe('Shifted workout.');
    expect(changeCount).toBe(3); // 2 drops + 1 edit
  });

  it('passes softenForRecovery through to the AI input', async () => {
    mockGetRoutineBlocksByDate.mockReturnValue([]);
    mockReplanRemainingDay.mockResolvedValue({ drop: [], edits: [], add: [], rationale: 'ok' });

    await rebalanceRestOfToday({ profile, softenForRecovery: true });
    expect(mockReplanRemainingDay.mock.calls[0][0].softenForRecovery).toBe(true);
  });

  it('applies the AI plan to the DB', async () => {
    mockGetRoutineBlocksByDate.mockReturnValue([]);
    mockReplanRemainingDay.mockResolvedValue({
      drop: ['d1'],
      edits: [],
      add: [{ startTime: '16:00', endTime: '17:00', title: 'Run', module: 'health', energyRequired: 'medium' }],
      rationale: 'added a run',
    });

    await rebalanceRestOfToday({ profile });
    expect(mockDeleteRoutineBlock).toHaveBeenCalledWith('d1');
    expect(mockCreateRoutineBlocks).toHaveBeenCalledTimes(1);
  });
});

// ─── generateAndSaveWeek ──────────────────────────────────────────────────────

describe('generateAndSaveWeek', () => {
  const profile = emptyUserProfile();
  const opts = { userId: 'u1', startDate: '2026-06-09', profile, primaryDomains: ['health'] };

  const fakeWeek = {
    days: [
      {
        date: '2026-06-09',
        blocks: [{ startTime: '08:00', endTime: '09:00', title: 'Run', module: 'health', energyRequired: 'medium' }],
      },
      {
        date: '2026-06-10',
        blocks: [{ startTime: '09:00', endTime: '10:00', title: 'Read', module: 'polymath', energyRequired: 'low' }],
      },
    ],
  };

  beforeEach(() => {
    mockGenerateWeekRoutine.mockResolvedValue(fakeWeek);
  });

  it('deletes existing blocks for each day before creating new ones', async () => {
    await generateAndSaveWeek(opts);
    expect(mockDeleteRoutineBlocksByDate).toHaveBeenCalledWith('2026-06-09');
    expect(mockDeleteRoutineBlocksByDate).toHaveBeenCalledWith('2026-06-10');
  });

  it('creates all blocks from the generated week', async () => {
    await generateAndSaveWeek(opts);
    expect(mockCreateRoutineBlocks).toHaveBeenCalledTimes(2);
    expect(mockCreateRoutineBlocks).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ date: '2026-06-09', title: 'Run' })]),
    );
  });

  it('returns the generated week result', async () => {
    const result = await generateAndSaveWeek(opts);
    expect(result).toBe(fakeWeek);
  });

  it('backfills schedule times from the users table when profile fields are null', async () => {
    mockGetUser.mockReturnValue({
      wakeTime: '06:00', sleepTime: '22:00', workStartTime: '09:00', workEndTime: '17:00',
    });

    const bareProfile = emptyUserProfile(); // all schedule fields null
    await generateAndSaveWeek({ ...opts, profile: bareProfile });

    const input = mockGenerateWeekRoutine.mock.calls[0][0];
    expect(input.profile.schedule.wakeTime).toBe('06:00');
    expect(input.profile.schedule.sleepTime).toBe('22:00');
  });

  it('passes through primaryDomains to generateWeekRoutine', async () => {
    await generateAndSaveWeek({ ...opts, primaryDomains: ['finance', 'career'] });
    expect(mockGenerateWeekRoutine.mock.calls[0][0].primaryDomains).toEqual(['finance', 'career']);
  });

  it('passes protectedInterests for time-protected active interests', async () => {
    mockGetInterestsByUser.mockReturnValue([
      { name: 'Chess', weeklyMinutesTarget: 120, timeProtected: true, status: 'active' },
      { name: 'Deleted', weeklyMinutesTarget: 60, timeProtected: true, status: 'deleted' }, // excluded
    ]);

    await generateAndSaveWeek(opts);
    const input = mockGenerateWeekRoutine.mock.calls[0][0];
    expect(input.protectedInterests).toEqual([{ name: 'Chess', weeklyMinutes: 120 }]);
  });

  it('passes undefined protectedInterests when no protected interests exist', async () => {
    mockGetInterestsByUser.mockReturnValue([]);
    await generateAndSaveWeek(opts);
    expect(mockGenerateWeekRoutine.mock.calls[0][0].protectedInterests).toBeUndefined();
  });

  it('continues gracefully when getUser throws', async () => {
    mockGetUser.mockImplementation(() => { throw new Error('db error'); });
    await expect(generateAndSaveWeek(opts)).resolves.toBe(fakeWeek);
  });

  it('continues gracefully when getInterestsByUser throws', async () => {
    mockGetInterestsByUser.mockImplementation(() => { throw new Error('db error'); });
    await expect(generateAndSaveWeek(opts)).resolves.toBe(fakeWeek);
  });
});
