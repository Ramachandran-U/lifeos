import type { Env } from '../../index';
import { handleEvalReport } from '../evalReports';

const pgSelect = jest.fn<Promise<unknown[]>, [unknown, string, string]>();
const pgUpdate = jest.fn<Promise<unknown[]>, [unknown, string, string, unknown]>();
const pgInsert = jest.fn<Promise<unknown>, [unknown, string, unknown]>();
jest.mock('../../lib/supabase', () => ({
  pgSelect: (env: unknown, table: string, query: string) => pgSelect(env, table, query),
  pgUpdate: (env: unknown, table: string, query: string, patch: unknown) =>
    pgUpdate(env, table, query, patch),
  pgInsert: (env: unknown, table: string, body: unknown) => pgInsert(env, table, body),
}));

const CORS: HeadersInit = { 'Access-Control-Allow-Origin': '*' };
const TOKEN = 'reporter-token-fake';

function makeEnv(over: Partial<Env> = {}): Partial<Env> {
  return { EVAL_REPORTER_TOKEN: TOKEN, ...over };
}

function req(body: unknown, token: string | null = TOKEN, method = 'POST'): Request {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const init: RequestInit = { method, headers };
  // GET/HEAD requests cannot carry a body (undici rejects it).
  if (method !== 'GET' && method !== 'HEAD') {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  return new Request('https://x/v1/evals/report', init);
}

const SUITES = [
  { name: 'goals', passRate: 1, threshold: 0.9, status: 'pass' as const, cases: 4 },
  { name: 'finance', passRate: 0.5, threshold: 0.8, status: 'fail' as const, cases: 2 },
];

function validBody(over: Record<string, unknown> = {}): Record<string, unknown> {
  return { branch: 'lifeosv1', commit_sha: 'abc123', mode: 'MOCK', suites: SUITES, ...over };
}

beforeEach(() => {
  pgSelect.mockReset();
  pgUpdate.mockReset();
  pgInsert.mockReset();
  pgSelect.mockResolvedValue([]);
  pgUpdate.mockResolvedValue([]);
  pgInsert.mockResolvedValue({});
});

describe('handleEvalReport', () => {
  it('non-POST → 405', async () => {
    const res = await handleEvalReport(req(validBody(), TOKEN, 'GET'), makeEnv() as Env, CORS);
    expect(res.status).toBe(405);
  });

  it('reporter not configured → 500', async () => {
    const res = await handleEvalReport(req(validBody()), makeEnv({ EVAL_REPORTER_TOKEN: '' }) as Env, CORS);
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'eval reporter not configured' });
  });

  it('token mismatch → 401', async () => {
    const res = await handleEvalReport(req(validBody(), 'wrong-token'), makeEnv() as Env, CORS);
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'unauthorized' });
    expect(pgSelect).not.toHaveBeenCalled();
  });

  it('missing Authorization header → 401', async () => {
    const res = await handleEvalReport(req(validBody(), null), makeEnv() as Env, CORS);
    expect(res.status).toBe(401);
  });

  it('invalid JSON → 400', async () => {
    const res = await handleEvalReport(req('{nope'), makeEnv() as Env, CORS);
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'invalid JSON' });
  });

  it('missing required fields → 400', async () => {
    const res = await handleEvalReport(req(validBody({ branch: undefined })), makeEnv() as Env, CORS);
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'missing required fields' });
  });

  it('invalid mode value → 400', async () => {
    const res = await handleEvalReport(req(validBody({ mode: 'STAGING' })), makeEnv() as Env, CORS);
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'mode must be MOCK or LIVE' });
  });

  it('no existing row → inserts and reports computed totals', async () => {
    pgSelect.mockResolvedValueOnce([]);
    const res = await handleEvalReport(req(validBody()), makeEnv() as Env, CORS);
    expect(res.status).toBe(200);
    // 4 + 2 cases; passed = round(1*4) + round(0.5*2) = 4 + 1 = 5.
    await expect(res.json()).resolves.toEqual({ ok: true, total: 6, passed: 5 });
    expect(pgInsert).toHaveBeenCalledTimes(1);
    expect(pgUpdate).not.toHaveBeenCalled();
    expect(pgInsert.mock.calls[0][1]).toBe('eval_reports');
    expect(pgInsert.mock.calls[0][2]).toMatchObject({
      branch: 'lifeosv1',
      commit_sha: 'abc123',
      mode: 'MOCK',
      total_cases: 6,
      passed_cases: 5,
    });
  });

  it('existing row → upserts via pgUpdate keyed on its id', async () => {
    pgSelect.mockResolvedValueOnce([{ id: 42 }]);
    const res = await handleEvalReport(req(validBody()), makeEnv() as Env, CORS);
    expect(res.status).toBe(200);
    expect(pgUpdate).toHaveBeenCalledTimes(1);
    expect(pgInsert).not.toHaveBeenCalled();
    expect(pgUpdate.mock.calls[0][1]).toBe('eval_reports');
    expect(pgUpdate.mock.calls[0][2]).toBe('id=eq.42');
  });

  it('DB write failure → 500', async () => {
    pgInsert.mockRejectedValueOnce(new Error('pg down'));
    const res = await handleEvalReport(req(validBody()), makeEnv() as Env, CORS);
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'upsert failed' });
  });
});
