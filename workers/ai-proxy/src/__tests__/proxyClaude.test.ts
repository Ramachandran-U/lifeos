/**
 * proxyClaude — the provider-agnostic LLM dispatch. The pure transforms
 * (usage/messages/tokens/candidate parsing) are covered in their own suites;
 * this exercises the ORCHESTRATOR and the four `callX` provider adapters end to
 * end with a mocked `fetch`: request validation, provider selection, the
 * tool-use → gemini pin, per-provider request shaping (model pick, system
 * flatten/cache), response normalisation + canonical usage, the failover chain
 * (5xx/429 → next provider; auth/4xx → abort), gemini's transient-retry + model
 * fallback, and the fire-and-forget cost-event write.
 */
import type { Env } from '../index';

// Supabase REST boundary — the only non-fetch dependency claude.ts imports.
const pgInsertMock = jest.fn<Promise<void>, [unknown, string, Record<string, unknown>]>(() => Promise.resolve());
jest.mock('../lib/supabase', () => ({
  pgInsert: (env: unknown, table: string, row: Record<string, unknown>) => pgInsertMock(env, table, row),
}));

import { proxyClaude } from '../claude';

// ── fetch mock: a per-provider response queue keyed off the upstream URL ──────
type ProviderKey = 'anthropic' | 'gemini' | 'groq' | 'openai';
interface MockResp { status: number; body: string }
interface Captured { url: string; init: RequestInit | undefined }

let calls: Captured[] = [];
let queues: Record<ProviderKey, MockResp[]>;

function providerOf(url: string): ProviderKey {
  if (url.includes('api.anthropic.com')) return 'anthropic';
  if (url.includes('generativelanguage.googleapis.com')) return 'gemini';
  if (url.includes('api.groq.com')) return 'groq';
  return 'openai';
}

const fetchImpl = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  calls.push({ url, init });
  const q = queues[providerOf(url)];
  // Keep returning the last entry once the queue is down to one, so a single
  // configured response covers any number of attempts.
  const next = q.length > 1 ? q.shift() : q[0];
  if (!next) return Promise.reject(new Error(`no mock configured for ${providerOf(url)}`));
  return Promise.resolve(new Response(next.body, { status: next.status }));
};

const realFetch = globalThis.fetch;

// ── response-body factories (each provider's native success shape) ───────────
const okAnthropic = (text: string, usage: Record<string, number> | null = null): MockResp => ({
  status: 200,
  body: JSON.stringify({ content: [{ text }], model: 'claude-haiku-4-5-20251001', usage }),
});
const okGemini = (text: string, usageMetadata: Record<string, number> = {}): MockResp => ({
  status: 200,
  body: JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }], usageMetadata }),
});
const okGeminiFnCall = (name: string, args: Record<string, unknown>): MockResp => ({
  status: 200,
  body: JSON.stringify({ candidates: [{ content: { parts: [{ functionCall: { name, args } }] } }], usageMetadata: {} }),
});
const okGroq = (text: string): MockResp => ({
  status: 200,
  body: JSON.stringify({ choices: [{ message: { content: text } }], model: 'llama-3.3-70b-versatile', usage: null }),
});
const okOpenAI = (text: string): MockResp => ({
  status: 200,
  body: JSON.stringify({ choices: [{ message: { content: text } }], model: 'gpt-4o-mini' }),
});
const err = (status: number, body = 'upstream error'): MockResp => ({ status, body });

// ── harness helpers ──────────────────────────────────────────────────────────
const CORS: HeadersInit = { 'Access-Control-Allow-Origin': '*' };
const env = (over: Partial<Env> = {}): Env => ({ ...over } as Env);
const req = (body: unknown = { messages: [{ role: 'user', content: 'hi' }] }): Request =>
  new Request('https://w.test/claude', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });
const bodyJson = async (res: Response): Promise<Record<string, unknown>> => (await res.json()) as Record<string, unknown>;
const sentTo = (key: ProviderKey): Record<string, unknown> => {
  const c = [...calls].reverse().find((x) => providerOf(x.url) === key);
  if (!c || c.init?.body == null) throw new Error(`no request captured for ${key}`);
  return JSON.parse(String(c.init.body)) as Record<string, unknown>;
};

beforeEach(() => {
  calls = [];
  queues = { anthropic: [], gemini: [], groq: [], openai: [] };
  pgInsertMock.mockClear();
  globalThis.fetch = fetchImpl as typeof globalThis.fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
  jest.useRealTimers();
});

describe('proxyClaude — request validation', () => {
  it('rejects an unparseable body with 400 (no upstream call)', async () => {
    const res = await proxyClaude(req('not json'), env({ LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k' }), CORS);
    expect(res.status).toBe(400);
    expect((await bodyJson(res)).error).toBe('invalid JSON');
    expect(calls).toHaveLength(0);
  });

  it('rejects a body with no messages with 400', async () => {
    const res = await proxyClaude(req({ messages: [] }), env({ LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k' }), CORS);
    expect(res.status).toBe(400);
    expect((await bodyJson(res)).error).toBe('messages required');
  });
});

describe('proxyClaude — provider selection + normalisation', () => {
  it('routes to Anthropic and returns canonical usage', async () => {
    queues.anthropic = [okAnthropic('hello from claude', { input_tokens: 10, output_tokens: 5 })];
    const res = await proxyClaude(req(), env({ LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k' }), CORS);
    const b = await bodyJson(res);
    expect(res.status).toBe(200);
    expect(b.text).toBe('hello from claude');
    expect(b.usage).toEqual({
      input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0,
    });
  });

  it('routes to Gemini and maps usageMetadata to canonical keys', async () => {
    queues.gemini = [okGemini('hi from gemini', { promptTokenCount: 12, candidatesTokenCount: 4 })];
    const res = await proxyClaude(req(), env({ LLM_PROVIDER: 'gemini', GEMINI_API_KEY: 'g' }), CORS);
    const b = await bodyJson(res);
    expect(b.text).toBe('hi from gemini');
    expect(b.usage).toMatchObject({ input_tokens: 12, output_tokens: 4 });
  });

  it('routes to Groq and prepends the system message', async () => {
    queues.groq = [okGroq('groq says hi')];
    const res = await proxyClaude(
      req({ system: 'be terse', messages: [{ role: 'user', content: 'hi' }] }),
      env({ LLM_PROVIDER: 'groq', GROQ_API_KEY: 'gq' }), CORS,
    );
    expect((await bodyJson(res)).text).toBe('groq says hi');
    const sent = sentTo('groq');
    expect((sent.messages as Array<{ role: string }>)[0]).toEqual({ role: 'system', content: 'be terse' });
  });

  it('routes to OpenAI', async () => {
    queues.openai = [okOpenAI('openai says hi')];
    const res = await proxyClaude(req(), env({ LLM_PROVIDER: 'openai', OPENAI_API_KEY: 'oa' }), CORS);
    expect((await bodyJson(res)).text).toBe('openai says hi');
  });

  it('ignores a model whose prefix does not match the provider and uses the default', async () => {
    queues.anthropic = [okAnthropic('ok')];
    await proxyClaude(
      req({ model: 'gemini-2.5-flash', messages: [{ role: 'user', content: 'hi' }] }),
      env({ LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k' }), CORS,
    );
    expect(sentTo('anthropic').model).toBe('claude-haiku-4-5-20251001');
  });

  it('wraps a long system prompt in a cache_control block when cacheSystem is set', async () => {
    queues.anthropic = [okAnthropic('ok')];
    const longSystem = 'x'.repeat(1100);
    await proxyClaude(
      req({ system: longSystem, cacheSystem: true, messages: [{ role: 'user', content: 'hi' }] }),
      env({ LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k' }), CORS,
    );
    const sys = sentTo('anthropic').system as Array<{ cache_control?: { type: string } }>;
    expect(sys[0].cache_control).toEqual({ type: 'ephemeral' });
  });
});

describe('proxyClaude — tool-use is pinned to Gemini', () => {
  const toolBody = {
    messages: [{ role: 'user', content: 'what are my goals?' }],
    tools: [{ name: 'getGoals', description: 'list goals' }],
  };

  it('400s when tools are requested but Gemini is not configured', async () => {
    const res = await proxyClaude(req(toolBody), env({ LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k' }), CORS);
    expect(res.status).toBe(400);
    expect(String((await bodyJson(res)).error)).toMatch(/tool-use requires the gemini provider/);
    expect(calls).toHaveLength(0);
  });

  it('forces Gemini (never the configured primary) and returns functionCalls', async () => {
    queues.gemini = [okGeminiFnCall('getGoals', { limit: 5 })];
    const res = await proxyClaude(
      req(toolBody),
      env({ LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k', GEMINI_API_KEY: 'g' }), CORS,
    );
    const b = await bodyJson(res);
    expect(b.functionCalls).toEqual([{ name: 'getGoals', args: { limit: 5 } }]);
    expect(calls.every((c) => providerOf(c.url) === 'gemini')).toBe(true);
    // declarations forwarded to the model
    expect(sentTo('gemini').tools).toEqual([{ functionDeclarations: toolBody.tools }]);
  });
});

describe('proxyClaude — failover chain', () => {
  it('fails over to the next provider on a 503 and returns its result', async () => {
    queues.anthropic = [err(503, 'overloaded')];
    queues.groq = [okGroq('groq rescued the call')];
    const res = await proxyClaude(
      req(),
      env({ LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k', GROQ_API_KEY: 'gq' }), CORS,
    );
    expect(res.status).toBe(200);
    expect((await bodyJson(res)).text).toBe('groq rescued the call');
    expect(calls.map((c) => providerOf(c.url))).toEqual(['anthropic', 'groq']);
  });

  it('aborts immediately (502) on a non-failover error like 401 — no further providers tried', async () => {
    queues.anthropic = [err(401, 'bad key')];
    const res = await proxyClaude(
      req(),
      env({ LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k', GROQ_API_KEY: 'gq' }), CORS,
    );
    expect(res.status).toBe(502);
    expect(String((await bodyJson(res)).error)).toBe('anthropic 401');
    expect(calls.map((c) => providerOf(c.url))).toEqual(['anthropic']);
  });

  it('skips providers without an API key, then 502s when the whole chain is exhausted', async () => {
    // openai primary → chain [openai, groq, anthropic]; none retry internally.
    queues.openai = [err(503)];
    queues.groq = [err(500)];
    queues.anthropic = [err(502)];
    const res = await proxyClaude(
      req(),
      env({ LLM_PROVIDER: 'openai', OPENAI_API_KEY: 'oa', GROQ_API_KEY: 'gq', ANTHROPIC_API_KEY: 'k' }), CORS,
    );
    expect(res.status).toBe(502);
    const b = await bodyJson(res);
    expect(b.error).toBe('all llm providers failed');
    expect((b.attempts as unknown[]).length).toBe(3);
  });
});

describe('proxyClaude — Gemini retry + model fallback', () => {
  it('retries a transient 429 (honouring the retry hint) then succeeds', async () => {
    jest.useFakeTimers();
    queues.gemini = [err(429, 'Please retry in 0.4s'), okGemini('recovered')];
    const p = proxyClaude(req(), env({ LLM_PROVIDER: 'gemini', GEMINI_API_KEY: 'g' }), CORS);
    await jest.advanceTimersByTimeAsync(1000); // flush the back-off wait + microtasks
    const res = await p;
    expect(res.status).toBe(200);
    expect((await bodyJson(res)).text).toBe('recovered');
    expect(calls.filter((c) => providerOf(c.url) === 'gemini')).toHaveLength(2);
  });

  it('falls back to the default model when a requested model ID 404s', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    // first call (requested model) 404s, second call (default model) succeeds
    queues.gemini = [err(404, 'model not found'), okGemini('default model ok')];
    const res = await proxyClaude(
      req({ model: 'gemini-3-preview', messages: [{ role: 'user', content: 'hi' }] }),
      env({ LLM_PROVIDER: 'gemini', GEMINI_API_KEY: 'g' }), CORS,
    );
    const b = await bodyJson(res);
    expect(b.text).toBe('default model ok');
    expect(b.model).toBe('gemini-flash-latest'); // DEFAULTS.gemini
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('proxyClaude — cost-event write', () => {
  const ctxOf = (waited: Promise<unknown>[]): ExecutionContext =>
    ({ waitUntil: (p: Promise<unknown>) => { waited.push(p); }, passThroughOnException: () => undefined } as ExecutionContext);
  const ledgerEnv = (over: Partial<Env> = {}): Env =>
    env({ LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k', SUPABASE_URL: 'https://s.test', SUPABASE_SERVICE_ROLE_KEY: 'svc', ...over });

  it('records a normalised cost event when ctx + userId + Supabase creds are present', async () => {
    queues.anthropic = [okAnthropic('ok', { input_tokens: 30, output_tokens: 12 })];
    const waited: Promise<unknown>[] = [];
    await proxyClaude(req({ task: 'planDay', messages: [{ role: 'user', content: 'hi' }] }), ledgerEnv(), CORS, ctxOf(waited), 'user-1');
    await Promise.all(waited);
    expect(pgInsertMock).toHaveBeenCalledTimes(1);
    const [, table, row] = pgInsertMock.mock.calls[0];
    expect(table).toBe('ai_cost_events');
    expect(row).toMatchObject({ user_id: 'user-1', task: 'planDay', provider: 'anthropic', input_tokens: 30, output_tokens: 12 });
  });

  it('does not write a row for an all-zero usage payload', async () => {
    queues.anthropic = [okAnthropic('ok', { input_tokens: 0, output_tokens: 0 })];
    const waited: Promise<unknown>[] = [];
    await proxyClaude(req(), ledgerEnv(), CORS, ctxOf(waited), 'user-1');
    await Promise.all(waited);
    expect(pgInsertMock).not.toHaveBeenCalled();
  });

  it('swallows a ledger-write failure (best-effort, never user-facing)', async () => {
    queues.anthropic = [okAnthropic('ok', { input_tokens: 5, output_tokens: 5 })];
    pgInsertMock.mockRejectedValueOnce(new Error('supabase down'));
    const waited: Promise<unknown>[] = [];
    const res = await proxyClaude(req(), ledgerEnv(), CORS, ctxOf(waited), 'user-1');
    expect(res.status).toBe(200);
    await expect(Promise.all(waited)).resolves.toBeDefined(); // recordCostEvent caught it
  });
});
