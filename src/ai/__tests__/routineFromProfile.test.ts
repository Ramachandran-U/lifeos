jest.mock('@/db', () => ({}));
jest.mock('@/db/queries/routine', () => ({
  createRoutineBlocks: jest.fn(),
  deleteRoutineBlocksByDate: jest.fn(),
  getRoutineBlocksByDate: jest.fn(() => []),
}));
jest.mock('@/db/queries/behaviour', () => ({
  logBehaviourEvent: jest.fn(),
  getEventsLastNDays: jest.fn(() => []),
}));
jest.mock('../routinePlanner', () => ({
  planRoutineWithContext: jest.fn(),
}));

import { profileToRoutineInput, canPlanFromProfile, type UserScheduleFallback } from '../routineFromProfile';
import { emptyUserProfile, ROUTINE_CONFIDENCE_THRESHOLD } from '../types';

const profile = emptyUserProfile('form');

describe('profileToRoutineInput — schedule fallback chain', () => {
  it('uses profile.schedule when present', () => {
    const p = { ...profile, schedule: { ...profile.schedule, wakeTime: '09:00', workStartTime: '10:00' } };
    const input = profileToRoutineInput(p);
    expect(input.wakeTime).toBe('09:00');
    expect(input.workStartTime).toBe('10:00');
  });

  it('falls back to users-table when profile.schedule is null', () => {
    const p = { ...profile, schedule: { ...profile.schedule, wakeTime: null, workStartTime: null } };
    const userFb: UserScheduleFallback = { wakeTime: '10:00', workStartTime: '11:00', sleepTime: '23:30', workEndTime: '19:00' };
    const input = profileToRoutineInput(p, userFb);
    expect(input.wakeTime).toBe('10:00');
    expect(input.workStartTime).toBe('11:00');
    expect(input.sleepTime).toBe('23:30');
    expect(input.workEndTime).toBe('19:00');
  });

  it('falls back to hardcoded defaults when BOTH profile and users-table are null', () => {
    const p = { ...profile, schedule: { ...profile.schedule, wakeTime: null, workStartTime: null } };
    const input = profileToRoutineInput(p, null);
    expect(input.wakeTime).toBe('07:00');
    expect(input.workStartTime).toBe('09:30');
  });

  it('profile.schedule takes priority over users-table fallback', () => {
    const p = { ...profile, schedule: { ...profile.schedule, wakeTime: '06:00' } };
    const userFb: UserScheduleFallback = { wakeTime: '10:00' };
    const input = profileToRoutineInput(p, userFb);
    expect(input.wakeTime).toBe('06:00');
  });
});

describe('canPlanFromProfile — confidence gate relaxed by concrete goals', () => {
  it('plans when confidence clears the gate, with or without goals', () => {
    expect(canPlanFromProfile(0.8, false)).toBe(true);
    expect(canPlanFromProfile(0.8, true)).toBe(true);
  });

  it('plans below the threshold WHEN concrete goals exist (the unblock)', () => {
    expect(canPlanFromProfile(0.26, true)).toBe(true);
  });

  it('blocks only when below threshold AND there are no goals', () => {
    expect(canPlanFromProfile(0.26, false)).toBe(false);
  });

  it('respects the 0.7 threshold boundary for the no-goals case', () => {
    expect(canPlanFromProfile(ROUTINE_CONFIDENCE_THRESHOLD, false)).toBe(true);
    expect(canPlanFromProfile(ROUTINE_CONFIDENCE_THRESHOLD - 0.01, false)).toBe(false);
  });
});
