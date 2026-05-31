import { describe, it, expect } from '@jest/globals';
import {
  isValidFrontier,
  buildMockFrontier,
  type Frontier,
  type FrontierSignal,
} from '@/explore/frontier';

const names = new Set(['Systems thinking', 'Jazz piano', 'Botany']);

const frontier = (over: Partial<Frontier> = {}): Frontier => ({
  interestA: 'Systems thinking',
  interestB: 'Jazz piano',
  headline: 'Constraint and release as a control loop',
  insight: 'Improvisation in jazz resolves tension the same way a feedback controller settles a system — sensing deviation and acting to cancel it.',
  bridgeAction: 'Spend 45 minutes transcribing one solo and labelling each phrase as a deviation or a correction.',
  ...over,
});

describe('isValidFrontier', () => {
  it('accepts a grounded frontier between two real, distinct interests', () => {
    expect(isValidFrontier(frontier(), names)).toBe(true);
  });

  it('rejects a frontier naming an interest the user does not have', () => {
    expect(isValidFrontier(frontier({ interestB: 'Quantum chromodynamics' }), names)).toBe(false);
  });

  it('rejects a self-pair (same interest on both sides)', () => {
    expect(isValidFrontier(frontier({ interestB: 'Systems thinking' }), names)).toBe(false);
  });

  it('rejects hype/cliche copy', () => {
    expect(isValidFrontier(frontier({ headline: 'Where art meets science' }), names)).toBe(false);
    expect(isValidFrontier(frontier({ insight: 'This is a fascinating connection you will love to explore in depth.' }), names)).toBe(false);
  });
});

describe('buildMockFrontier', () => {
  const signal = (over: Partial<FrontierSignal> = {}): FrontierSignal => ({
    interests: [
      { name: 'Systems thinking', category: 'philosophy', explorationDepth: 'deep_dive', recentMinutes: 120 },
      { name: 'Jazz piano', category: 'music', explorationDepth: 'hobbyist', recentMinutes: 30 },
      { name: 'Note taking', category: 'philosophy', explorationDepth: 'taste', recentMinutes: 0 },
    ],
    ...over,
  });

  it('returns null when there are fewer than two interests', () => {
    expect(buildMockFrontier(signal({ interests: [] }))).toBeNull();
    expect(buildMockFrontier(signal({ interests: [signal().interests[0]] }))).toBeNull();
  });

  it('produces a frontier that passes its own validity guard', () => {
    const f = buildMockFrontier(signal());
    expect(f).not.toBeNull();
    const realNames = new Set(signal().interests.map((i) => i.name));
    expect(isValidFrontier(f!, realNames)).toBe(true);
  });

  it('prefers the best-developed pair from different categories', () => {
    const f = buildMockFrontier(signal())!;
    // Systems thinking (deep_dive, 120m) is the top; its cross-category partner
    // is Jazz piano (music) — not the same-category Note taking.
    expect(f.interestA).toBe('Systems thinking');
    expect(f.interestB).toBe('Jazz piano');
  });
});
