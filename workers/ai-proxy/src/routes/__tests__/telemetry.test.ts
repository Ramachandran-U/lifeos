import type { Env } from '../../index';
import { handleTelemetry } from '../telemetry';

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
  return new Request('https://x/v1/telemetry', init);
}

beforeEach(() => {
  pgInsert.mockReset();
  pgInsert.mockResolvedValue({});
});

describe('handleTelemetry', () => {
  it('non-POST → 405', async () => {
    const res = await handleTelemetry(req({}, 'GET'), makeEnv() as Env, CORS);
    expect(res.status).toBe(405);
    expect(pgInsert).not.toHaveBeenCalled();
  });

  it('invalid JSON → 400', async () => {
    const res = await handleTelemetry(req('{not json'), makeEnv() as Env, CORS);
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'invalid JSON body' });
  });

  it('missing device_id → 400', async () => {
    const res = await handleTelemetry(req({ event: 'app_opened' }), makeEnv() as Env, CORS);
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'missing or invalid device_id' });
  });

  it('device_id over 64 chars → 400', async () => {
    const res = await handleTelemetry(
      req({ device_id: 'd'.repeat(65), event: 'app_opened' }),
      makeEnv() as Env,
      CORS,
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'missing or invalid device_id' });
  });

  it('event not on allowlist → 400', async () => {
    const res = await handleTelemetry(
      req({ device_id: 'dev-1', event: 'totally_made_up' }),
      makeEnv() as Env,
      CORS,
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'event not on allowlist' });
    expect(pgInsert).not.toHaveBeenCalled();
  });

  it('props larger than 4 KB → 413', async () => {
    const big = { blob: 'z'.repeat(5000) };
    const res = await handleTelemetry(
      req({ device_id: 'dev-1', event: 'app_opened', props: big }),
      makeEnv() as Env,
      CORS,
    );
    expect(res.status).toBe(413);
    await expect(res.json()).resolves.toEqual({ error: 'props too large' });
    expect(pgInsert).not.toHaveBeenCalled();
  });

  it('per-device daily cap reached → 429, no insert', async () => {
    const kv = makeKv({ [`telemetry:dev-1:${TODAY}`]: '5000' });
    const res = await handleTelemetry(
      req({ device_id: 'dev-1', event: 'app_opened' }),
      makeEnv(kv) as Env,
      CORS,
    );
    expect(res.status).toBe(429);
    await expect(res.json()).resolves.toEqual({ error: 'daily telemetry cap reached' });
    expect(pgInsert).not.toHaveBeenCalled();
  });

  it('valid allowlisted event → 202, increments counter and inserts', async () => {
    const kv = makeKv();
    const res = await handleTelemetry(
      req({ device_id: 'dev-1', event: 'goal_created', props: { source: 'test' }, platform: 'web' }),
      makeEnv(kv) as Env,
      CORS,
    );
    expect(res.status).toBe(202);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(kv.store.get(`telemetry:dev-1:${TODAY}`)).toBe('1');
    expect(pgInsert).toHaveBeenCalledTimes(1);
    expect(pgInsert.mock.calls[0][1]).toBe('telemetry_events');
    expect(pgInsert.mock.calls[0][2]).toMatchObject({
      device_id: 'dev-1',
      event: 'goal_created',
      platform: 'web',
    });
  });

  it('DB insert failure → 500 (error not leaked verbatim)', async () => {
    pgInsert.mockRejectedValueOnce(new Error('pg down'));
    const res = await handleTelemetry(
      req({ device_id: 'dev-1', event: 'app_opened' }),
      makeEnv() as Env,
      CORS,
    );
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'insert failed' });
  });
});
