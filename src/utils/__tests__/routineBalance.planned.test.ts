// getRoutineBlocksInRange pulls in the DB layer; this suite only needs the pure
// aggregator, so stub the query module to keep it in pure Node.
jest.mock('@/db/queries/routine', () => ({ getRoutineBlocksInRange: jest.fn(() => []) }));

import { aggregatePlannedDomainMinutes } from '../routineBalance';

describe('aggregatePlannedDomainMinutes', () => {
  it('sums minutes per life-domain regardless of status', () => {
    const out = aggregatePlannedDomainMinutes([
      { startTime: '09:00', endTime: '10:00', module: 'career' },   // 60 → career
      { startTime: '10:00', endTime: '10:30', module: 'health' },   // 30 → health
      { startTime: '18:00', endTime: '19:30', module: 'polymath' }, // 90 → polymath
    ]);
    expect(out).toMatchObject({ career: 60, health: 30, polymath: 90, goals: 0, finance: 0, social: 0 });
  });

  it('drops non-life modules (rest/work/meal) — life-domains only', () => {
    const out = aggregatePlannedDomainMinutes([
      { startTime: '09:00', endTime: '17:00', module: 'work' },   // excluded
      { startTime: '13:00', endTime: '13:30', module: 'meal' },   // excluded
      { startTime: '22:00', endTime: '22:30', module: 'rest' },   // excluded
      { startTime: '07:00', endTime: '07:45', module: 'goal' },   // 45 → goals
    ]);
    expect(out).toEqual({ goals: 45, health: 0, finance: 0, career: 0, social: 0, polymath: 0 });
  });

  it('clamps negative/zero durations to 0', () => {
    const out = aggregatePlannedDomainMinutes([
      { startTime: '10:00', endTime: '09:00', module: 'goal' }, // inverted → 0
    ]);
    expect(out.goals).toBe(0);
  });
});
