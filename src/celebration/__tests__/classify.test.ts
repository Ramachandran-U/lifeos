import { classifyTier, XP_EPIC_THRESHOLD, XP_STANDARD_THRESHOLD } from '../classify';

describe('classifyTier — the single celebration choke point', () => {
  test.each([
    [0, 'micro'],
    [10, 'micro'],
    [XP_STANDARD_THRESHOLD - 1, 'micro'],
    [XP_STANDARD_THRESHOLD, 'standard'],
    [40, 'standard'],
    [XP_EPIC_THRESHOLD - 1, 'standard'],
    [XP_EPIC_THRESHOLD, 'epic'],
    [200, 'epic'],
  ] as const)('xp %d → %s', (amount, tier) => {
    expect(classifyTier({ kind: 'xp', amount })).toBe(tier);
  });

  test('xp with no amount is micro (defensive default — never over-celebrate)', () => {
    expect(classifyTier({ kind: 'xp' })).toBe('micro');
  });

  test('identity beats are always epic', () => {
    expect(classifyTier({ kind: 'levelUp' })).toBe('epic');
    expect(classifyTier({ kind: 'dayComplete' })).toBe('epic');
    expect(classifyTier({ kind: 'milestone', count: 7 })).toBe('epic');
    expect(classifyTier({ kind: 'milestone', count: 365 })).toBe('epic');
  });

  test('streak and badge beats are standard', () => {
    expect(classifyTier({ kind: 'streak', count: 3 })).toBe('standard');
    expect(classifyTier({ kind: 'badge' })).toBe('standard');
  });
});
