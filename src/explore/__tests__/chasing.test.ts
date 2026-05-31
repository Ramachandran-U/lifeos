import { describe, it, expect } from '@jest/globals';
import {
  isConcreteThread,
  buildMockChasing,
  type ChasingThread,
  type ChasingSignal,
} from '@/explore/chasing';

const thread = (over: Partial<ChasingThread> = {}): ChasingThread => ({
  question: 'What makes control theory the hidden core of your systems work?',
  rationale: 'You logged 3 sessions on systems thinking and your notes mention feedback loops.',
  seedInterest: 'Systems thinking',
  ...over,
});

describe('isConcreteThread', () => {
  it('accepts a grounded, well-formed thread', () => {
    expect(isConcreteThread(thread())).toBe(true);
  });

  it('rejects a question that does not end with "?"', () => {
    expect(isConcreteThread(thread({ question: 'Control theory and your systems work' }))).toBe(false);
  });

  it('rejects an empty/too-short rationale', () => {
    expect(isConcreteThread(thread({ rationale: 'short' }))).toBe(false);
  });

  it('rejects hype/filler language', () => {
    expect(isConcreteThread(thread({ question: 'Ready for a fascinating journey into chaos?' }))).toBe(false);
    expect(isConcreteThread(thread({ rationale: 'This is an amazing thread you will love to dive deep into.' }))).toBe(false);
  });
});

describe('buildMockChasing', () => {
  const signal = (over: Partial<ChasingSignal> = {}): ChasingSignal => ({
    interests: [
      { name: 'Systems thinking', category: 'philosophy', explorationDepth: 'deep_dive' },
      { name: 'Botany', category: 'science', explorationDepth: 'hobbyist' },
    ],
    recentExploration: [
      { interest: 'Systems thinking', minutes: 45, notes: 'feedback loops', daysAgo: 2 },
      { interest: 'Systems thinking', minutes: 30, notes: undefined, daysAgo: 5 },
    ],
    ...over,
  });

  it('returns nothing when there are no interests', () => {
    expect(buildMockChasing(signal({ interests: [] }))).toEqual([]);
  });

  it('caps at two threads and anchors each on a real interest', () => {
    const out = buildMockChasing(signal());
    expect(out.length).toBeLessThanOrEqual(2);
    const names = signal().interests.map((i) => i.name);
    out.forEach((t) => expect(names).toContain(t.seedInterest));
  });

  it('every generated thread passes the concreteness guard', () => {
    buildMockChasing(signal()).forEach((t) => expect(isConcreteThread(t)).toBe(true));
  });

  it('cites logged minutes when exploration exists, and falls back to depth otherwise', () => {
    const out = buildMockChasing(signal());
    const systems = out.find((t) => t.seedInterest === 'Systems thinking');
    const botany = out.find((t) => t.seedInterest === 'Botany');
    // 45 + 30 = 75 logged minutes on Systems thinking
    expect(systems?.rationale).toContain('75 min');
    // Botany has no logged exploration → depth-based rationale
    expect(botany?.rationale).toContain('hobbyist');
  });
});
