import { planRoutineAgent } from '../agent/planner';
import type { RoutineInput } from '../types';

// Mock the AI client so we can drive propose / critique / brief
// outputs deterministically.
jest.mock('../client', () => ({
  callAI: jest.fn(),
}));

// Mock the RAG retriever — we don't want this test touching real DBs.
jest.mock('../rag/retrieve', () => ({
  retrieveContext: jest.fn(async () => ({ hits: [], query: '' })),
  indexItems: jest.fn(async () => []),
}));

// Mock historyContext so the inner planner doesn't try to touch SQLite.
jest.mock('../historyContext', () => ({
  buildHistoryContext: jest.fn(() => []),
}));

// Mock tracing so withSpan just runs the inner fn.
jest.mock('../tracing', () => ({
  withSpan: (_label: string, fn: () => unknown) => fn(),
}));

import { callAI } from '../client';
const callAIMock = callAI as jest.MockedFunction<typeof callAI>;

const baseInput: RoutineInput = {
  wakeTime: '10:00',
  sleepTime: '23:00',
  workStartTime: '11:00',
  workEndTime: '18:00',
  goals: [],
  primaryDomains: ['health'],
  fixedBlocks: [],
  constraints: [],
  struggles: [],
  currentHabits: [],
  communicationTone: 'direct',
  inferredPreferences: {
    preferredBlockMinutes: 45,
    productiveHours: [11, 12, 13],
    droppedHabits: [],
    preferredRestDays: [],
  },
};

// Helper to script the three LLM calls (retrieve has been mocked away;
// the agent still makes propose, critique, brief).
function script(propose: object, critique: object, brief = { briefing: 'Test briefing.' }) {
  callAIMock
    .mockResolvedValueOnce(JSON.stringify(propose))
    .mockResolvedValueOnce(JSON.stringify(critique))
    .mockResolvedValueOnce(JSON.stringify(brief));
}

describe('planRoutineAgent — deterministic guards', () => {
  beforeEach(() => {
    callAIMock.mockReset();
  });

  it('drops blocks that start before wakeTime', async () => {
    script(
      {
        blocks: [
          { startTime: '07:00', endTime: '08:00', title: 'Early walk', module: 'health' },
          { startTime: '10:30', endTime: '11:00', title: 'Morning brief', module: 'goal' },
          { startTime: '11:00', endTime: '13:00', title: 'Deep work', module: 'work' },
        ],
        rationale: 'r',
      },
      { issues: [], revisedBlocks: [] },
    );
    const { plan } = await planRoutineAgent(baseInput);
    const startTimes = plan.blocks.map((b) => b.startTime);
    expect(startTimes).not.toContain('07:00');
    expect(startTimes).toEqual(['10:30', '11:00']);
  });

  it('drops blocks that end after sleepTime', async () => {
    script(
      {
        blocks: [
          { startTime: '22:00', endTime: '23:00', title: 'Wind down', module: 'rest' },
          { startTime: '23:30', endTime: '00:30', title: 'Past bedtime', module: 'rest' },
        ],
        rationale: 'r',
      },
      { issues: [], revisedBlocks: [] },
    );
    const { plan } = await planRoutineAgent(baseInput);
    // The past-bedtime block is dropped; the in-window block survives. (A
    // wake-anchor opening block may also be prepended because the only surviving
    // block sits late — see routineAnchor; this test asserts only the sleep guard.)
    const endTimes = plan.blocks.map((b) => b.endTime);
    expect(endTimes).toContain('23:00');
    expect(endTimes).not.toContain('00:30');
  });

  it('coerces hallucinated module names to valid enum values', async () => {
    script(
      {
        blocks: [
          { startTime: '10:30', endTime: '11:00', title: 'Stretch', module: 'wellness' },
          { startTime: '11:00', endTime: '12:00', title: 'Standup', module: 'personal' },
          { startTime: '12:00', endTime: '13:00', title: 'Lunch', module: 'breakfast' },
        ],
        rationale: 'r',
      },
      { issues: [], revisedBlocks: [] },
    );
    const { plan } = await planRoutineAgent(baseInput);
    expect(plan.blocks).toHaveLength(3);
    expect(plan.blocks[0].module).toBe('health');
    expect(plan.blocks[1].module).toBe('rest');
    expect(plan.blocks[2].module).toBe('meal');
  });

  it('uses critique.revisedBlocks when critique reports issues', async () => {
    script(
      {
        blocks: [{ startTime: '10:30', endTime: '11:30', title: 'Initial', module: 'goal' }],
        rationale: 'r',
      },
      {
        issues: ['Block too short'],
        revisedBlocks: [{ startTime: '10:30', endTime: '12:00', title: 'Revised', module: 'goal' }],
      },
    );
    const { plan } = await planRoutineAgent(baseInput);
    expect(plan.blocks).toHaveLength(1);
    expect(plan.blocks[0].title).toBe('Revised');
    expect(plan.blocks[0].endTime).toBe('12:00');
  });

  it('returns an empty plan rather than throwing when every block violates the window', async () => {
    script(
      {
        blocks: [
          { startTime: '06:00', endTime: '07:00', title: 'Too early', module: 'health' },
          { startTime: '23:30', endTime: '00:30', title: 'Too late', module: 'rest' },
        ],
        rationale: 'r',
      },
      { issues: [], revisedBlocks: [] },
    );
    const { plan } = await planRoutineAgent(baseInput);
    expect(plan.blocks).toEqual([]);
    expect(plan.briefing).toBe('Test briefing.');
  });
});
