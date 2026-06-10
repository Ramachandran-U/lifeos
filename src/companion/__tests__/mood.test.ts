import { deriveMood, RESTING_AFTER_DAYS, THRIVING_COMPLETION_PCT, THRIVING_STREAK } from '../mood';
import { COMPANION_MOODS, type MoodInputs } from '../types';

const base: MoodInputs = {
  bestActiveStreak: 0,
  streakAtRisk: false,
  todayCompletionPct: 0,
  daysSinceLastOpen: 0,
  stagnantDomain: false,
  unclaimedChests: 0,
};

describe('the mood floor (compassion constraint)', () => {
  test('the closed union has exactly five moods and no negative state', () => {
    expect(COMPANION_MOODS).toHaveLength(5);
    expect(COMPANION_MOODS).toEqual(
      expect.arrayContaining(['thriving', 'content', 'curious', 'concerned', 'resting']),
    );
    for (const banned of ['sick', 'dying', 'sad', 'dead', 'abandoned', 'starving', 'lonely']) {
      expect(COMPANION_MOODS as readonly string[]).not.toContain(banned);
    }
  });

  test('even the worst possible inputs floor at resting — never worse', () => {
    const worst = deriveMood({
      bestActiveStreak: 0,
      streakAtRisk: true,
      todayCompletionPct: 0,
      daysSinceLastOpen: 365,
      stagnantDomain: true,
      unclaimedChests: 0,
    });
    expect(worst.mood).toBe('resting');
  });
});

describe('deriveMood truth table', () => {
  test.each([
    ['away ≥3 days → resting (outranks everything)', { ...base, daysSinceLastOpen: RESTING_AFTER_DAYS, streakAtRisk: true, todayCompletionPct: 1 }, 'resting'],
    ['away 2 days is NOT resting', { ...base, daysSinceLastOpen: RESTING_AFTER_DAYS - 1 }, 'content'],
    ['streak at risk → concerned', { ...base, streakAtRisk: true }, 'concerned'],
    ['stagnant domain → concerned', { ...base, stagnantDomain: true }, 'concerned'],
    ['concern outranks a good day', { ...base, streakAtRisk: true, todayCompletionPct: 0.9 }, 'concerned'],
    ['high completion → thriving', { ...base, todayCompletionPct: THRIVING_COMPLETION_PCT }, 'thriving'],
    ['long streak + decent day → thriving', { ...base, bestActiveStreak: THRIVING_STREAK, todayCompletionPct: 0.5 }, 'thriving'],
    ['long streak + idle day is NOT thriving', { ...base, bestActiveStreak: THRIVING_STREAK, todayCompletionPct: 0.2 }, 'content'],
    ['unopened chest → curious', { ...base, unclaimedChests: 1 }, 'curious'],
    ['thriving outranks curious', { ...base, todayCompletionPct: 1, unclaimedChests: 2 }, 'thriving'],
    ['quiet baseline → content', base, 'content'],
  ] as const)('%s', (_label, inputs, mood) => {
    expect(deriveMood(inputs).mood).toBe(mood);
  });

  test('every branch returns a non-empty plain-words reason', () => {
    const variants: MoodInputs[] = [
      { ...base, daysSinceLastOpen: 10 },
      { ...base, streakAtRisk: true },
      { ...base, stagnantDomain: true },
      { ...base, todayCompletionPct: 1 },
      { ...base, unclaimedChests: 1 },
      base,
    ];
    for (const v of variants) {
      expect(deriveMood(v).reason.length).toBeGreaterThan(10);
    }
  });
});
