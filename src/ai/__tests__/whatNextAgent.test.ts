import { whatShouldIDoNext } from '../agent/whatNext';

jest.mock('../agent/runtime', () => ({ runToolAgent: jest.fn() }));
jest.mock('../agent/tools', () => ({ buildLifeOsTools: jest.fn(() => []), isMemoryToolEnabled: jest.fn(() => false) }));
jest.mock('@/db/queries/aiSuggestions', () => ({ logAiSuggestion: jest.fn(() => Promise.resolve('id')) }));

import { runToolAgent } from '../agent/runtime';
import { buildLifeOsTools } from '../agent/tools';
import { logAiSuggestion } from '@/db/queries/aiSuggestions';

const runMock = runToolAgent as jest.MockedFunction<typeof runToolAgent>;
const buildMock = buildLifeOsTools as jest.MockedFunction<typeof buildLifeOsTools>;
const logMock = logAiSuggestion as jest.MockedFunction<typeof logAiSuggestion>;

describe('whatShouldIDoNext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.EXPO_PUBLIC_USE_AI_MOCK;
    delete process.env.USE_AI_MOCK;
  });

  it('returns a deterministic mock answer without running the agent in mock mode', async () => {
    process.env.USE_AI_MOCK = 'true';
    const res = await whatShouldIDoNext({ userId: 'u1' });
    expect(runMock).not.toHaveBeenCalled();
    expect(res.answer.length).toBeGreaterThan(0);
    expect(res.trace.some((s) => s.kind === 'answer')).toBe(true);
  });

  it('builds tools bound to the user/date and runs the agent', async () => {
    runMock.mockResolvedValue({ answer: 'do X', trace: [], iterations: 3 });
    const res = await whatShouldIDoNext({ userId: 'u1', today: '2026-05-30' });

    expect(buildMock).toHaveBeenCalledWith({ userId: 'u1', today: '2026-05-30' });
    expect(runMock).toHaveBeenCalledTimes(1);
    const arg = runMock.mock.calls[0][0];
    expect(arg.task).toBe('agent.whatNext');
    expect(arg.maxIterations).toBe(6);
    expect(res.answer).toBe('do X');
  });

  it('logs the run to ai_suggestions (task what_next, variant agent)', async () => {
    runMock.mockResolvedValue({ answer: 'do X', trace: [], iterations: 2 });
    await whatShouldIDoNext({ userId: 'u1' });
    expect(logMock).toHaveBeenCalledTimes(1);
    const logged = logMock.mock.calls[0][0];
    expect(logged.task).toBe('what_next');
    expect(logged.variant).toBe('agent');
    expect(logged.userId).toBe('u1');
  });

  it('still returns the answer even if suggestion logging rejects', async () => {
    runMock.mockResolvedValue({ answer: 'do X', trace: [], iterations: 1 });
    logMock.mockRejectedValueOnce(new Error('db down'));
    const res = await whatShouldIDoNext({ userId: 'u1' });
    expect(res.answer).toBe('do X');
  });
});
