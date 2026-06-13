/**
 * Guards defect D13: goal focus blocks must land on LOCAL calendar days (the
 * convention the rest of the app uses), not UTC. The old addDaysISO formatted
 * with toISOString() (UTC), so blocks landed off-by-one for non-UTC users.
 */
import { format, addDays } from 'date-fns';

type SeededBlock = { date: string; module: string; linkedEntityId: string };
const createMock = jest.fn((blocks: SeededBlock[]): string[] => blocks.map((_b, i) => `id-${i}`));

jest.mock('@/db/queries/routine', () => ({
  createRoutineBlocks: (b: SeededBlock[]) => createMock(b),
  getRoutineBlocksInRange: (): SeededBlock[] => [],
}));
jest.mock('@/utils/gamification', () => ({ GOALTYPE_TO_MODULE: { learning: 'goal' } }));

import { addGoalFocusBlocks } from '@/utils/goalRoutine';

describe('addGoalFocusBlocks', () => {
  beforeEach(() => createMock.mockClear());

  it('seeds the goal block on consecutive LOCAL days starting today', () => {
    addGoalFocusBlocks({ goalId: 'g1', goalType: 'learning', title: 'Read 20 pages', days: 5 });
    expect(createMock).toHaveBeenCalledTimes(1);
    const dates = createMock.mock.calls[0][0].map((b) => b.date);
    const expected = [0, 1, 2, 3, 4].map((i) => format(addDays(new Date(), i), 'yyyy-MM-dd'));
    expect(dates).toEqual(expected);
  });

  it('links every block to the goal and derives the module from the goal type', () => {
    addGoalFocusBlocks({ goalId: 'g42', goalType: 'learning', title: 'Practice', days: 2 });
    const blocks = createMock.mock.calls[0][0];
    expect(blocks).toHaveLength(2);
    expect(blocks.every((b) => b.linkedEntityId === 'g42')).toBe(true);
    expect(blocks.every((b) => b.module === 'goal')).toBe(true);
  });
});
