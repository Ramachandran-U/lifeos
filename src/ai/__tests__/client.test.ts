/**
 * Regression test for the "decompose goal error" bug: the client read
 * `process.env.ANTHROPIC_API_KEY`, but Expo only exposes env vars prefixed
 * EXPO_PUBLIC_ to the runtime, so the key was always undefined and every
 * AI call threw "No AI backend available."
 */

type CallAI = typeof import('../client').callAI;

function loadClient(env: NodeJS.ProcessEnv): { callAI: CallAI } {
  let mod!: { callAI: CallAI };
  jest.isolateModules(() => {
    const prev = process.env;
    process.env = { ...prev, ...env };
    mod = require('../client');
    process.env = prev;
  });
  return mod;
}

describe('callAI env resolution (regression: decompose error)', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.resetAllMocks();
  });

  it('throws a helpful message when no key is set', async () => {
    const { callAI } = loadClient({
      EXPO_PUBLIC_ANTHROPIC_API_KEY: '',
      ANTHROPIC_API_KEY: '',
    });
    await expect(callAI({ system: 's', messages: [{ role: 'user', content: 'hi' }] })).rejects.toThrow(
      /EXPO_PUBLIC_ANTHROPIC_API_KEY/,
    );
  });

  it('uses EXPO_PUBLIC_ANTHROPIC_API_KEY when available (the Expo-correct var)', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ text: 'hello' }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { callAI } = loadClient({
      EXPO_PUBLIC_ANTHROPIC_API_KEY: 'sk-expo-public',
      ANTHROPIC_API_KEY: '',
    });
    const out = await callAI({ system: 's', messages: [{ role: 'user', content: 'hi' }] });
    expect(out).toBe('hello');

    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-expo-public');
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true');
  });

  it('falls back to ANTHROPIC_API_KEY (node-side scripts/tests)', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ text: 'ok' }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { callAI } = loadClient({
      EXPO_PUBLIC_ANTHROPIC_API_KEY: '',
      ANTHROPIC_API_KEY: 'sk-node',
    });
    await callAI({ system: 's', messages: [{ role: 'user', content: 'hi' }] });
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-node');
  });

  it('surfaces the real HTTP status and body on error (no longer generic)', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => '{"error":{"message":"invalid api key"}}',
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { callAI } = loadClient({ EXPO_PUBLIC_ANTHROPIC_API_KEY: 'sk-bad' });
    await expect(callAI({ system: 's', messages: [{ role: 'user', content: 'hi' }] })).rejects.toThrow(
      /401.*invalid api key/,
    );
  });
});
