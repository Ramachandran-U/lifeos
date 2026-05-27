import {
  computePriorityDiff,
  assessImpact,
  shouldDefaultToTomorrow,
  buildReplanConstraints,
  hasMeaningfulChange,
  type RoutineBlock,
  type ImpactInput,
} from '../priorityChangeHandler';
import type { DomainId } from '@/store/useUserStore';

function block(over: Partial<RoutineBlock> = {}): RoutineBlock {
  return { id: 'b1', startTime: '14:00', endTime: '15:00', title: 'Block', module: 'goal', status: 'upcoming', ...over };
}

describe('computePriorityDiff', () => {
  it('detects added, removed, reordered, and unchanged domains', () => {
    const d = computePriorityDiff(
      ['goals', 'health', 'finance'],
      ['health', 'goals', 'polymath'],
    );
    expect(d.added).toEqual(['polymath']);
    expect(d.removed).toEqual(['finance']);
    expect(d.reordered.sort()).toEqual(['goals', 'health']); // both swapped position
    expect(d.unchanged).toEqual([]);
  });

  it('returns empty diff for identical priorities', () => {
    const d = computePriorityDiff(['health', 'career'], ['health', 'career']);
    expect(d.added).toEqual([]);
    expect(d.removed).toEqual([]);
    expect(d.reordered).toEqual([]);
    expect(d.unchanged).toEqual(['health', 'career']);
  });
});

describe('hasMeaningfulChange', () => {
  it('false for no-op', () => {
    const d = computePriorityDiff(['health'], ['health']);
    expect(hasMeaningfulChange(d)).toBe(false);
  });
  it('true for any add/remove/reorder', () => {
    expect(hasMeaningfulChange(computePriorityDiff(['health'], ['health', 'finance']))).toBe(true);
    expect(hasMeaningfulChange(computePriorityDiff(['health', 'finance'], ['finance', 'health']))).toBe(true);
  });
});

describe('assessImpact', () => {
  const base: ImpactInput = {
    diff: computePriorityDiff(['goals', 'health', 'finance'], ['goals', 'health', 'polymath']),
    todayBlocks: [
      block({ id: 'done', status: 'completed', module: 'goal', startTime: '09:00', endTime: '10:00' }),
      block({ id: 'fin', status: 'upcoming', module: 'finance', startTime: '14:00', endTime: '15:00' }),
      block({ id: 'hlth', status: 'upcoming', module: 'health', startTime: '16:00', endTime: '17:00' }),
    ],
    streaks: [{ domain: 'finance' as DomainId, streakKey: 'foodTracking', count: 5 }],
    expeditions: [{ id: 'e1', title: 'Budgeting 101', domain: 'finance', status: 'active' }],
    goalCounts: [{ domain: 'finance' as DomainId, activeGoals: 3 }],
  };

  it('identifies blocks at risk in removed domains', () => {
    const impact = assessImpact(base);
    expect(impact.blocksAtRisk.map((b) => b.id)).toEqual(['fin']);
    expect(impact.gaining).toEqual(['polymath']);
    expect(impact.losing).toEqual(['finance']);
  });

  it('flags streaks that will lapse', () => {
    expect(assessImpact(base).streaksAtRisk).toHaveLength(1);
    expect(assessImpact(base).streaksAtRisk[0]!.count).toBe(5);
  });

  it('flags expeditions that will slow down', () => {
    expect(assessImpact(base).expeditionsSlowing.map((e) => e.title)).toEqual(['Budgeting 101']);
  });

  it('flags orphaned goals', () => {
    expect(assessImpact(base).goalsOrphaned[0]!.activeGoals).toBe(3);
  });

  it('computes remaining minutes and tooLateForToday', () => {
    expect(assessImpact(base).remainingMinutes).toBe(120); // 2 upcoming 1h blocks
    expect(assessImpact(base).tooLateForToday).toBe(false);
  });

  it('sets tooLateForToday when remaining < 60', () => {
    const short: ImpactInput = {
      ...base,
      todayBlocks: [block({ status: 'upcoming', startTime: '22:00', endTime: '22:30' })],
    };
    expect(assessImpact(short).tooLateForToday).toBe(true);
  });

  it('returns clean impact when nothing is removed', () => {
    const adding: ImpactInput = {
      ...base,
      diff: computePriorityDiff(['goals'], ['goals', 'health']),
    };
    const impact = assessImpact(adding);
    expect(impact.blocksAtRisk).toEqual([]);
    expect(impact.streaksAtRisk).toEqual([]);
    expect(impact.goalsOrphaned).toEqual([]);
  });
});

describe('shouldDefaultToTomorrow', () => {
  it('true below 60 min', () => expect(shouldDefaultToTomorrow(30)).toBe(true));
  it('false at 60+ min', () => expect(shouldDefaultToTomorrow(60)).toBe(false));
});

describe('buildReplanConstraints', () => {
  it('separates frozen (completed/in_progress) from remaining (upcoming)', () => {
    const blocks = [
      block({ id: 'a', status: 'completed' }),
      block({ id: 'b', status: 'in_progress' }),
      block({ id: 'c', status: 'upcoming' }),
    ];
    const { fixedBlocks, remainingSlots } = buildReplanConstraints(blocks);
    expect(fixedBlocks).toHaveLength(2);
    expect(remainingSlots).toHaveLength(1);
    expect(remainingSlots[0]!.id).toBe('c');
  });
});
