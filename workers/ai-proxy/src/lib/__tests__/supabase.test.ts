import { pgSelect, pgInsert, pgUpsert, pgUpdate, pgDelete, type SupabaseEnv } from '../supabase';

const ENV: SupabaseEnv = {
  SUPABASE_URL: 'https://proj.supabase.test',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-fake',
};

const realFetch = global.fetch;
const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();

function ok(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function headerOf(init: RequestInit | undefined, name: string): string | undefined {
  const h = new Headers(init?.headers);
  return h.get(name) ?? undefined;
}

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as typeof fetch;
});

afterAll(() => {
  global.fetch = realFetch;
});

describe('pgSelect', () => {
  it('GETs the table+query URL and returns parsed rows', async () => {
    fetchMock.mockResolvedValueOnce(ok([{ id: 1 }]));
    const rows = await pgSelect<{ id: number }>(ENV, 'goals', 'select=id&limit=1');
    expect(rows).toEqual([{ id: 1 }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://proj.supabase.test/rest/v1/goals?select=id&limit=1');
    expect(headerOf(init, 'apikey')).toBe('service-role-fake');
    expect(headerOf(init, 'Authorization')).toBe('Bearer service-role-fake');
  });

  it('throws on !res.ok', async () => {
    fetchMock.mockResolvedValueOnce(new Response('boom', { status: 500 }));
    await expect(pgSelect(ENV, 'goals', 'select=id')).rejects.toThrow(/supabase select goals: 500/);
  });
});

describe('pgInsert', () => {
  it('POSTs with return=representation and returns the first row', async () => {
    fetchMock.mockResolvedValueOnce(ok([{ id: 'new-1' }]));
    const row = await pgInsert<{ id: string }>(ENV, 'feedback', { body: 'hi' });
    expect(row).toEqual({ id: 'new-1' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://proj.supabase.test/rest/v1/feedback');
    expect(init?.method).toBe('POST');
    expect(headerOf(init, 'Prefer')).toBe('return=representation');
  });

  it('throws on !res.ok', async () => {
    fetchMock.mockResolvedValueOnce(new Response('dup', { status: 409 }));
    await expect(pgInsert(ENV, 'feedback', {})).rejects.toThrow(/supabase insert feedback: 409/);
  });
});

describe('pgUpsert', () => {
  it('no-ops on an empty rows array (no fetch)', async () => {
    await pgUpsert(ENV, 'mutations', []);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POSTs with ignore-duplicates + return=minimal', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 201 }));
    await pgUpsert(ENV, 'mutations', [{ id: 'm1' }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://proj.supabase.test/rest/v1/mutations');
    expect(init?.method).toBe('POST');
    expect(headerOf(init, 'Prefer')).toBe('resolution=ignore-duplicates,return=minimal');
  });

  it('throws on !res.ok', async () => {
    fetchMock.mockResolvedValueOnce(new Response('x', { status: 500 }));
    await expect(pgUpsert(ENV, 'mutations', [{ id: 'm1' }])).rejects.toThrow(
      /supabase upsert mutations: 500/,
    );
  });
});

describe('pgUpdate', () => {
  it('PATCHes the query URL with return=representation', async () => {
    fetchMock.mockResolvedValueOnce(ok([{ id: 7 }]));
    const rows = await pgUpdate<{ id: number }>(ENV, 'eval_reports', 'id=eq.7', { passed_cases: 3 });
    expect(rows).toEqual([{ id: 7 }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://proj.supabase.test/rest/v1/eval_reports?id=eq.7');
    expect(init?.method).toBe('PATCH');
    expect(headerOf(init, 'Prefer')).toBe('return=representation');
  });

  it('throws on !res.ok', async () => {
    fetchMock.mockResolvedValueOnce(new Response('x', { status: 400 }));
    await expect(pgUpdate(ENV, 'eval_reports', 'id=eq.7', {})).rejects.toThrow(
      /supabase update eval_reports: 400/,
    );
  });
});

describe('pgDelete', () => {
  it('DELETEs the query URL', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await pgDelete(ENV, 'sessions', 'id=eq.5');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://proj.supabase.test/rest/v1/sessions?id=eq.5');
    expect(init?.method).toBe('DELETE');
  });

  it('throws on !res.ok', async () => {
    fetchMock.mockResolvedValueOnce(new Response('x', { status: 403 }));
    await expect(pgDelete(ENV, 'sessions', 'id=eq.5')).rejects.toThrow(
      /supabase delete sessions: 403/,
    );
  });
});
