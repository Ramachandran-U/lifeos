/**
 * Drives the deterministic behaviour detectors by mocking the single DB
 * read they depend on. Each test crafts a block set that should (or should
 * not) trip a specific detector.
 */
import { addDays, format } from 'date-fns';

// Mock the routine query before importing the SUT.
const mockBlocks: any[] = [];
jest.mock('@/db/queries/routine', () => ({
  getRoutineBlocksInRange: () => mockBlocks,
}));

import { detectBehaviourSuggestions } from '../behaviourPatterns';

function setBlocks(blocks: any[]) {
  mockBlocks.length = 0;
  mockBlocks.push(...blocks);
}

const today = new Date();
const recent = (offsetDays: number) => format(addDays(today, -offsetDays), 'yyyy-MM-dd');

let id = 0;
function block(over: Partial<{
  date: string; startTime: string; endTime: string; title: string; module: string; status: string;
}> = {}) {
  id += 1;
  return {
    id: `b${id}`,
    date: over.date ?? recent(1),
    startTime: over.startTime ?? '09:00',
    endTime: over.endTime ?? '10:00',
    title: over.title ?? 'Generic block',
    module: over.module ?? 'goal',
    status: over.status ?? 'completed',
  };
}

beforeEach(() => { setBlocks([]); id = 0; });

describe('detectBehaviourSuggestions — workout_timing', () => {
  it('suggests moving workouts from a low-completion hour to a high one', () => {
    const blocks: any[] = [];
    // 6am workouts: 4 occurrences, 1 completed (25%)
    for (let i = 0; i < 4; i++) {
      blocks.push(block({ title: 'Workout', startTime: '06:00', endTime: '06:45', status: i === 0 ? 'completed' : 'skipped', date: recent(i + 1) }));
    }
    // 5pm workouts: 4 occurrences, 4 completed (100%)
    for (let i = 0; i < 4; i++) {
      blocks.push(block({ title: 'Workout', startTime: '17:00', endTime: '17:45', status: 'completed', date: recent(i + 8) }));
    }
    setBlocks(blocks);
    const out = detectBehaviourSuggestions();
    const wt = out.find((s) => s.kind === 'workout_timing');
    expect(wt).toBeDefined();
    expect(wt!.apply).toMatchObject({ type: 'rewrite_time', titleSubstring: 'workout' });
    // moves to the 17:00 hour
    expect((wt!.apply as any).newStartTime.startsWith('17:')).toBe(true);
  });

  it('stays silent when there is too little workout data', () => {
    setBlocks([block({ title: 'Workout', status: 'skipped' })]);
    expect(detectBehaviourSuggestions().some((s) => s.kind === 'workout_timing')).toBe(false);
  });
});

describe('detectBehaviourSuggestions — dropped_habit', () => {
  it('flags a title skipped >=3 times and more often than completed', () => {
    const blocks = [
      block({ title: 'Meditate', status: 'skipped' }),
      block({ title: 'Meditate', status: 'skipped' }),
      block({ title: 'Meditate', status: 'skipped' }),
      block({ title: 'Meditate', status: 'completed' }),
    ];
    setBlocks(blocks);
    const dropped = detectBehaviourSuggestions().find((s) => s.kind === 'dropped_habit');
    expect(dropped).toBeDefined();
    expect(dropped!.apply).toMatchObject({ type: 'drop_title' });
    expect((dropped!.apply as any).titleSubstring).toBe('Meditate');
  });

  it('does not flag a habit that is mostly completed', () => {
    const blocks = [
      block({ title: 'Read', status: 'completed' }),
      block({ title: 'Read', status: 'completed' }),
      block({ title: 'Read', status: 'completed' }),
      block({ title: 'Read', status: 'skipped' }),
    ];
    setBlocks(blocks);
    expect(detectBehaviourSuggestions().some((s) => s.kind === 'dropped_habit')).toBe(false);
  });
});

describe('detectBehaviourSuggestions — filtering + ordering', () => {
  it('excludes dismissed and applied suggestion ids', () => {
    const blocks = [
      block({ title: 'Meditate', status: 'skipped' }),
      block({ title: 'Meditate', status: 'skipped' }),
      block({ title: 'Meditate', status: 'skipped' }),
    ];
    setBlocks(blocks);
    const all = detectBehaviourSuggestions();
    expect(all.length).toBeGreaterThan(0);
    const dismissedId = all[0].id;
    const filtered = detectBehaviourSuggestions({ dismissedIds: [dismissedId] });
    expect(filtered.some((s) => s.id === dismissedId)).toBe(false);
  });

  it('returns an empty array on no signal', () => {
    setBlocks([block({ title: 'One off', status: 'completed' })]);
    expect(detectBehaviourSuggestions()).toEqual([]);
  });

  it('orders by confidence (high first)', () => {
    const blocks: any[] = [];
    // dropped habit (high — skipped 5)
    for (let i = 0; i < 5; i++) blocks.push(block({ title: 'Journal', status: 'skipped' }));
    setBlocks(blocks);
    const out = detectBehaviourSuggestions();
    const confidences = out.map((s) => s.confidence);
    const rank = { high: 0, medium: 1, low: 2 } as const;
    for (let i = 1; i < confidences.length; i++) {
      expect(rank[confidences[i - 1]]).toBeLessThanOrEqual(rank[confidences[i]]);
    }
  });
});
