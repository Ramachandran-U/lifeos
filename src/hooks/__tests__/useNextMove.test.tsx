/**
 * useNextMove — deterministic next-move resolution (Acceptance #14).
 *
 * Covers all four kinds, the two-upcoming-blocks tie-break (earlier startTime
 * wins) and the up-now boundary (startTime === now → upNow === true).
 *
 * NOTE: named .test.tsx (not .test.ts) so jest's `components` project
 * discovers it — src/hooks .test.ts files are matched by neither project.
 */
import { resolveNextMove, useNextMove, type NextMoveBlock } from '@/hooks/useNextMove';
import { renderHook } from '@testing-library/react-native';

const NOON = new Date(2026, 5, 10, 12, 0, 0); // local 12:00

const block = (over: Partial<NextMoveBlock>): NextMoveBlock => ({
  startTime: '09:00',
  endTime: '09:30',
  title: 'A block',
  module: 'goal',
  status: 'upcoming',
  ...over,
});

describe('resolveNextMove — kind resolution order', () => {
  it('block: first upcoming block wins over tasks', () => {
    const move = resolveNextMove({
      blocks: [block({ title: 'Deep work', module: 'career', startTime: '14:00', endTime: '15:00' })],
      dailyTasks: [{ title: 'A daily task' }],
      now: NOON,
    });
    expect(move.kind).toBe('block');
    expect(move.title).toBe('Deep work');
    expect(move.module).toBe('career');
    expect(move.startTime).toBe('14:00');
    expect(move.endTime).toBe('15:00');
    expect(move.upNow).toBe(false);
  });

  it('tie-break: of two upcoming blocks the earlier startTime wins', () => {
    const move = resolveNextMove({
      blocks: [
        block({ title: 'Later', startTime: '16:00', endTime: '17:00' }),
        block({ title: 'Earlier', startTime: '13:00', endTime: '13:30' }),
      ],
      dailyTasks: [],
      now: NOON,
    });
    expect(move.title).toBe('Earlier');
  });

  it('skips non-upcoming blocks when picking the next one', () => {
    const move = resolveNextMove({
      blocks: [
        block({ title: 'Done already', startTime: '08:00', status: 'completed' }),
        block({ title: 'Skipped', startTime: '09:00', status: 'skipped' }),
        block({ title: 'The next one', startTime: '15:00', endTime: '16:00' }),
      ],
      dailyTasks: [],
      now: NOON,
    });
    expect(move.kind).toBe('block');
    expect(move.title).toBe('The next one');
  });

  it('up-now boundary: startTime === now → upNow === true', () => {
    const move = resolveNextMove({
      blocks: [block({ startTime: '12:00', endTime: '12:30' })],
      dailyTasks: [],
      now: NOON,
    });
    expect(move.upNow).toBe(true);
  });

  it('up-now: a past startTime is up-now, never anything harsher', () => {
    const move = resolveNextMove({
      blocks: [block({ startTime: '11:00', endTime: '11:30' })],
      dailyTasks: [],
      now: NOON,
    });
    expect(move.upNow).toBe(true);
  });

  it('future startTime → upNow === false', () => {
    const move = resolveNextMove({
      blocks: [block({ startTime: '12:01', endTime: '12:30' })],
      dailyTasks: [],
      now: NOON,
    });
    expect(move.upNow).toBe(false);
  });

  it('task: no upcoming blocks → dailyTasks[0], goal domain, extraCount', () => {
    const move = resolveNextMove({
      blocks: [block({ status: 'completed' }), block({ status: 'skipped' })],
      dailyTasks: [{ title: 'Write the launch doc' }, { title: 'Second' }, { title: 'Third' }],
      now: NOON,
    });
    expect(move.kind).toBe('task');
    expect(move.title).toBe('Write the launch doc');
    expect(move.module).toBe('goal');
    expect(move.radarKey).toBe('goals');
    expect(move.extraCount).toBe(2);
  });

  it('dayDone: blocks exist, all completed, no tasks', () => {
    const move = resolveNextMove({
      blocks: [block({ status: 'completed' }), block({ startTime: '10:00', status: 'completed' })],
      dailyTasks: [],
      now: NOON,
    });
    expect(move.kind).toBe('dayDone');
    expect(move.title).toBe('Every block done. Outstanding.');
  });

  it('plan: no blocks, no tasks', () => {
    const move = resolveNextMove({ blocks: [], dailyTasks: [], now: NOON });
    expect(move.kind).toBe('plan');
    expect(move.title).toBe("Let's build your first day.");
  });
});

describe('resolveNextMove — radarKey mapping', () => {
  it("maps the block module 'goal' to the radar key 'goals'", () => {
    const move = resolveNextMove({ blocks: [block({ module: 'goal' })], dailyTasks: [], now: NOON });
    expect(move.radarKey).toBe('goals');
  });

  it.each(['health', 'finance', 'career', 'social', 'polymath'] as const)(
    'maps %s to itself',
    (mod) => {
      const move = resolveNextMove({ blocks: [block({ module: mod })], dailyTasks: [], now: NOON });
      expect(move.radarKey).toBe(mod);
    },
  );

  it.each(['rest', 'meal', 'work'])('non-domain module %s → radarKey undefined', (mod) => {
    const move = resolveNextMove({ blocks: [block({ module: mod })], dailyTasks: [], now: NOON });
    expect(move.radarKey).toBeUndefined();
  });
});

describe('useNextMove (hook form)', () => {
  it('returns the same resolution as the pure resolver', () => {
    const input = {
      blocks: [block({ title: 'Hooked', startTime: '13:00', endTime: '14:30', module: 'health' })],
      dailyTasks: [],
      now: NOON,
    };
    const { result } = renderHook(() => useNextMove(input));
    expect(result.current).toEqual(resolveNextMove(input));
    expect(result.current.kind).toBe('block');
    expect(result.current.radarKey).toBe('health');
  });
});
