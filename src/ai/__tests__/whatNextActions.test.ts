import { whatShouldIDoNextWithActions } from '../agent/whatNext';

// Mock the read tools + runtime + logging, but use the REAL writeTools +
// actionQueue so the propose→capture wiring is exercised end-to-end.
jest.mock('../agent/runtime', () => ({ runToolAgent: jest.fn() }));
jest.mock('../agent/tools', () => ({ buildLifeOsTools: jest.fn(() => []), isMemoryToolEnabled: jest.fn(() => false) }));
jest.mock('@/db/queries/aiSuggestions', () => ({ logAiSuggestion: jest.fn(() => Promise.resolve('id')) }));

import { runToolAgent } from '../agent/runtime';
import { logAiSuggestion } from '@/db/queries/aiSuggestions';

const runMock = runToolAgent as jest.MockedFunction<typeof runToolAgent>;
const logMock = logAiSuggestion as jest.MockedFunction<typeof logAiSuggestion>;

describe('whatShouldIDoNextWithActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.EXPO_PUBLIC_USE_AI_MOCK;
    delete process.env.USE_AI_MOCK;
  });

  it('returns a mock proposal without running the agent in mock mode', async () => {
    process.env.USE_AI_MOCK = 'true';
    const res = await whatShouldIDoNextWithActions({ userId: 'u1' });
    expect(runMock).not.toHaveBeenCalled();
    expect(res.proposedActions).toHaveLength(1);
    expect(res.proposedActions[0].kind).toBe('createRoutineBlock');
  });

  it('captures proposals the agent makes via write tools (nothing mutates)', async () => {
    // Simulate the agent calling proposeCompleteBlock during the loop.
    runMock.mockImplementation(async ({ tools }) => {
      const tool = tools.find((t) => t.declaration.name === 'proposeCompleteBlock')!;
      await tool.execute({ ref: 'block-123' });
      return { answer: 'Start your focus block.', trace: [], iterations: 2 };
    });

    const res = await whatShouldIDoNextWithActions({ userId: 'u1', today: '2026-05-30' });

    expect(res.answer).toBe('Start your focus block.');
    expect(res.proposedActions).toEqual([
      { kind: 'completeBlock', summary: 'Mark a block complete', payload: { ref: 'block-123' } },
    ]);
  });

  it('includes both read and write tools in the agent run', async () => {
    runMock.mockResolvedValue({ answer: 'x', trace: [], iterations: 1 });
    await whatShouldIDoNextWithActions({ userId: 'u1' });
    const names = runMock.mock.calls[0][0].tools.map((t) => t.declaration.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'proposeCreateRoutineBlock',
        'proposeCompleteBlock',
        'proposeSkipBlock',
        'proposeAdjustGoalStatus',
      ]),
    );
  });

  it('logs the run with a proposals count and survives a logging failure', async () => {
    runMock.mockResolvedValue({ answer: 'x', trace: [], iterations: 1 });
    logMock.mockRejectedValueOnce(new Error('db down'));
    const res = await whatShouldIDoNextWithActions({ userId: 'u1' });
    expect(res.answer).toBe('x');
    expect(logMock).toHaveBeenCalledTimes(1);
    expect(logMock.mock.calls[0][0].outputSummary).toMatch(/proposals=/);
  });
});
