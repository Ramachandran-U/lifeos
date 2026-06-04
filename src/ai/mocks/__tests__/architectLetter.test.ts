import { buildMockArchitectLetter } from '../architectLetter';
import { ArchitectLetterSchema, type ArchitectLetterInput } from '../../types';

const base: ArchitectLetterInput = {
  name: 'Alex',
  period: 'week',
  windowDays: 7,
  vision: 'Stop disappearing on the people I love while I build my career.',
  statedPriorities: ['social', 'career'],
  values: ['integrity', 'connection'],
  domains: [
    { domain: 'career', minutesThisWindow: 600, minutesPrevWindow: 200, isStatedPriority: true },
    { domain: 'social', minutesThisWindow: 15, minutesPrevWindow: 120, isStatedPriority: true },
    { domain: 'health', minutesThisWindow: 90, minutesPrevWindow: 90, isStatedPriority: false },
  ],
  routine: { completionRate: 0.8, blocksCompleted: 16, blocksPlanned: 20 },
  streaks: [{ key: 'call-a-friend', current: 0, brokeThisWindow: true }],
  stagnantDomains: ['social'],
  overcommitted: false,
  recentReflectionSnippets: ['Felt good at work but I ghosted everyone again.'],
  lifeScore: { current: 64, delta: 4 },
};

describe('buildMockArchitectLetter', () => {
  it('produces a schema-valid letter', () => {
    const out = buildMockArchitectLetter(base);
    expect(() => ArchitectLetterSchema.parse(out)).not.toThrow();
  });

  it('greets the user by name', () => {
    expect(buildMockArchitectLetter(base).greeting).toBe('Dear Alex,');
  });

  it('finds the tension between the rising and the quiet stated-priority domain', () => {
    const out = buildMockArchitectLetter(base);
    // career rose 200->600; social (a stated priority, stagnation-flagged) is quietest.
    expect(out.domainsInTension).toEqual(expect.arrayContaining(['social', 'career']));
    expect(out.oneBraveMove.domain).toBe('social');
  });

  it('aims the brave move at a single domain, not a list', () => {
    const out = buildMockArchitectLetter(base);
    expect(out.oneBraveMove.action.length).toBeGreaterThan(0);
    // It's one move — the schema is a single object, but assert it reads as one action.
    expect(out.oneBraveMove.action).not.toMatch(/\b(and then|;|\d\.)\b/);
  });

  it('keeps the body within 2-5 paragraphs', () => {
    const out = buildMockArchitectLetter(base);
    expect(out.body.length).toBeGreaterThanOrEqual(2);
    expect(out.body.length).toBeLessThanOrEqual(5);
  });

  it('reports lower confidence when signal is thin', () => {
    const thin = buildMockArchitectLetter({
      ...base,
      windowDays: 2,
      domains: [{ domain: 'goals', minutesThisWindow: 30, minutesPrevWindow: 0, isStatedPriority: true }],
      recentReflectionSnippets: [],
    });
    expect(thin.confidence).toBe('low');
    expect(() => ArchitectLetterSchema.parse(thin)).not.toThrow();
  });

  it('handles an empty window without crashing and stays schema-valid', () => {
    const empty = buildMockArchitectLetter({
      ...base,
      vision: null,
      name: null,
      statedPriorities: [],
      values: [],
      domains: [],
      streaks: [],
      stagnantDomains: [],
      recentReflectionSnippets: [],
      routine: { completionRate: 0, blocksCompleted: 0, blocksPlanned: 0 },
      lifeScore: { current: 50, delta: 0 },
    });
    expect(() => ArchitectLetterSchema.parse(empty)).not.toThrow();
    expect(empty.domainsInTension.length).toBeGreaterThanOrEqual(1);
  });

  it('notes overcommitment when flagged', () => {
    const out = buildMockArchitectLetter({ ...base, overcommitted: true });
    expect(out.body.join(' ').toLowerCase()).toContain('planned more');
  });

  it('stays coherent when only one domain has signal (no praise+scold or circular move)', () => {
    // Regression: when rising and quiet collapse to the same domain there is no
    // real cross-domain tension — the letter must not call one domain both the
    // bright spot and the neglected one, nor tell the user to protect X "the way
    // you already protect X".
    const out = buildMockArchitectLetter({
      ...base,
      statedPriorities: ['goals'],
      domains: [{ domain: 'goals', minutesThisWindow: 30, minutesPrevWindow: 0, isStatedPriority: true }],
      streaks: [],
      stagnantDomains: [],
      recentReflectionSnippets: [],
    });
    const text = out.body.join(' ').toLowerCase();
    expect(text).not.toContain('bright spot');
    expect(out.oneBraveMove.action.toLowerCase()).not.toContain('the way you already protect');
    expect(() => ArchitectLetterSchema.parse(out)).not.toThrow();
  });
});
