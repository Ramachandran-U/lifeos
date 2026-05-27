jest.mock('@/db/queries/routine', () => ({
  getRoutineBlocksInRange: jest.fn(() => []),
}));
jest.mock('@/db/queries/goals', () => ({
  getGoalsByUser: jest.fn(() => []),
}));
jest.mock('@/db/queries/social', () => ({
  getContactsByUser: jest.fn(() => []),
  computeSocialScore: jest.fn(() => null),
}));
jest.mock('@/db/queries/gamification', () => ({
  getOrCreateGamification: jest.fn(() => ({
    domainScores: '{}',
    streaks: '{}',
    badges: '[]',
    totalXP: 0,
  })),
}));

import { buildAnnualReviewInput } from '../annualReviewBuilder';
import { getRoutineBlocksInRange } from '@/db/queries/routine';
import { getGoalsByUser } from '@/db/queries/goals';
import { getOrCreateGamification } from '@/db/queries/gamification';

const routineMock = getRoutineBlocksInRange as jest.MockedFunction<typeof getRoutineBlocksInRange>;
const goalsMock = getGoalsByUser as jest.MockedFunction<typeof getGoalsByUser>;
const gameMock = getOrCreateGamification as jest.MockedFunction<typeof getOrCreateGamification>;

describe('buildAnnualReviewInput', () => {
  it('does not crash on a user with zero rows in every table', () => {
    const input = buildAnnualReviewInput('user-1', 'Sam', null);
    expect(input.windowDays).toBe(365);
    expect(input.goals).toEqual({ total: 0, completed: 0 });
    expect(input.routine.completionRate).toBe(0);
    expect(input.topStreaks).toEqual([]);
    expect(input.social.inCadencePct).toBeNull();
    expect(input.lifeScore.current).toBeGreaterThanOrEqual(0);
  });

  it('tolerates corrupt JSON in the gamification row', () => {
    gameMock.mockReturnValueOnce({
      domainScores: 'not json',
      streaks: '{bad',
      badges: 'nope',
      totalXP: 10,
    } as ReturnType<typeof getOrCreateGamification>);
    const input = buildAnnualReviewInput('user-1', null, null);
    expect(input.totalXP).toBe(10);
    expect(input.badgeCount).toBe(0);
    expect(input.topStreaks).toEqual([]);
  });

  it('aggregates completed goals + ranks streaks when data exists', () => {
    goalsMock.mockReturnValueOnce([
      { status: 'completed' },
      { status: 'active' },
      { status: 'completed' },
    ] as ReturnType<typeof getGoalsByUser>);
    gameMock.mockReturnValueOnce({
      domainScores: '{"health":80}',
      streaks: '{"workout":{"count":12},"learning":{"count":3}}',
      badges: '["a","b"]',
      totalXP: 500,
    } as ReturnType<typeof getOrCreateGamification>);
    const input = buildAnnualReviewInput('user-1', 'Sam', null);
    expect(input.goals).toEqual({ total: 3, completed: 2 });
    expect(input.badgeCount).toBe(2);
    expect(input.topStreaks[0]).toEqual({ key: 'workout', count: 12 });
  });

  afterEach(() => {
    routineMock.mockReset();
    routineMock.mockReturnValue([]);
  });
});
