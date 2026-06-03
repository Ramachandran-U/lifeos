import type { Env } from '../../index';
import { handleFeedback } from '../feedback';

const pgInsert = jest.fn<Promise<unknown>, [unknown, string, unknown]>();
jest.mock('../../lib/supabase', () => ({
  pgInsert: (env: unknown, table: string, body: unknown) => pgInsert(env, table, body),
}));

const CORS: HeadersInit = { 'Access-Control-Allow-Origin': '*' };
const TODAY = new Date().toISOString().slice(0, 10);

interface FakeKv {
  store: Map<string, string>;
  put: jest.Mock;
  kv: KVNamespace;
}

function makeKv(seed: Record<string, string> = {}): FakeKv {
  const store = new Map<string, string>(Object.entries(seed));
  const get = jest.fn((key: string) => Promise.resolve(store.get(key) ?? null));
  const put = jest.fn((key: string, value: string) => {
    store.set(key, value);
    return Promise.resolve();
  });
  const del = jest.fn((key: string) => {
    store.delete(key);
    return Promise.resolve();
  });
  // Plain single-signature arrows delegate to the mocks; cast to the matching
  // overloaded KVNamespace member (sufficient overlap → no `as unknown`).
  const kv = {
    get: ((key: string) => get(key)) as KVNamespace['get'],
    put: ((key: string, value: string) => put(key, value)) as KVNamespace['put'],
    delete: ((key: string) => {
      del(key);
      return Promise.resolve();
    }) as KVNamespace['delete'],
  } as Pick<KVNamespace, 'get' | 'put' | 'delete'> as KVNamespace;
  return { store, put, kv };
}

function makeEnv(kv = makeKv()): Partial<Env> {
  return { RATE_LIMIT: kv.kv };
}

function req(body: unknown, method = 'POST'): Request {
  const init: RequestInit = { method };
  // GET/HEAD requests cannot carry a body (undici rejects it).
  if (method !== 'GET' && method !== 'HEAD') {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  return new Request('https://x/v1/feedback', init);
}

beforeEach(() => {
  pgInsert.mockReset();
  pgInsert.mockResolvedValue({});
});

describe('handleFeedback', () => {
  it('non-POST → 405', async () => {
    const res = await handleFeedback(req({}, 'GET'), makeEnv() as Env, CORS);
    expect(res.status).toBe(405);
    expect(pgInsert).not.toHaveBeenCalled();
  });

  it('invalid JSON → 400', async () => {
    const res = await handleFeedback(req('{nope'), makeEnv() as Env, CORS);
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'invalid JSON' });
  });

  it('empty body → 400', async () => {
    const res = await handleFeedback(req({ body: '   ' }), makeEnv() as Env, CORS);
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'body is required' });
    expect(pgInsert).not.toHaveBeenCalled();
  });

  it('body larger than 4 KB → 413', async () => {
    const res = await handleFeedback(
      req({ body: 'x'.repeat(4097) }),
      makeEnv() as Env,
      CORS,
    );
    expect(res.status).toBe(413);
    await expect(res.json()).resolves.toEqual({ error: 'body too large' });
    expect(pgInsert).not.toHaveBeenCalled();
  });

  it('per-device daily cap reached → 429, no insert', async () => {
    const kv = makeKv({ [`feedback:dev-1:${TODAY}`]: '10' });
    const res = await handleFeedback(
      req({ body: 'this edge is sharp', device_id: 'dev-1' }),
      makeEnv(kv) as Env,
      CORS,
    );
    expect(res.status).toBe(429);
    await expect(res.json()).resolves.toEqual({ error: 'daily feedback cap reached' });
    expect(pgInsert).not.toHaveBeenCalled();
  });

  it('valid feedback → 202, truncates subject/email and inserts', async () => {
    const kv = makeKv();
    const res = await handleFeedback(
      req({
        body: 'love the app',
        subject: 's'.repeat(250),
        from_email: 'e'.repeat(300),
        device_id: 'dev-1',
        platform: 'ios',
      }),
      makeEnv(kv) as Env,
      CORS,
    );
    expect(res.status).toBe(202);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(kv.store.get(`feedback:dev-1:${TODAY}`)).toBe('1');
    expect(pgInsert).toHaveBeenCalledTimes(1);
    expect(pgInsert.mock.calls[0][1]).toBe('feedback');
    const inserted = pgInsert.mock.calls[0][2] as { subject: string; from_email: string; body: string };
    expect(inserted.subject.length).toBe(200);
    expect(inserted.from_email.length).toBe(254);
    expect(inserted.body).toBe('love the app');
  });

  it('no device_id → skips the rate-limit counter but still inserts', async () => {
    const kv = makeKv();
    const res = await handleFeedback(req({ body: 'anon report' }), makeEnv(kv) as Env, CORS);
    expect(res.status).toBe(202);
    expect(kv.put).not.toHaveBeenCalled();
    expect(pgInsert).toHaveBeenCalledTimes(1);
    expect(pgInsert.mock.calls[0][2]).toMatchObject({ device_id: null });
  });

  it('DB insert failure → 500', async () => {
    pgInsert.mockRejectedValueOnce(new Error('pg down'));
    const res = await handleFeedback(req({ body: 'oops' }), makeEnv() as Env, CORS);
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'insert failed' });
  });
});
