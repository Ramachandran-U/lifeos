// Transport-resilience tests for the AI client (src/ai/client.ts). These cover
// the timeout + bounded-retry seam added after the voice incident: a transient
// worker 5xx / network blip / hang should self-recover, while 4xx / 429 / caller
// cancellation must NOT be retried. We mock only the lowest seams (fetch + the
// Supabase token + telemetry) so the real retry/timeout logic runs.

jest.mock('@/integrations/supabase/session', () => ({
  getSupabaseAccessToken: jest.fn(async () => 'test-token'),
}));
jest.mock('@/utils/telemetry', () => ({
  track: jest.fn(),
  EVENTS: { aiCall: 'ai_call' },
}));

import { callAI } from '../client';
import type { AIRequest } from '../types';

const fetchMock = jest.fn();
const req: AIRequest = { messages: [{ role: 'user', content: 'hi' }], task: 'chatbot' };

function jsonResponse(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    headers: { get: () => null },
  } as unknown as Response;
}

function abortError(): Error {
  const e = new Error('Aborted');
  e.name = 'AbortError';
  return e;
}

beforeEach(() => {
  fetchMock.mockReset();
  (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
  jest.useFakeTimers();
  jest.spyOn(Math, 'random').mockReturnValue(0); // deterministic backoff: 400ms, 1200ms
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('returns text on first success without retrying', async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(200, { text: 'hello', model: 'm' }));
  await expect(callAI(req)).resolves.toBe('hello');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('retries a transient worker 5xx then succeeds', async () => {
  fetchMock
    .mockResolvedValueOnce(jsonResponse(503, 'unavailable'))
    .mockResolvedValueOnce(jsonResponse(200, { text: 'ok', model: 'm' }));
  const p = callAI(req);
  await jest.advanceTimersByTimeAsync(500); // flush the 400ms backoff
  await expect(p).resolves.toBe('ok');
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('retries a network error then succeeds', async () => {
  fetchMock
    .mockRejectedValueOnce(new TypeError('network request failed'))
    .mockResolvedValueOnce(jsonResponse(200, { text: 'recovered', model: 'm' }));
  const p = callAI(req);
  await jest.advanceTimersByTimeAsync(500);
  await expect(p).resolves.toBe('recovered');
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('does NOT retry a 429 — surfaces the daily-limit message immediately', async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(429, 'rate limited'));
  await expect(callAI(req)).rejects.toThrow(/today's AI limit/);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('does NOT retry a 4xx', async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(400, 'bad request'));
  await expect(callAI(req)).rejects.toThrow(/AI proxy 400/);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('gives up after the retry budget on a persistent 5xx (3 attempts)', async () => {
  fetchMock.mockResolvedValue(jsonResponse(503, 'still down'));
  const p = callAI(req).catch((e) => e);
  await jest.advanceTimersByTimeAsync(3000); // flush both backoffs (400 + 1200)
  expect(String(await p)).toMatch(/AI proxy 503/);
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

it('times out a hung request and surfaces a timeout message', async () => {
  // Never resolves; rejects only when its signal is aborted (mirrors a real hang).
  fetchMock.mockImplementation(
    (_url: string, init: { signal?: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(abortError()));
      }),
  );
  const p = callAI(req).catch((e) => e);
  // 3 attempts, each timing out at 30s, with 400ms + 1200ms backoffs between.
  await jest.advanceTimersByTimeAsync(3 * 30_000 + 2_000);
  expect(String(await p)).toMatch(/timed out/);
  expect(fetchMock).toHaveBeenCalledTimes(3);
});
