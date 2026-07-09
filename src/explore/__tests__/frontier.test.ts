import { describe, it, expect } from '@jest/globals';
import {
  isValidFrontier,
  buildMockFrontier,
  withAdHocInterests,
  frontierPairKey,
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

  it('accepts a solo frontier (interestB null) only under solo constraints', () => {
    const solo = frontier({ interestB: null });
    expect(isValidFrontier(solo, names, { pinA: 'Systems thinking', pinB: null })).toBe(true);
    // Solo shape without solo constraints is malformed …
    expect(isValidFrontier(solo, names)).toBe(false);
    // … and a pair shape under solo constraints is too.
    expect(isValidFrontier(frontier(), names, { pinA: 'Systems thinking', pinB: null })).toBe(false);
  });

  it('rejects a solo frontier on an unknown interest', () => {
    const solo = frontier({ interestA: 'Quantum chromodynamics', interestB: null });
    expect(isValidFrontier(solo, names, { pinA: 'Quantum chromodynamics', pinB: null })).toBe(false);
  });

  it('enforces pinned endpoints', () => {
    expect(isValidFrontier(frontier(), names, { pinA: 'Botany' })).toBe(false);
    expect(isValidFrontier(frontier(), names, { pinA: 'Systems thinking', pinB: 'Jazz piano' })).toBe(true);
    expect(isValidFrontier(frontier(), names, { pinB: 'Botany' })).toBe(false);
  });

  it('matches pins case/whitespace-insensitively — a live model may echo a pin re-cased', () => {
    expect(isValidFrontier(frontier(), names, { pinA: '  systems THINKING  ' })).toBe(true);
    expect(isValidFrontier(frontier(), names, { pinA: 'Systems thinking', pinB: ' JAZZ piano' })).toBe(true);
  });

  it('rejects a pair the session has already seen (order-insensitive)', () => {
    expect(
      isValidFrontier(frontier(), names, { excludePairs: [['Jazz piano', 'Systems thinking']] }),
    ).toBe(false);
    expect(
      isValidFrontier(frontier(), names, { excludePairs: [['Botany', 'Jazz piano']] }),
    ).toBe(true);
  });

  it('rejects a regenerate that returns the avoided headline', () => {
    const f = frontier();
    expect(isValidFrontier(f, names, { avoidHeadline: f.headline })).toBe(false);
    expect(isValidFrontier(f, names, { avoidHeadline: 'Some other take' })).toBe(true);
  });
});

describe('frontierPairKey', () => {
  it('is order-insensitive and case/whitespace-normalised', () => {
    expect(frontierPairKey('Jazz piano', 'Botany')).toBe(frontierPairKey('botany ', 'JAZZ PIANO'));
  });
});

describe('withAdHocInterests', () => {
  const base: FrontierSignal = {
    interests: [
      { name: 'Systems thinking', category: 'philosophy', explorationDepth: 'deep_dive', recentMinutes: 120 },
    ],
  };

  it('appends a pinned custom name the user does not track — without persisting semantics', () => {
    const out = withAdHocInterests(base, { pinA: 'Mycology' });
    expect(out.interests.map((i) => i.name)).toEqual(['Systems thinking', 'Mycology']);
    expect(out.interests[1]).toMatchObject({ category: 'other', explorationDepth: 'taste', recentMinutes: 0 });
    // Input signal untouched.
    expect(base.interests).toHaveLength(1);
  });

  it('does not duplicate a pin that matches an existing interest (case-insensitive)', () => {
    const out = withAdHocInterests(base, { pinA: 'systems THINKING' });
    expect(out.interests).toHaveLength(1);
  });

  it('ignores the solo null and empty strings', () => {
    expect(withAdHocInterests(base, { pinA: '  ', pinB: null }).interests).toHaveLength(1);
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

  it('honours pinned endpoints', () => {
    const f = buildMockFrontier(signal(), { pinA: 'Note taking', pinB: 'Jazz piano' })!;
    expect(f.interestA).toBe('Note taking');
    expect(f.interestB).toBe('Jazz piano');
  });

  it('shuffles to an unseen pair when the best pair is excluded', () => {
    const f = buildMockFrontier(signal(), {
      excludePairs: [['Systems thinking', 'Jazz piano']],
    })!;
    expect(frontierPairKey(f.interestA, f.interestB!)).not.toBe(
      frontierPairKey('Systems thinking', 'Jazz piano'),
    );
  });

  it('wraps around instead of dead-ending when every pair has been seen', () => {
    const two = signal({ interests: signal().interests.slice(0, 2) });
    const f = buildMockFrontier(two, {
      excludePairs: [['Systems thinking', 'Jazz piano']],
    });
    expect(f).not.toBeNull();
  });

  it('produces a different take when regenerating on the same pair', () => {
    const first = buildMockFrontier(signal())!;
    const second = buildMockFrontier(signal(), {
      pinA: first.interestA,
      pinB: first.interestB,
      avoidHeadline: first.headline,
    })!;
    expect(second.interestA).toBe(first.interestA);
    expect(second.interestB).toBe(first.interestB);
    expect(second.headline).not.toBe(first.headline);
  });

  it('builds a solo frontier within one interest, passing its own guard', () => {
    const constraints = { pinA: 'Systems thinking', pinB: null };
    const f = buildMockFrontier(signal(), constraints);
    expect(f).not.toBeNull();
    expect(f!.interestA).toBe('Systems thinking');
    expect(f!.interestB).toBeNull();
    const realNames = new Set(signal().interests.map((i) => i.name));
    expect(isValidFrontier(f!, realNames, constraints)).toBe(true);
  });

  it('solo regenerate avoids the previous solo headline', () => {
    const constraints = { pinA: 'Systems thinking', pinB: null } as const;
    const first = buildMockFrontier(signal(), constraints)!;
    const second = buildMockFrontier(signal(), { ...constraints, avoidHeadline: first.headline })!;
    expect(second.headline).not.toBe(first.headline);
    expect(second.interestB).toBeNull();
  });

  it('solo mode with no pinned interest returns null', () => {
    expect(buildMockFrontier(signal(), { pinB: null })).toBeNull();
  });

  it('works end-to-end with an ad-hoc custom interest', () => {
    const constraints = { pinA: 'Mycology', pinB: 'Jazz piano' };
    const augmented = withAdHocInterests(signal(), constraints);
    const f = buildMockFrontier(augmented, constraints)!;
    expect(f.interestA).toBe('Mycology');
    const names2 = new Set(augmented.interests.map((i) => i.name));
    expect(isValidFrontier(f, names2, constraints)).toBe(true);
  });
});
