/**
 * Action specs for useGoalStore. The store is a thin orchestration layer over
 * the goals query module — every mutating action delegates to a query and then
 * reloads via getGoalsByUser. We mock the query module and assert that wiring.
 */
jest.mock('@/db/queries/goals', () => ({
  getGoalsByUser: jest.fn(() => []),
  createGoal: jest.fn(() => 'new-goal-id'),
  updateGoalStatus: jest.fn(),
  getChildGoals: jest.fn(() => []),
  softDeleteGoal: jest.fn(),
  restoreGoal: jest.fn(),
  snoozeGoal: jest.fn(),
  resumeGoal: jest.fn(),
  reactivateDueGoals: jest.fn(() => []),
}));

import { useGoalStore } from '../useGoalStore';
import {
  getGoalsByUser,
  createGoal,
  softDeleteGoal,
  restoreGoal as restoreGoalQuery,
  snoozeGoal as snoozeGoalQuery,
  resumeGoal as resumeGoalQuery,
  reactivateDueGoals,
} from '@/db/queries/goals';

const USER = 'user-fake-1';

beforeEach(() => {
  jest.clearAllMocks();
  useGoalStore.setState({ goals: [] });
});

it('addGoal creates then reloads', () => {
  const id = useGoalStore.getState().addGoal({ userId: USER, title: 'X', goalType: 'g', level: 'milestone' });
  expect(id).toBe('new-goal-id');
  expect(createGoal).toHaveBeenCalledTimes(1);
  expect(getGoalsByUser).toHaveBeenCalledWith(USER);
});

it('removeGoal soft-deletes then reloads', () => {
  useGoalStore.getState().removeGoal('g1', USER);
  expect(softDeleteGoal).toHaveBeenCalledWith('g1');
  expect(getGoalsByUser).toHaveBeenCalledWith(USER);
});

it('restoreGoal restores then reloads', () => {
  useGoalStore.getState().restoreGoal('g1', USER);
  expect(restoreGoalQuery).toHaveBeenCalledWith('g1');
  expect(getGoalsByUser).toHaveBeenCalledWith(USER);
});

it('snoozeGoal forwards the until-date then reloads', () => {
  useGoalStore.getState().snoozeGoal('g1', '2026-09-01', USER);
  expect(snoozeGoalQuery).toHaveBeenCalledWith('g1', '2026-09-01');
  expect(getGoalsByUser).toHaveBeenCalledWith(USER);
});

it('resumeGoal resumes then reloads', () => {
  useGoalStore.getState().resumeGoal('g1', USER);
  expect(resumeGoalQuery).toHaveBeenCalledWith('g1');
  expect(getGoalsByUser).toHaveBeenCalledWith(USER);
});

it('reactivateDue returns reactivated goals and reloads only when some were due', () => {
  (reactivateDueGoals as jest.Mock).mockReturnValueOnce([]);
  const none = useGoalStore.getState().reactivateDue(USER, '2026-06-04');
  expect(none).toEqual([]);
  expect(getGoalsByUser).not.toHaveBeenCalled(); // nothing changed → no reload

  (reactivateDueGoals as jest.Mock).mockReturnValueOnce([{ id: 'g1', title: 'Back' }]);
  const some = useGoalStore.getState().reactivateDue(USER, '2026-06-04');
  expect(some).toEqual([{ id: 'g1', title: 'Back' }]);
  expect(getGoalsByUser).toHaveBeenCalledWith(USER);
});
