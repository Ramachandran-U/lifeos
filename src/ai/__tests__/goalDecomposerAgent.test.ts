import { decomposeGoalAgent } from '../agent/goalDecomposer';
import type { GoalInput, GoalHierarchy } from '../types';

jest.mock('../client', () => ({
  callAI: jest.fn(),
}));

jest.mock('../tracing', () => ({
  withSpan: (_label: string, fn: () => unknown) => fn(),
}));

import { callAI } from '../client';
const callAIMock = callAI as jest.MockedFunction<typeof callAI>;

const baseInput: GoalInput = {
  visionStatement: 'become a senior backend engineer at a growth-stage company',
  name: 'Ada',
};

function fullHierarchy(overrides: Partial<GoalHierarchy> = {}): GoalHierarchy {
  return {
    primaryGoal: { title: 'Become a senior backend engineer', type: 'career' },
    yearly: { title: 'Senior backend role', milestone: 'Signed offer letter for a senior backend role' },
    monthly: Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      title: `Month ${i + 1} artefact`,
      milestone: `Month ${i + 1} artefact exists in repo`,
    })),
    weekly: Array.from({ length: 4 }, (_, i) => ({
      week: i + 1,
      focus: `Week ${i + 1} focus`,
      tasks: ['Ship X', 'Benchmark Y', 'Document Z'],
    })),
    dailyTaskExamples: [
      'Write 300 words of design doc',
      'Implement one repository pattern test',
      'Read 1 chapter of DDIA and take notes',
    ],
    ...overrides,
  };
}

describe('decomposeGoalAgent', () => {
  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_USE_AI_MOCK;
    delete process.env.USE_AI_MOCK;
    callAIMock.mockReset();
  });

  test('returns mock hierarchy without calling AI when USE_AI_MOCK is on', async () => {
    process.env.USE_AI_MOCK = 'true';
    const { hierarchy, trace } = await decomposeGoalAgent(baseInput);
    expect(callAIMock).not.toHaveBeenCalled();
    expect(hierarchy.primaryGoal.title.length).toBeGreaterThan(0);
    expect(trace.map((s) => s.kind)).toEqual(['propose', 'critique', 'commit']);
  });

  test('runs propose → critique → commit and returns critique.revised when issues present', async () => {
    const proposed = fullHierarchy({
      primaryGoal: { title: 'OK', type: 'career' },
    });
    const revised = fullHierarchy({
      primaryGoal: { title: 'Revised title', type: 'career' },
    });
    callAIMock.mockResolvedValueOnce(JSON.stringify(proposed));
    callAIMock.mockResolvedValueOnce(
      JSON.stringify({ issues: ['monthly titles too vague'], revised }),
    );

    const { hierarchy, trace } = await decomposeGoalAgent(baseInput);
    expect(callAIMock).toHaveBeenCalledTimes(2);
    expect(hierarchy.primaryGoal.title).toBe('Revised title');
    const commit = trace.find((s) => s.kind === 'commit');
    expect(commit && (commit as { primaryTitle: string }).primaryTitle).toBe('Revised title');
  });

  test('returns proposed hierarchy when critique reports no issues', async () => {
    const proposed = fullHierarchy({ primaryGoal: { title: 'Original', type: 'career' } });
    callAIMock.mockResolvedValueOnce(JSON.stringify(proposed));
    callAIMock.mockResolvedValueOnce(
      JSON.stringify({ issues: [], revised: proposed }),
    );

    const { hierarchy, trace } = await decomposeGoalAgent(baseInput);
    expect(hierarchy.primaryGoal.title).toBe('Original');
    const critique = trace.find((s) => s.kind === 'critique');
    expect(critique && (critique as { revised: boolean }).revised).toBe(false);
  });

  test('coerces unknown primaryGoal.type to personal', async () => {
    const proposed = fullHierarchy({
      primaryGoal: { title: 'X', type: 'wellness' as unknown as 'health' },
    });
    callAIMock.mockResolvedValueOnce(JSON.stringify(proposed));
    callAIMock.mockResolvedValueOnce(JSON.stringify({ issues: [], revised: proposed }));

    const { hierarchy } = await decomposeGoalAgent(baseInput);
    expect(hierarchy.primaryGoal.type).toBe('health');
  });

  test('flags incomplete monthly entries in trace', async () => {
    const proposed = fullHierarchy({
      monthly: Array.from({ length: 10 }, (_, i) => ({
        month: i + 1,
        title: `M${i + 1}`,
        milestone: `M${i + 1} exists`,
      })),
    });
    callAIMock.mockResolvedValueOnce(JSON.stringify(proposed));
    callAIMock.mockResolvedValueOnce(JSON.stringify({ issues: [], revised: proposed }));

    const { trace } = await decomposeGoalAgent(baseInput);
    const guardCritique = trace.filter(
      (s): s is { kind: 'critique'; issues: string[]; revised: boolean } => s.kind === 'critique',
    )[1];
    expect(guardCritique).toBeDefined();
    expect(guardCritique.issues[0]).toMatch(/monthly entries incomplete/);
  });
});
