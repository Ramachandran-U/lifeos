import { runToolAgent, type AgentTool } from '../agent/runtime';

jest.mock('../client', () => ({
  callAIRaw: jest.fn(),
}));
jest.mock('../tracing', () => ({
  withSpan: (_label: string, fn: () => unknown) => fn(),
}));

import { callAIRaw } from '../client';
const rawMock = callAIRaw as jest.MockedFunction<typeof callAIRaw>;

function tool(name: string, execute: AgentTool['execute']): AgentTool {
  return { declaration: { name, description: name, parameters: { type: 'object', properties: {} } }, execute };
}

const baseArgs = {
  system: 'sys',
  userMessage: 'what next?',
};

describe('runToolAgent', () => {
  beforeEach(() => rawMock.mockReset());

  it('answers directly when the model returns no tool calls', async () => {
    rawMock.mockResolvedValueOnce({ text: 'do the thing', functionCalls: [], model: 'm' });
    const res = await runToolAgent({ ...baseArgs, tools: [] });
    expect(res.answer).toBe('do the thing');
    expect(res.iterations).toBe(1);
    expect(rawMock).toHaveBeenCalledTimes(1);
  });

  it('executes a requested tool and feeds the result back', async () => {
    const exec = jest.fn(() => [{ title: 'Ship app' }]);
    rawMock
      .mockResolvedValueOnce({
        text: '',
        functionCalls: [{ name: 'getGoals', args: {} }],
        model: 'm',
      })
      .mockResolvedValueOnce({ text: 'focus on Ship app', functionCalls: [], model: 'm' });

    const res = await runToolAgent({ ...baseArgs, tools: [tool('getGoals', exec)] });

    expect(exec).toHaveBeenCalledTimes(1);
    expect(res.answer).toBe('focus on Ship app');
    expect(res.iterations).toBe(2);
    // Second call must carry the assistant functionCall turn + user functionResponse turn.
    const secondCallMessages = rawMock.mock.calls[1][0].messages;
    expect(secondCallMessages).toHaveLength(3); // user, assistant(call), user(response)
    expect(secondCallMessages[1].content).toEqual([{ functionCall: { name: 'getGoals', args: {} } }]);
    expect(secondCallMessages[2].content).toEqual([
      { functionResponse: { name: 'getGoals', response: { result: [{ title: 'Ship app' }] } } },
    ]);
  });

  it('returns an error to the model for an unknown tool (does not throw)', async () => {
    rawMock
      .mockResolvedValueOnce({
        text: '',
        functionCalls: [{ name: 'doesNotExist', args: {} }],
        model: 'm',
      })
      .mockResolvedValueOnce({ text: 'sorry, recovered', functionCalls: [], model: 'm' });

    const res = await runToolAgent({ ...baseArgs, tools: [] });
    expect(res.answer).toBe('sorry, recovered');
    const responseTurn = rawMock.mock.calls[1][0].messages[2].content as Array<{
      functionResponse: { response: Record<string, unknown> };
    }>;
    expect(responseTurn[0].functionResponse.response).toEqual({ error: 'unknown tool: doesNotExist' });
  });

  it('catches a throwing tool and reports the error to the model', async () => {
    const exec = jest.fn(() => {
      throw new Error('db exploded');
    });
    rawMock
      .mockResolvedValueOnce({
        text: '',
        functionCalls: [{ name: 'getGoals', args: {} }],
        model: 'm',
      })
      .mockResolvedValueOnce({ text: 'handled', functionCalls: [], model: 'm' });

    const res = await runToolAgent({ ...baseArgs, tools: [tool('getGoals', exec)] });
    expect(res.answer).toBe('handled');
    const responseTurn = rawMock.mock.calls[1][0].messages[2].content as Array<{
      functionResponse: { response: Record<string, unknown> };
    }>;
    expect(responseTurn[0].functionResponse.response).toEqual({ error: 'db exploded' });
  });

  it('forces a tool-free final answer when the iteration cap is hit', async () => {
    // Model keeps asking for a tool forever.
    rawMock.mockResolvedValue({
      text: '',
      functionCalls: [{ name: 'getGoals', args: {} }],
      model: 'm',
    });
    // The forced final call (no tools) returns text.
    rawMock.mockResolvedValueOnce({ text: '', functionCalls: [{ name: 'getGoals', args: {} }], model: 'm' });

    const res = await runToolAgent({
      ...baseArgs,
      tools: [tool('getGoals', () => [])],
      maxIterations: 2,
    });

    // 2 loop iterations + 1 forced final call.
    expect(rawMock).toHaveBeenCalledTimes(3);
    // Last call must NOT include tools.
    const finalCall = rawMock.mock.calls[2][0];
    expect(finalCall.tools).toBeUndefined();
    expect(res.iterations).toBe(2);
  });

  it('clamps maxIterations to the hard ceiling of 10', async () => {
    rawMock.mockResolvedValue({
      text: '',
      functionCalls: [{ name: 'x', args: {} }],
      model: 'm',
    });
    await runToolAgent({ ...baseArgs, tools: [], maxIterations: 999 });
    // 10 loop iterations + 1 forced final = 11 calls max.
    expect(rawMock.mock.calls.length).toBeLessThanOrEqual(11);
  });
});
