/**
 * proxyAvatar — the image-out path (separate from /claude). The pure part
 * extractors are covered in avatar.test.ts; this drives the handler end to end
 * with a mocked fetch + pgInsert: config/validation guards, the size cap, the
 * upstream-error + non-JSON + no-image failures, the transient-429 retry, and
 * the happy path with its canonical usage + fire-and-forget cost event.
 */
import { proxyAvatar } from '../avatar';
import type { Env } from '../index';

const pgInsert = jest.fn<Promise<void>, [unknown, string, Record<string, unknown>]>(() => Promise.resolve());
jest.mock('../lib/supabase', () => ({ pgInsert: (e: unknown, t: string, r: Record<string, unknown>) => pgInsert(e, t, r) }));

interface MockResp { status: number; body: string }
let queue: MockResp[] = [];
const realFetch = globalThis.fetch;
const fetchImpl = (): Promise<Response> => {
  const r = queue.length > 1 ? queue.shift() : queue[0];
  if (!r) return Promise.reject(new Error('no mock response queued'));
  return Promise.resolve(new Response(r.body, { status: r.status }));
};

const imageResp = (usageMetadata: Record<string, number> = {}): MockResp => ({
  status: 200,
  body: JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { data: 'IMG_B64', mimeType: 'image/png' } }] } }], usageMetadata }),
});
const textOnlyResp = (text: string): MockResp => ({
  status: 200,
  body: JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }),
});

const CORS: HeadersInit = { 'Access-Control-Allow-Origin': '*' };
const env = (over: Partial<Env> = {}): Env => ({ GEMINI_API_KEY: 'g', ...over } as Env);
const req = (body: unknown = { imageBase64: 'c291cmNl' }): Request =>
  new Request('https://w.test/v1/image/avatar', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });
const body = async <T>(r: Response): Promise<T> => (await r.json()) as T;

beforeEach(() => { queue = []; pgInsert.mockClear(); globalThis.fetch = fetchImpl as typeof globalThis.fetch; });
afterEach(() => { globalThis.fetch = realFetch; jest.useRealTimers(); });

describe('proxyAvatar — guards', () => {
  it('400s when the gemini provider is not configured', async () => {
    const res = await proxyAvatar(req(), env({ GEMINI_API_KEY: '' }), CORS);
    expect(res.status).toBe(400);
  });
  it('400s on an unparseable body', async () => {
    expect((await proxyAvatar(req('not json'), env(), CORS)).status).toBe(400);
  });
  it('400s when imageBase64 is missing', async () => {
    expect((await proxyAvatar(req({ mimeType: 'image/png' }), env(), CORS)).status).toBe(400);
  });
  it('413s when the image is over the size cap', async () => {
    const huge = 'a'.repeat(8 * 1024 * 1024 + 1);
    expect((await proxyAvatar(req({ imageBase64: huge }), env(), CORS)).status).toBe(413);
  });
});

describe('proxyAvatar — upstream handling', () => {
  it('502s on a non-retryable upstream error', async () => {
    queue = [{ status: 400, body: 'bad request' }];
    const res = await proxyAvatar(req(), env(), CORS);
    expect(res.status).toBe(502);
    expect(String((await body<{ error: string }>(res)).error)).toBe('gemini 400');
  });

  it('502s when the upstream returns non-JSON', async () => {
    queue = [{ status: 200, body: 'definitely not json' }];
    const res = await proxyAvatar(req(), env(), CORS);
    expect(res.status).toBe(502);
    expect((await body<{ error: string }>(res)).error).toBe('gemini returned non-JSON response');
  });

  it('502s with the refusal reason when the model returns text but no image', async () => {
    queue = [textOnlyResp('I cannot transform this photo')];
    const res = await proxyAvatar(req(), env(), CORS);
    expect(res.status).toBe(502);
    const b = await body<{ error: string; detail: string }>(res);
    expect(b.error).toBe('no image generated');
    expect(b.detail).toContain('cannot transform');
  });

  it('retries a transient 429 (honouring the hint) then returns the image', async () => {
    jest.useFakeTimers();
    queue = [{ status: 429, body: 'Please retry in 0.3s' }, imageResp({ promptTokenCount: 5, candidatesTokenCount: 1 })];
    const p = proxyAvatar(req(), env(), CORS);
    await jest.advanceTimersByTimeAsync(1000);
    const res = await p;
    expect(res.status).toBe(200);
    expect((await body<{ imageBase64: string }>(res)).imageBase64).toBe('IMG_B64');
  });
});

describe('proxyAvatar — success + cost event', () => {
  it('returns the image with canonical usage and writes a cost event', async () => {
    queue = [imageResp({ promptTokenCount: 40, candidatesTokenCount: 8 })];
    const waited: Promise<unknown>[] = [];
    const ctx = { waitUntil: (pr: Promise<unknown>) => { waited.push(pr); }, passThroughOnException: () => undefined } as ExecutionContext;
    const res = await proxyAvatar(req(), env({ SUPABASE_URL: 'https://s.test', SUPABASE_SERVICE_ROLE_KEY: 'svc' }), CORS, ctx, 'user-1');
    const b = await body<{ imageBase64: string; mimeType: string; model: string; usage: { input_tokens: number } }>(res);
    expect(b).toMatchObject({ imageBase64: 'IMG_B64', mimeType: 'image/png', model: 'gemini-2.5-flash-image' });
    expect(b.usage.input_tokens).toBe(40);
    await Promise.all(waited);
    expect(pgInsert).toHaveBeenCalledWith(expect.anything(), 'ai_cost_events',
      expect.objectContaining({ user_id: 'user-1', task: 'generateAvatar', input_tokens: 40, output_tokens: 8 }));
  });

  it('does not write a cost event without ctx/userId', async () => {
    queue = [imageResp({ promptTokenCount: 40, candidatesTokenCount: 8 })];
    await proxyAvatar(req(), env(), CORS);
    expect(pgInsert).not.toHaveBeenCalled();
  });
});
