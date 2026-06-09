/**
 * Tests for profileMerge.ts — pure merge/verification functions.
 * No mocks needed: all functions are deterministic computations.
 */

import { mergeProfilePatch, markSlotsUserVerified } from '../profileMerge';
import { emptyUserProfile } from '../types';
import type { ProfileSlotConfidence } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeConf(overrides: Partial<ProfileSlotConfidence> = {}): ProfileSlotConfidence {
  return {
    identity: 0,
    vision: 0,
    schedule: 0,
    chronotype: 0,
    habits: 0,
    constraints: 0,
    primaryDomains: 0,
    overall: 0,
    ...overrides,
  };
}

// ─── mergeProfilePatch ────────────────────────────────────────────────────────

describe('mergeProfilePatch', () => {
  describe('identity merge', () => {
    it('overwrites identity fields from the patch', () => {
      const p = emptyUserProfile();
      const result = mergeProfilePatch(p, { identity: { firstName: 'Alex' } });
      expect(result.identity.firstName).toBe('Alex');
    });

    it('keeps unpatched identity fields intact', () => {
      const p = { ...emptyUserProfile(), identity: { ...emptyUserProfile().identity, lastName: 'Doe' } };
      const result = mergeProfilePatch(p, { identity: { firstName: 'Alex' } });
      expect(result.identity.lastName).toBe('Doe');
    });
  });

  describe('vision / topGoals', () => {
    it('deduplicates topGoals case-insensitively', () => {
      const p = { ...emptyUserProfile(), vision: { ...emptyUserProfile().vision, topGoals: ['Fitness'] } };
      const result = mergeProfilePatch(p, { vision: { topGoals: ['fitness', 'Career'] } });
      const goals = result.vision.topGoals;
      expect(goals.filter((g) => g.toLowerCase() === 'fitness')).toHaveLength(1);
      expect(goals).toContain('Career');
    });

    it('caps topGoals at 5', () => {
      const existing = ['A', 'B', 'C', 'D', 'E'];
      const p = { ...emptyUserProfile(), vision: { ...emptyUserProfile().vision, topGoals: existing } };
      const result = mergeProfilePatch(p, { vision: { topGoals: ['F', 'G'] } });
      expect(result.vision.topGoals.length).toBeLessThanOrEqual(5);
    });

    it('preserves existing goals when patch has none', () => {
      const p = { ...emptyUserProfile(), vision: { ...emptyUserProfile().vision, topGoals: ['Health'] } };
      const result = mergeProfilePatch(p, {});
      expect(result.vision.topGoals).toEqual(['Health']);
    });
  });

  describe('schedule / fixedBlocks', () => {
    it('appends new fixedBlocks rather than replacing them', () => {
      const existing = [{ label: 'Work', startTime: '09:00', endTime: '17:00' }];
      const p = { ...emptyUserProfile(), schedule: { ...emptyUserProfile().schedule, fixedBlocks: existing } };
      const result = mergeProfilePatch(p, {
        schedule: { fixedBlocks: [{ label: 'Gym', startTime: '07:00', endTime: '08:00' }] },
      });
      expect(result.schedule.fixedBlocks).toHaveLength(2);
      expect(result.schedule.fixedBlocks.some((b) => b.label === 'Work')).toBe(true);
      expect(result.schedule.fixedBlocks.some((b) => b.label === 'Gym')).toBe(true);
    });

    it('keeps existing fixedBlocks unchanged when patch has none', () => {
      const existing = [{ label: 'Work', startTime: '09:00', endTime: '17:00' }];
      const p = { ...emptyUserProfile(), schedule: { ...emptyUserProfile().schedule, fixedBlocks: existing } };
      const result = mergeProfilePatch(p, { schedule: { wakeTime: '06:30' } });
      expect(result.schedule.fixedBlocks).toEqual(existing);
    });

    it('overwrites scalar schedule fields like wakeTime', () => {
      const p = { ...emptyUserProfile(), schedule: { ...emptyUserProfile().schedule, wakeTime: '07:00' } };
      const result = mergeProfilePatch(p, { schedule: { wakeTime: '06:00' } });
      expect(result.schedule.wakeTime).toBe('06:00');
    });
  });

  describe('primaryDomains', () => {
    it('deduplicates and caps at 3', () => {
      const p = { ...emptyUserProfile(), primaryDomains: ['health', 'finance'] };
      const result = mergeProfilePatch(p, { primaryDomains: ['finance', 'career', 'social'] });
      expect(result.primaryDomains.length).toBeLessThanOrEqual(3);
      expect(result.primaryDomains.filter((d) => d === 'finance')).toHaveLength(1);
    });

    it('preserves existing domains when no patch', () => {
      const p = { ...emptyUserProfile(), primaryDomains: ['health'] };
      const result = mergeProfilePatch(p, {});
      expect(result.primaryDomains).toEqual(['health']);
    });
  });

  describe('habits', () => {
    it('deduplicates current habits case-insensitively', () => {
      const p = { ...emptyUserProfile(), habits: { current: ['Running'], aspirational: [] } };
      const result = mergeProfilePatch(p, { habits: { current: ['running', 'Yoga'] } });
      expect(result.habits.current.filter((h) => h.toLowerCase() === 'running')).toHaveLength(1);
      expect(result.habits.current).toContain('Yoga');
    });
  });

  describe('string array fields (constraints, struggles, values)', () => {
    it('deduplicates constraints case-insensitively', () => {
      const p = { ...emptyUserProfile(), constraints: ['no night work'] };
      const result = mergeProfilePatch(p, { constraints: ['No Night Work', 'no weekends'] });
      expect(result.constraints.filter((c) => c.toLowerCase() === 'no night work')).toHaveLength(1);
      expect(result.constraints).toContain('no weekends');
    });

    it('caps values at 5', () => {
      const p = { ...emptyUserProfile(), values: ['A', 'B', 'C', 'D', 'E'] };
      const result = mergeProfilePatch(p, { values: ['F', 'G'] });
      expect(result.values.length).toBeLessThanOrEqual(5);
    });
  });

  describe('communication', () => {
    it('overwrites tone from patch', () => {
      const p = { ...emptyUserProfile(), communication: { tone: 'direct' as const, avoid: [] } };
      const result = mergeProfilePatch(p, { communication: { tone: 'gentle' as const } });
      expect(result.communication.tone).toBe('gentle');
    });

    it('keeps existing tone when patch has none', () => {
      const p = { ...emptyUserProfile(), communication: { tone: 'direct' as const, avoid: [] } };
      const result = mergeProfilePatch(p, { communication: { avoid: ['jargon'] } });
      expect(result.communication.tone).toBe('direct');
    });
  });

  describe('confidence deltas', () => {
    it('increments a specific slot by the delta', () => {
      const p = { ...emptyUserProfile(), confidence: makeConf({ vision: 0.4 }) };
      const result = mergeProfilePatch(p, { confidenceDeltas: { vision: 0.2 } });
      expect(result.confidence.vision).toBeCloseTo(0.6);
    });

    it('clamps incremented value to [0, 1]', () => {
      const p = { ...emptyUserProfile(), confidence: makeConf({ schedule: 0.9 }) };
      const result = mergeProfilePatch(p, { confidenceDeltas: { schedule: 0.5 } });
      expect(result.confidence.schedule).toBe(1);
    });

    it('clamps decremented value to [0, 1]', () => {
      const p = { ...emptyUserProfile(), confidence: makeConf({ habits: 0.1 }) };
      const result = mergeProfilePatch(p, { confidenceDeltas: { habits: -0.5 } });
      expect(result.confidence.habits).toBe(0);
    });

    it('recomputes overall after delta', () => {
      const p = { ...emptyUserProfile(), confidence: makeConf() };
      const result = mergeProfilePatch(p, { confidenceDeltas: { vision: 1, schedule: 1 } });
      // vision=1 (weight 0.25) + schedule=1 (weight 0.25) → overall ≈ 0.5
      expect(result.confidence.overall).toBeCloseTo(0.5, 2);
    });

    it('does not modify confidence when no deltas provided', () => {
      const p = { ...emptyUserProfile(), confidence: makeConf({ vision: 0.5 }) };
      const result = mergeProfilePatch(p, {});
      // overall should be recomputed: vision=0.5 × 0.25 = 0.125
      expect(result.confidence.vision).toBe(0.5);
      expect(result.confidence.overall).toBeCloseTo(0.125, 3);
    });
  });

  it('updates lastUpdated to a recent ISO timestamp', () => {
    const before = Date.now() - 100;
    const result = mergeProfilePatch(emptyUserProfile(), {});
    const after = Date.now() + 100;
    const ts = Date.parse(result.lastUpdated);
    expect(ts).toBeGreaterThan(before);
    expect(ts).toBeLessThan(after);
  });
});

// ─── markSlotsUserVerified ────────────────────────────────────────────────────

describe('markSlotsUserVerified', () => {
  it('sets the specified slot to 1.0', () => {
    const p = { ...emptyUserProfile(), confidence: makeConf({ vision: 0.3 }) };
    const result = markSlotsUserVerified(p, ['vision']);
    expect(result.confidence.vision).toBe(1);
  });

  it('sets multiple slots to 1.0 in one call', () => {
    const p = { ...emptyUserProfile(), confidence: makeConf({ schedule: 0.4, habits: 0.2 }) };
    const result = markSlotsUserVerified(p, ['schedule', 'habits']);
    expect(result.confidence.schedule).toBe(1);
    expect(result.confidence.habits).toBe(1);
  });

  it('does not change unspecified slots', () => {
    const p = { ...emptyUserProfile(), confidence: makeConf({ vision: 0.5, schedule: 0.3 }) };
    const result = markSlotsUserVerified(p, ['vision']);
    expect(result.confidence.schedule).toBe(0.3); // unchanged
  });

  it('recomputes overall after verification', () => {
    const p = { ...emptyUserProfile(), confidence: makeConf() }; // all 0
    // Mark vision (weight 0.25) and schedule (weight 0.25) as verified
    const result = markSlotsUserVerified(p, ['vision', 'schedule']);
    expect(result.confidence.overall).toBeCloseTo(0.5, 2);
  });

  it('returns overall = 1.0 when all weighted slots are verified', () => {
    const p = { ...emptyUserProfile(), confidence: makeConf() };
    const result = markSlotsUserVerified(p, [
      'identity', 'vision', 'schedule', 'chronotype', 'habits', 'constraints', 'primaryDomains',
    ]);
    expect(result.confidence.overall).toBeCloseTo(1.0, 5);
  });

  it('updates lastUpdated', () => {
    const before = Date.now() - 100;
    const result = markSlotsUserVerified(emptyUserProfile(), ['vision']);
    expect(Date.parse(result.lastUpdated)).toBeGreaterThan(before);
  });
});

// ─── computeOverall (exercised indirectly) ────────────────────────────────────

describe('computeOverall via markSlotsUserVerified', () => {
  it('weighs schedule and vision most heavily (0.25 each)', () => {
    const pVision = { ...emptyUserProfile(), confidence: makeConf() };
    const pSchedule = { ...emptyUserProfile(), confidence: makeConf() };
    const rVision = markSlotsUserVerified(pVision, ['vision']);
    const rSchedule = markSlotsUserVerified(pSchedule, ['schedule']);
    // Both slots carry equal weight → same overall
    expect(rVision.confidence.overall).toBeCloseTo(rSchedule.confidence.overall, 5);
  });

  it('weighs identity least (0.05)', () => {
    const pIdentity = { ...emptyUserProfile(), confidence: makeConf() };
    const pVision = { ...emptyUserProfile(), confidence: makeConf() };
    const rIdentity = markSlotsUserVerified(pIdentity, ['identity']);
    const rVision = markSlotsUserVerified(pVision, ['vision']);
    expect(rIdentity.confidence.overall).toBeLessThan(rVision.confidence.overall);
    expect(rIdentity.confidence.overall).toBeCloseTo(0.05, 5);
  });
});
