/**
 * Transition realism validator (routineTransitions.ts) — the deterministic
 * ground truth handed to the planner's critique step — plus the profile-schema
 * back-compat guarantee for the two new schedule fields.
 */
import { findTransitionIssues, type TransitionBlock } from '../routineTransitions';
import { UserProfileSchema, emptyUserProfile } from '../types';

function b(over: Partial<TransitionBlock>): TransitionBlock {
  return {
    startTime: '09:00',
    endTime: '10:00',
    title: 'Block',
    module: 'career',
    energyRequired: 'high',
    ...over,
  };
}

describe('findTransitionIssues — context switches', () => {
  it('flags two demanding blocks of different modules back-to-back', () => {
    const issues = findTransitionIssues([
      b({ startTime: '09:00', endTime: '10:00', title: 'Deep work', module: 'career' }),
      b({ startTime: '10:00', endTime: '11:00', title: 'Budget review', module: 'finance' }),
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('career→finance');
  });

  it('accepts the same pair with the default 10-min gap', () => {
    expect(
      findTransitionIssues([
        b({ startTime: '09:00', endTime: '10:00', module: 'career' }),
        b({ startTime: '10:10', endTime: '11:00', module: 'finance' }),
      ]),
    ).toEqual([]);
  });

  it('respects a user-set transitionMinutes', () => {
    const blocks = [
      b({ startTime: '09:00', endTime: '10:00', module: 'career' }),
      b({ startTime: '10:10', endTime: '11:00', module: 'finance' }),
    ];
    expect(findTransitionIssues(blocks, { transitionMinutes: 20 })).toHaveLength(1);
    expect(findTransitionIssues(blocks, { transitionMinutes: 0 })).toEqual([]);
  });

  it('does not flag same-module continuation, low-energy neighbours, or rest/meal buffers', () => {
    expect(
      findTransitionIssues([
        // same module — a continuation, not a switch
        b({ startTime: '09:00', endTime: '10:00', module: 'career' }),
        b({ startTime: '10:00', endTime: '11:00', module: 'career' }),
        // low-energy follower — no breather needed
        b({ startTime: '11:00', endTime: '11:30', module: 'polymath', energyRequired: 'low' }),
        // meal IS the buffer
        b({ startTime: '11:30', endTime: '12:00', title: 'Lunch', module: 'meal', energyRequired: 'low' }),
        b({ startTime: '12:00', endTime: '13:00', module: 'goal' }),
      ]),
    ).toEqual([]);
  });
});

describe('findTransitionIssues — post-physical buffer', () => {
  it('flags focused work starting <20 min after a workout', () => {
    const issues = findTransitionIssues([
      b({ startTime: '07:00', endTime: '07:45', title: 'Morning run', module: 'health' }),
      b({ startTime: '07:55', endTime: '09:00', title: 'Deep work', module: 'career' }),
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatch(/shower\/change/);
  });

  it('accepts a rest or meal block directly after the workout', () => {
    expect(
      findTransitionIssues([
        b({ startTime: '07:00', endTime: '07:45', title: 'Morning run', module: 'health' }),
        b({ startTime: '07:45', endTime: '08:15', title: 'Shower + breakfast', module: 'meal', energyRequired: 'low' }),
        b({ startTime: '08:15', endTime: '09:30', title: 'Deep work', module: 'career' }),
      ]),
    ).toEqual([]);
  });

  it('does not require the buffer after a low-energy health block (a stretch is not a workout)', () => {
    expect(
      findTransitionIssues([
        b({ startTime: '07:00', endTime: '07:15', title: 'Stretch', module: 'health', energyRequired: 'low' }),
        b({ startTime: '07:15', endTime: '08:30', title: 'Deep work', module: 'career' }),
      ]),
    ).toEqual([]);
  });
});

describe('findTransitionIssues — commute coverage', () => {
  const OPTS = { commuteMinutes: 30, workStartTime: '09:30', workEndTime: '18:30' };

  it('flags a commuter plan with no commute blocks (both directions)', () => {
    const issues = findTransitionIssues(
      [b({ startTime: '10:00', endTime: '11:00', title: 'Work', module: 'work' })],
      OPTS,
    );
    expect(issues).toHaveLength(2);
    expect(issues[0]).toContain('Commute to work');
    expect(issues[1]).toContain('Commute home');
  });

  it('accepts commute blocks hugging the work window', () => {
    expect(
      findTransitionIssues(
        [
          b({ startTime: '09:00', endTime: '09:30', title: 'Commute to work', module: 'rest', energyRequired: 'low' }),
          b({ startTime: '18:30', endTime: '19:00', title: 'Commute home', module: 'rest', energyRequired: 'low' }),
        ],
        OPTS,
      ),
    ).toEqual([]);
  });

  it('requires nothing when commuteMinutes is 0/null (works from home)', () => {
    const blocks = [b({ startTime: '10:00', endTime: '11:00', module: 'work' })];
    expect(findTransitionIssues(blocks, { ...OPTS, commuteMinutes: 0 })).toEqual([]);
    expect(findTransitionIssues(blocks, { ...OPTS, commuteMinutes: null })).toEqual([]);
  });
});

describe('UserProfileSchema back-compat (new schedule fields)', () => {
  it('a profile stored BEFORE commute/transition fields existed still parses (defaults to null)', () => {
    const legacy = JSON.parse(JSON.stringify(emptyUserProfile('form'))) as Record<string, unknown>;
    const schedule = legacy.schedule as Record<string, unknown>;
    delete schedule.commuteMinutes;
    delete schedule.transitionMinutes;

    const parsed = UserProfileSchema.parse(legacy);
    expect(parsed.schedule.commuteMinutes).toBeNull();
    expect(parsed.schedule.transitionMinutes).toBeNull();
  });

  it('rejects out-of-range values', () => {
    const p = emptyUserProfile('form');
    expect(
      UserProfileSchema.safeParse({ ...p, schedule: { ...p.schedule, commuteMinutes: 999 } }).success,
    ).toBe(false);
    expect(
      UserProfileSchema.safeParse({ ...p, schedule: { ...p.schedule, transitionMinutes: -5 } }).success,
    ).toBe(false);
  });
});
