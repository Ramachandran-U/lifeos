import type { Env } from '../../index';
import { handleSyncPush, handleSyncPull } from '../sync';

// Mock the Supabase REST boundary. pgUpsert/pgSelect are the only externalities
// the sync handlers reach — we assert on the (table, query, rows) args they
// receive and never touch the network.
const pgUpsert = jest.fn<Promise<void>, [unknown, string, unknown[]]>();
const pgSelect = jest.fn<Promise<unknown[]>, [unknown, string, string]>();

jest.mock('../../lib/supabase', () => ({
  pgUpsert: (env: unknown, table: string, rows: unknown[]) => pgUpsert(env, table, rows),
  pgSelect: (env: unknown, table: string, query: string) => pgSelect(env, table, query),
}));

const CORS: HeadersInit = { 'Access-Control-Allow-Origin': '*' };
const ENV = {} as Partial<Env> as Env;
const USER_ID = 'user-jwt-sub-123';

// A wire-shape mutation that passes isValidMutation. Obviously-fake data.
function makeMutation(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'mut-1',
    entity: 'goal',
    entityId: 'goal-1',
    op: 'insert',
    before: null,
    after: { title: 'Learn the harmonica' },
    fields: ['title'],
    ts: '2026-06-03T00:00:00.000Z',
    lamport: 1,
    deviceId: 'device-abc',
    prevHash: null,
    hash: 'hash-1',
    ...overrides,
  };
}

function pushReq(body: unknown): Request {
  return new Request('https://x/v1/sync/push', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  pgUpsert.mockReset();
  pgSelect.mockReset();
  pgUpsert.mockResolvedValue(undefined);
  pgSelect.mockResolvedValue([]);
});

describe('handleSyncPush', () => {
  it('invalid JSON body → 400, no DB write', async () => {
    const res = await handleSyncPush(pushReq('{not json'), ENV, USER_ID, CORS);
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'invalid JSON' });
    expect(pgUpsert).not.toHaveBeenCalled();
  });

  it('non-array mutations → 400', async () => {
    const res = await handleSyncPush(pushReq({ mutations: { id: 'nope' } }), ENV, USER_ID, CORS);
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'mutations must be an array' });
    expect(pgUpsert).not.toHaveBeenCalled();
  });

  it('empty array → { acked: [] } 200 without touching the DB', async () => {
    const res = await handleSyncPush(pushReq({ mutations: [] }), ENV, USER_ID, CORS);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ acked: [] });
    expect(pgUpsert).not.toHaveBeenCalled();
  });

  it('batch larger than 500 → 413', async () => {
    const mutations = Array.from({ length: 501 }, (_, i) =>
      makeMutation({ id: `mut-${i}`, hash: `hash-${i}` }),
    );
    const res = await handleSyncPush(pushReq({ mutations }), ENV, USER_ID, CORS);
    expect(res.status).toBe(413);
    await expect(res.json()).resolves.toEqual({ error: 'batch too large (max 500)' });
    expect(pgUpsert).not.toHaveBeenCalled();
  });

  it('a mutation failing isValidMutation → 400', async () => {
    const bad = makeMutation({ lamport: 'not-a-number' });
    const res = await handleSyncPush(pushReq({ mutations: [makeMutation(), bad] }), ENV, USER_ID, CORS);
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'malformed mutation in batch' });
    expect(pgUpsert).not.toHaveBeenCalled();
  });

  it('a non-finite lamport (NaN) is rejected as malformed', async () => {
    const bad = makeMutation({ lamport: NaN });
    const res = await handleSyncPush(pushReq({ mutations: [bad] }), ENV, USER_ID, CORS);
    expect(res.status).toBe(400);
    expect(pgUpsert).not.toHaveBeenCalled();
  });

  it('an unknown op value is rejected as malformed', async () => {
    const bad = makeMutation({ op: 'merge' });
    const res = await handleSyncPush(pushReq({ mutations: [bad] }), ENV, USER_ID, CORS);
    expect(res.status).toBe(400);
    expect(pgUpsert).not.toHaveBeenCalled();
  });

  it('SECURITY: a client-supplied userId is ignored; rows are forced to the JWT userId', async () => {
    const spoofed = makeMutation({ userId: 'attacker', user_id: 'attacker' });
    const res = await handleSyncPush(pushReq({ mutations: [spoofed] }), ENV, USER_ID, CORS);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ acked: ['mut-1'] });

    expect(pgUpsert).toHaveBeenCalledTimes(1);
    const [, table, rows] = pgUpsert.mock.calls[0];
    expect(table).toBe('mutations');
    const stored = rows as Array<Record<string, unknown>>;
    expect(stored).toHaveLength(1);
    // Every stored row's user_id is the JWT subject, never the client's spoof.
    expect(stored[0].user_id).toBe(USER_ID);
    expect(stored.every((r) => r.user_id === USER_ID)).toBe(true);
    expect(stored[0].user_id).not.toBe('attacker');
  });

  it('maps the wire mutation into the snake_case row shape, stringifying before/after/fields', async () => {
    const m = makeMutation({
      before: { a: 1 },
      after: { b: 2 },
      fields: ['title', 'note'],
      prevHash: 'prev-xyz',
    });
    await handleSyncPush(pushReq({ mutations: [m] }), ENV, USER_ID, CORS);

    const [, , rows] = pgUpsert.mock.calls[0];
    const row = (rows as Array<Record<string, unknown>>)[0];
    expect(row).toEqual({
      id: 'mut-1',
      user_id: USER_ID,
      entity: 'goal',
      entity_id: 'goal-1',
      op: 'insert',
      before_json: JSON.stringify({ a: 1 }),
      after_json: JSON.stringify({ b: 2 }),
      fields_json: JSON.stringify(['title', 'note']),
      ts: '2026-06-03T00:00:00.000Z',
      lamport: 1,
      device_id: 'device-abc',
      prev_hash: 'prev-xyz',
      hash: 'hash-1',
    });
  });

  it('null before/after become null *_json columns; missing fields become []', async () => {
    const m = makeMutation({ before: null, after: null });
    delete m.fields;
    await handleSyncPush(pushReq({ mutations: [m] }), ENV, USER_ID, CORS);

    const [, , rows] = pgUpsert.mock.calls[0];
    const row = (rows as Array<Record<string, unknown>>)[0];
    expect(row.before_json).toBeNull();
    expect(row.after_json).toBeNull();
    expect(row.fields_json).toBe(JSON.stringify([]));
  });

  it('pgUpsert throwing → 500', async () => {
    pgUpsert.mockRejectedValueOnce(new Error('supabase upsert mutations: 503'));
    const res = await handleSyncPush(pushReq({ mutations: [makeMutation()] }), ENV, USER_ID, CORS);
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'push failed' });
  });
});

describe('handleSyncPull', () => {
  function pullReq(qs: string): Request {
    return new Request(`https://x/v1/sync/pull${qs}`);
  }

  it('CRITICAL: query is scoped to this user (user_id=eq.<userId>) and seq=gt.<since>', async () => {
    await handleSyncPull(pullReq('?since=42&limit=10'), ENV, USER_ID, CORS);

    expect(pgSelect).toHaveBeenCalledTimes(1);
    const [, table, query] = pgSelect.mock.calls[0];
    expect(table).toBe('mutations');
    expect(query).toContain(`user_id=eq.${encodeURIComponent(USER_ID)}`);
    expect(query).toContain('seq=gt.42');
    expect(query).toContain('order=seq.asc');
    expect(query).toContain('limit=10');
  });

  it('clamps a negative since to 0', async () => {
    await handleSyncPull(pullReq('?since=-1&limit=9999'), ENV, USER_ID, CORS);
    const [, , query] = pgSelect.mock.calls[0];
    expect(query).toContain('seq=gt.0');
  });

  it('clamps a >1000 limit down to 1000', async () => {
    await handleSyncPull(pullReq('?since=0&limit=9999'), ENV, USER_ID, CORS);
    const [, , query] = pgSelect.mock.calls[0];
    expect(query).toContain('limit=1000');
  });

  it('falls back to the default limit (500) when limit is NaN', async () => {
    await handleSyncPull(pullReq('?since=0&limit=abc'), ENV, USER_ID, CORS);
    const [, , query] = pgSelect.mock.calls[0];
    expect(query).toContain('limit=500');
  });

  it('floors a negative-then-clamped limit to at least 1', async () => {
    await handleSyncPull(pullReq('?since=0&limit=-5'), ENV, USER_ID, CORS);
    const [, , query] = pgSelect.mock.calls[0];
    expect(query).toContain('limit=1');
  });

  it('cursor === since when no rows are returned', async () => {
    pgSelect.mockResolvedValueOnce([]);
    const res = await handleSyncPull(pullReq('?since=7'), ENV, USER_ID, CORS);
    const body = (await res.json()) as { mutations: unknown[]; cursor: number };
    expect(body.mutations).toEqual([]);
    expect(body.cursor).toBe(7);
  });

  it('cursor === the last row seq when rows are returned', async () => {
    pgSelect.mockResolvedValueOnce([
      {
        id: 'r1', user_id: USER_ID, entity: 'goal', entity_id: 'g1', op: 'insert',
        before_json: null, after_json: JSON.stringify({ title: 'x' }), fields_json: JSON.stringify(['title']),
        ts: '2026-06-03T00:00:00.000Z', lamport: 1, device_id: 'd1', prev_hash: null, hash: 'h1', seq: 11,
      },
      {
        id: 'r2', user_id: USER_ID, entity: 'goal', entity_id: 'g2', op: 'update',
        before_json: JSON.stringify({ title: 'x' }), after_json: JSON.stringify({ title: 'y' }), fields_json: JSON.stringify(['title']),
        ts: '2026-06-03T00:01:00.000Z', lamport: 2, device_id: 'd1', prev_hash: 'h1', hash: 'h2', seq: 23,
      },
    ]);
    const res = await handleSyncPull(pullReq('?since=0'), ENV, USER_ID, CORS);
    const body = (await res.json()) as { mutations: Array<Record<string, unknown>>; cursor: number };
    expect(body.cursor).toBe(23);
    expect(body.mutations).toHaveLength(2);
    // Wire shape is camelCase; before/after are parsed back from *_json.
    expect(body.mutations[0]).toMatchObject({
      id: 'r1', entityId: 'g1', op: 'insert', before: null, after: { title: 'x' }, deviceId: 'd1',
    });
    expect(body.mutations[1].before).toEqual({ title: 'x' });
  });

  it('malformed *_json parses to null (before/after) and [] (fields), not a throw', async () => {
    pgSelect.mockResolvedValueOnce([
      {
        id: 'r1', user_id: USER_ID, entity: 'goal', entity_id: 'g1', op: 'update',
        before_json: '{broken', after_json: 'also broken', fields_json: 'nope',
        ts: '2026-06-03T00:00:00.000Z', lamport: 1, device_id: 'd1', prev_hash: null, hash: 'h1', seq: 5,
      },
    ]);
    const res = await handleSyncPull(pullReq('?since=0'), ENV, USER_ID, CORS);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { mutations: Array<Record<string, unknown>> };
    expect(body.mutations[0].before).toBeNull();
    expect(body.mutations[0].after).toBeNull();
    expect(body.mutations[0].fields).toEqual([]);
  });

  it('pgSelect throwing → 500', async () => {
    pgSelect.mockRejectedValueOnce(new Error('supabase select mutations: 500'));
    const res = await handleSyncPull(pullReq('?since=0'), ENV, USER_ID, CORS);
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'pull failed' });
  });
});
