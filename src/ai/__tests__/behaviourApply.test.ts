/**
 * Tests for behaviourApply.ts.
 *
 * Covers:
 *   • applyBehaviourSuggestion — dispatch to each apply path
 *   • applyRewriteTime         — updates matching future blocks
 *   • applyShrinkDuration      — shrinks oversized future blocks
 *   • applyDropTitle           — deletes matching future blocks
 *   • applyRegenerateWeek      — delegates to generateAndSaveWeek
 *   • isFutureMutable guard    — skips completed/skipped/past blocks
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGetRoutineBlocksInRange = jest.fn();
const mockUpdateRoutineBlock = jest.fn();
const mockDeleteRoutineBlock = jest.fn();
const mockGetUserProfile = jest.fn();
const mockGenerateAndSaveWeek = jest.fn();

jest.mock('@/db/queries/routine', () => ({
  getRoutineBlocksInRange: (...a: unknown[]) => mockGetRoutineBlocksInRange(...a),
  updateRoutineBlock: (...a: unknown[]) => mockUpdateRoutineBlock(...a),
  deleteRoutineBlock: (...a: unknown[]) => mockDeleteRoutineBlock(...a),
}));
jest.mock('@/db/queries/userProfile', () => ({
  getUserProfile: (...a: unknown[]) => mockGetUserProfile(...a),
}));
// Stub replanApply so regenerate_week tests don't need the full pipeline.
jest.mock('../replanApply', () => ({
  generateAndSaveWeek: (...a: unknown[]) => mockGenerateAndSaveWeek(...a),
}));

// ─── System under test ────────────────────────────────────────────────────────

import { applyBehaviourSuggestion } from '../behaviourApply';
import { emptyUserProfile } from '../types';
import type { BehaviourSuggestion } from '@/utils/behaviourPatterns';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Use a date that is guaranteed to be "today or future" in tests.
// The module calls todayStr() = format(new Date(), 'yyyy-MM-dd') internally.
// Blocks whose date >= today AND status is not done/skipped are mutable.
const TODAY = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
const TOMORROW = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

function mkBlock(overrides: {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  status?: string;
}) {
  return { status: 'upcoming', ...overrides };
}

function suggestion(apply: BehaviourSuggestion['apply']): BehaviourSuggestion {
  return {
    id: 'sug1',
    module: 'health',
    pattern: 'skipped_3_times',
    title: 'Test',
    description: 'Test',
    rationale: 'Test',
    apply,
  };
}

function silentMocks() {
  mockGetRoutineBlocksInRange.mockReturnValue([]);
  mockUpdateRoutineBlock.mockReturnValue(undefined);
  mockDeleteRoutineBlock.mockReturnValue(undefined);
  mockGetUserProfile.mockResolvedValue(null);
  mockGenerateAndSaveWeek.mockResolvedValue({ days: [] });
}

beforeEach(() => {
  jest.clearAllMocks();
  silentMocks();
});

// ─── rewrite_time ─────────────────────────────────────────────────────────────

describe('rewrite_time', () => {
  it('updates matching future blocks', async () => {
    mockGetRoutineBlocksInRange.mockReturnValue([
      mkBlock({ id: 'b1', title: 'Morning Run', date: TODAY, startTime: '08:00', endTime: '09:00' }),
    ]);
    const result = await applyBehaviourSuggestion(
      'u1',
      suggestion({ type: 'rewrite_time', titleSubstring: 'run', newStartTime: '07:00', newEndTime: '08:00' }),
    );
    expect(mockUpdateRoutineBlock).toHaveBeenCalledWith('b1', { startTime: '07:00', endTime: '08:00' });
    expect(result.ok).toBe(true);
    expect(result.affected).toBe(1);
    expect(result.message).toContain('07:00');
  });

  it('matches case-insensitively via titleSubstring', async () => {
    mockGetRoutineBlocksInRange.mockReturnValue([
      mkBlock({ id: 'b2', title: 'MORNING RUN', date: TODAY, startTime: '08:00', endTime: '09:00' }),
    ]);
    await applyBehaviourSuggestion(
      'u1',
      suggestion({ type: 'rewrite_time', titleSubstring: 'morning run', newStartTime: '07:00', newEndTime: '08:00' }),
    );
    expect(mockUpdateRoutineBlock).toHaveBeenCalledWith('b2', expect.any(Object));
  });

  it('skips completed blocks', async () => {
    mockGetRoutineBlocksInRange.mockReturnValue([
      mkBlock({ id: 'b3', title: 'Run', date: TODAY, startTime: '08:00', endTime: '09:00', status: 'completed' }),
    ]);
    const result = await applyBehaviourSuggestion(
      'u1',
      suggestion({ type: 'rewrite_time', titleSubstring: 'run', newStartTime: '07:00', newEndTime: '08:00' }),
    );
    expect(mockUpdateRoutineBlock).not.toHaveBeenCalled();
    expect(result.affected).toBe(0);
  });

  it('skips skipped blocks', async () => {
    mockGetRoutineBlocksInRange.mockReturnValue([
      mkBlock({ id: 'b4', title: 'Run', date: TODAY, startTime: '08:00', endTime: '09:00', status: 'skipped' }),
    ]);
    const result = await applyBehaviourSuggestion(
      'u1',
      suggestion({ type: 'rewrite_time', titleSubstring: 'run', newStartTime: '07:00', newEndTime: '08:00' }),
    );
    expect(mockUpdateRoutineBlock).not.toHaveBeenCalled();
    expect(result.affected).toBe(0);
  });

  it('skips past-dated blocks', async () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    mockGetRoutineBlocksInRange.mockReturnValue([
      mkBlock({ id: 'b5', title: 'Run', date: yesterday, startTime: '08:00', endTime: '09:00' }),
    ]);
    const result = await applyBehaviourSuggestion(
      'u1',
      suggestion({ type: 'rewrite_time', titleSubstring: 'run', newStartTime: '07:00', newEndTime: '08:00' }),
    );
    expect(mockUpdateRoutineBlock).not.toHaveBeenCalled();
    expect(result.affected).toBe(0);
  });

  it('updates multiple matching blocks', async () => {
    mockGetRoutineBlocksInRange.mockReturnValue([
      mkBlock({ id: 'b6', title: 'Run', date: TODAY, startTime: '08:00', endTime: '09:00' }),
      mkBlock({ id: 'b7', title: 'Run', date: TOMORROW, startTime: '08:00', endTime: '09:00' }),
    ]);
    const result = await applyBehaviourSuggestion(
      'u1',
      suggestion({ type: 'rewrite_time', titleSubstring: 'run', newStartTime: '07:00', newEndTime: '08:00' }),
    );
    expect(mockUpdateRoutineBlock).toHaveBeenCalledTimes(2);
    expect(result.affected).toBe(2);
    expect(result.message).toContain('2 upcoming block');
  });

  it('returns affected=0 when no blocks match', async () => {
    mockGetRoutineBlocksInRange.mockReturnValue([
      mkBlock({ id: 'b8', title: 'Meditation', date: TODAY, startTime: '08:00', endTime: '09:00' }),
    ]);
    const result = await applyBehaviourSuggestion(
      'u1',
      suggestion({ type: 'rewrite_time', titleSubstring: 'run', newStartTime: '07:00', newEndTime: '08:00' }),
    );
    expect(result.affected).toBe(0);
  });
});

// ─── shrink_duration ──────────────────────────────────────────────────────────

describe('shrink_duration', () => {
  it('shrinks a block that is longer than the target', async () => {
    mockGetRoutineBlocksInRange.mockReturnValue([
      mkBlock({ id: 'b1', title: 'Deep Work', date: TODAY, startTime: '09:00', endTime: '12:00' }), // 180 min
    ]);
    const result = await applyBehaviourSuggestion(
      'u1',
      suggestion({ type: 'shrink_duration', titleSubstring: 'deep work', targetDurationMin: 90 }),
    );
    expect(mockUpdateRoutineBlock).toHaveBeenCalledWith('b1', { endTime: '10:30' }); // 09:00 + 90min
    expect(result.affected).toBe(1);
    expect(result.message).toContain('90 min');
  });

  it('skips blocks that are already at or below the target', async () => {
    mockGetRoutineBlocksInRange.mockReturnValue([
      mkBlock({ id: 'b2', title: 'Deep Work', date: TODAY, startTime: '09:00', endTime: '10:00' }), // 60 min
    ]);
    const result = await applyBehaviourSuggestion(
      'u1',
      suggestion({ type: 'shrink_duration', titleSubstring: 'deep work', targetDurationMin: 60 }),
    );
    expect(mockUpdateRoutineBlock).not.toHaveBeenCalled();
    expect(result.affected).toBe(0);
  });

  it('handles HH:MM arithmetic with minutes correctly', async () => {
    // 09:30 → 09:30 + 45min = 10:15
    mockGetRoutineBlocksInRange.mockReturnValue([
      mkBlock({ id: 'b3', title: 'Yoga', date: TODAY, startTime: '09:30', endTime: '11:00' }), // 90 min
    ]);
    await applyBehaviourSuggestion(
      'u1',
      suggestion({ type: 'shrink_duration', titleSubstring: 'yoga', targetDurationMin: 45 }),
    );
    expect(mockUpdateRoutineBlock).toHaveBeenCalledWith('b3', { endTime: '10:15' });
  });

  it('handles midnight wrapping (endTime > 23:59)', async () => {
    // Start 23:00, +90min = 24:30 which wraps to 00:30 (fromMin(90) % 24 = 00:30)
    mockGetRoutineBlocksInRange.mockReturnValue([
      mkBlock({ id: 'b4', title: 'Late', date: TODAY, startTime: '23:00', endTime: '23:59' }), // 59 min
    ]);
    const result = await applyBehaviourSuggestion(
      'u1',
      suggestion({ type: 'shrink_duration', titleSubstring: 'late', targetDurationMin: 30 }),
    );
    expect(result.affected).toBe(1);
    expect(mockUpdateRoutineBlock).toHaveBeenCalledWith('b4', { endTime: '23:30' });
  });

  it('still obeys isFutureMutable guard', async () => {
    mockGetRoutineBlocksInRange.mockReturnValue([
      mkBlock({ id: 'b5', title: 'Deep Work', date: TODAY, startTime: '09:00', endTime: '12:00', status: 'completed' }),
    ]);
    const result = await applyBehaviourSuggestion(
      'u1',
      suggestion({ type: 'shrink_duration', titleSubstring: 'deep work', targetDurationMin: 90 }),
    );
    expect(result.affected).toBe(0);
  });
});

// ─── drop_title ───────────────────────────────────────────────────────────────

describe('drop_title', () => {
  it('deletes matching future blocks', async () => {
    mockGetRoutineBlocksInRange.mockReturnValue([
      mkBlock({ id: 'b1', title: 'Social Media', date: TODAY, startTime: '12:00', endTime: '12:30' }),
    ]);
    const result = await applyBehaviourSuggestion(
      'u1',
      suggestion({ type: 'drop_title', titleSubstring: 'social media' }),
    );
    expect(mockDeleteRoutineBlock).toHaveBeenCalledWith('b1');
    expect(result.ok).toBe(true);
    expect(result.affected).toBe(1);
  });

  it('deletes all matching blocks across multiple days', async () => {
    mockGetRoutineBlocksInRange.mockReturnValue([
      mkBlock({ id: 'b1', title: 'Social', date: TODAY, startTime: '12:00', endTime: '12:30' }),
      mkBlock({ id: 'b2', title: 'Social Media Check', date: TOMORROW, startTime: '13:00', endTime: '13:30' }),
    ]);
    const result = await applyBehaviourSuggestion(
      'u1',
      suggestion({ type: 'drop_title', titleSubstring: 'social' }),
    );
    expect(mockDeleteRoutineBlock).toHaveBeenCalledTimes(2);
    expect(result.affected).toBe(2);
    expect(result.message).toContain('2 upcoming block');
  });

  it('skips completed/skipped blocks', async () => {
    mockGetRoutineBlocksInRange.mockReturnValue([
      mkBlock({ id: 'b3', title: 'Scroll', date: TODAY, startTime: '09:00', endTime: '09:30', status: 'completed' }),
      mkBlock({ id: 'b4', title: 'Scroll', date: TODAY, startTime: '14:00', endTime: '14:30', status: 'skipped' }),
      mkBlock({ id: 'b5', title: 'Scroll', date: TOMORROW, startTime: '09:00', endTime: '09:30' }),
    ]);
    const result = await applyBehaviourSuggestion(
      'u1',
      suggestion({ type: 'drop_title', titleSubstring: 'scroll' }),
    );
    expect(mockDeleteRoutineBlock).toHaveBeenCalledTimes(1);
    expect(mockDeleteRoutineBlock).toHaveBeenCalledWith('b5');
    expect(result.affected).toBe(1);
    expect(result.message).toContain('1 upcoming block');
  });
});

// ─── regenerate_week ──────────────────────────────────────────────────────────

describe('regenerate_week', () => {
  it('returns ok=false when no profile exists', async () => {
    mockGetUserProfile.mockResolvedValue(null);
    const result = await applyBehaviourSuggestion(
      'u1',
      suggestion({ type: 'regenerate_week' }),
    );
    expect(result.ok).toBe(false);
    expect(result.message).toContain('No profile');
    expect(mockGenerateAndSaveWeek).not.toHaveBeenCalled();
  });

  it('calls generateAndSaveWeek with userId and profile', async () => {
    const profile = { ...emptyUserProfile(), primaryDomains: ['health', 'career'] };
    mockGetUserProfile.mockResolvedValue(profile);
    mockGenerateAndSaveWeek.mockResolvedValue({
      days: [
        { date: TODAY, blocks: [{ title: 'Run' }, { title: 'Read' }] },
        { date: TOMORROW, blocks: [{ title: 'Meditate' }] },
      ],
    });

    const result = await applyBehaviourSuggestion(
      'u1',
      suggestion({ type: 'regenerate_week' }),
    );

    expect(mockGenerateAndSaveWeek).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', primaryDomains: ['health', 'career'] }),
    );
    expect(result.ok).toBe(true);
    expect(result.affected).toBe(3); // 2 + 1 blocks
    expect(result.message).toContain('2-day plan');
    expect(result.message).toContain('3 blocks');
  });
});

// ─── dispatch (applyBehaviourSuggestion top level) ───────────────────────────

describe('applyBehaviourSuggestion dispatch', () => {
  it('routes to rewrite_time', async () => {
    const result = await applyBehaviourSuggestion(
      'u1',
      suggestion({ type: 'rewrite_time', titleSubstring: 'x', newStartTime: '09:00', newEndTime: '10:00' }),
    );
    expect(result.ok).toBe(true);
  });

  it('routes to shrink_duration', async () => {
    const result = await applyBehaviourSuggestion(
      'u1',
      suggestion({ type: 'shrink_duration', titleSubstring: 'x', targetDurationMin: 30 }),
    );
    expect(result.ok).toBe(true);
  });

  it('routes to drop_title', async () => {
    const result = await applyBehaviourSuggestion(
      'u1',
      suggestion({ type: 'drop_title', titleSubstring: 'x' }),
    );
    expect(result.ok).toBe(true);
  });

  it('routes to regenerate_week (returns ok=false when no profile)', async () => {
    const result = await applyBehaviourSuggestion('u1', suggestion({ type: 'regenerate_week' }));
    expect(result.ok).toBe(false); // no profile → soft error
  });
});
