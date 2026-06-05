/**
 * Router dispatch table (index.ts). Complements index.router.test.ts (which
 * covers CORS, the /claude buckets and the auth/admin gates) by walking every
 * remaining route to its handler with all downstream modules mocked to tagged
 * no-ops — so this exercises index.ts's OWN dispatch + try/catch branches:
 * the public routes, the bearer-gated routes (+ their rate-limit 429s and
 * catch→500s), the admin sub-route table (+404/403/500), and the inline
 * /gemini-live auth→setup state machine.
 */
import type { Env } from '../index';

const verifySupabaseJwt = jest.fn<Promise<{ sub: string; email?: string }>, unknown[]>();
const checkAndIncrement = jest.fn<Promise<boolean>, unknown[]>();
const requireAdmin = jest.fn<Promise<{ email: string; role: string }>, unknown[]>();
jest.mock('../auth', () => ({ verifySupabaseJwt: (...a: unknown[]) => verifySupabaseJwt(...a) }));
jest.mock('../rateLimit', () => ({ checkAndIncrement: (...a: unknown[]) => checkAndIncrement(...a) }));
jest.mock('../lib/adminAuth', () => ({ requireAdmin: (...a: unknown[]) => requireAdmin(...a) }));

// Every route handler → a tagged 200 so dispatch is observable; mockRejected
// -Once drives the catch→500 branches.
const proxyClaude = jest.fn(async (..._a: unknown[]) => new Response('claude', { status: 200 }));
const proxyAvatar = jest.fn(async (..._a: unknown[]) => new Response('avatar', { status: 200 }));
const handleConfig = jest.fn(async (..._a: unknown[]) => new Response('config', { status: 200 }));
const handleFeedback = jest.fn(async (..._a: unknown[]) => new Response('feedback', { status: 200 }));
const handleEvalReport = jest.fn(async (..._a: unknown[]) => new Response('eval-report', { status: 200 }));
const handleTelemetry = jest.fn(async (..._a: unknown[]) => new Response('telemetry', { status: 200 }));
const handleGoogleToken = jest.fn(async (..._a: unknown[]) => new Response('google-token', { status: 200 }));
const handlePushRegister = jest.fn(async (..._a: unknown[]) => new Response('push-register', { status: 200 }));
const handleSyncPush = jest.fn(async (..._a: unknown[]) => new Response('sync-push', { status: 200 }));
const handleSyncPull = jest.fn(async (..._a: unknown[]) => new Response('sync-pull', { status: 200 }));
const handlePrompts = jest.fn(async (..._a: unknown[]) => new Response('prompts', { status: 200 }));
const handleAdminFlags = jest.fn(async (..._a: unknown[]) => new Response('admin-flags', { status: 200 }));
const handleAdminPrompts = jest.fn(async (..._a: unknown[]) => new Response('admin-prompts', { status: 200 }));
const handleAdminTelemetry = jest.fn(async (..._a: unknown[]) => new Response('admin-telemetry', { status: 200 }));
const handleAdminFeedback = jest.fn(async (..._a: unknown[]) => new Response('admin-feedback', { status: 200 }));
const handleAdminPush = jest.fn(async (..._a: unknown[]) => new Response('admin-push', { status: 200 }));
const handleAdminEvals = jest.fn(async (..._a: unknown[]) => new Response('admin-evals', { status: 200 }));
const handleAdminOverview = jest.fn(async (..._a: unknown[]) => new Response('admin-overview', { status: 200 }));
const handleAdminAiOps = jest.fn(async (..._a: unknown[]) => new Response('admin-ai-ops', { status: 200 }));
const handleAdminUsers = jest.fn(async (..._a: unknown[]) => new Response('admin-users', { status: 200 }));

jest.mock('../claude', () => ({ proxyClaude: (...a: unknown[]) => proxyClaude(...a) }));
jest.mock('../avatar', () => ({ proxyAvatar: (...a: unknown[]) => proxyAvatar(...a) }));
jest.mock('../gemini', () => ({ proxyGeminiLive: jest.fn() }));
jest.mock('../routes/config', () => ({ handleConfig: (...a: unknown[]) => handleConfig(...a) }));
jest.mock('../routes/feedback', () => ({ handleFeedback: (...a: unknown[]) => handleFeedback(...a) }));
jest.mock('../routes/evalReports', () => ({ handleEvalReport: (...a: unknown[]) => handleEvalReport(...a) }));
jest.mock('../routes/telemetry', () => ({ handleTelemetry: (...a: unknown[]) => handleTelemetry(...a) }));
jest.mock('../routes/googleToken', () => ({ handleGoogleToken: (...a: unknown[]) => handleGoogleToken(...a) }));
jest.mock('../routes/push', () => ({ handlePushRegister: (...a: unknown[]) => handlePushRegister(...a) }));
jest.mock('../routes/sync', () => ({
  handleSyncPush: (...a: unknown[]) => handleSyncPush(...a),
  handleSyncPull: (...a: unknown[]) => handleSyncPull(...a),
}));
jest.mock('../routes/prompts', () => ({ handlePrompts: (...a: unknown[]) => handlePrompts(...a) }));
jest.mock('../routes/admin/flags', () => ({ handleAdminFlags: (...a: unknown[]) => handleAdminFlags(...a) }));
jest.mock('../routes/admin/prompts', () => ({ handleAdminPrompts: (...a: unknown[]) => handleAdminPrompts(...a) }));
jest.mock('../routes/admin/telemetry', () => ({ handleAdminTelemetry: (...a: unknown[]) => handleAdminTelemetry(...a) }));
jest.mock('../routes/admin/feedback', () => ({ handleAdminFeedback: (...a: unknown[]) => handleAdminFeedback(...a) }));
jest.mock('../routes/admin/push', () => ({ handleAdminPush: (...a: unknown[]) => handleAdminPush(...a) }));
jest.mock('../routes/admin/evals', () => ({ handleAdminEvals: (...a: unknown[]) => handleAdminEvals(...a) }));
jest.mock('../routes/admin/overview', () => ({ handleAdminOverview: (...a: unknown[]) => handleAdminOverview(...a) }));
jest.mock('../routes/admin/aiOps', () => ({ handleAdminAiOps: (...a: unknown[]) => handleAdminAiOps(...a) }));
jest.mock('../routes/admin/users', () => ({ handleAdminUsers: (...a: unknown[]) => handleAdminUsers(...a) }));

// Imported AFTER the mocks so the router binds to the stubs.
import worker from '../index';

function makeKv() {
  const store = new Map<string, string>();
  const kv = {
    get: ((k: string) => Promise.resolve(store.get(k) ?? null)) as KVNamespace['get'],
    put: ((k: string, v: string) => { store.set(k, v); return Promise.resolve(); }) as KVNamespace['put'],
    delete: ((k: string) => { store.delete(k); return Promise.resolve(); }) as KVNamespace['delete'],
  } as Pick<KVNamespace, 'get' | 'put' | 'delete'> as KVNamespace;
  return kv;
}
const makeEnv = (over: Partial<Env> = {}): Env => ({
  RATE_LIMIT: makeKv(),
  ALLOWED_ORIGINS: '*',
  GEMINI_API_KEY: 'g',
  DAILY_AVATAR_LIMIT: '20',
  DAILY_SYNC_LIMIT: '10000',
  ...over,
} as Partial<Env> as Env);
const CTX = {} as ExecutionContext;
const authed = (path: string, method = 'POST', body?: unknown): Request =>
  new Request('https://w.test' + path, { method, headers: { Authorization: 'Bearer good' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const pub = (path: string, method = 'POST'): Request => new Request('https://w.test' + path, { method });

beforeEach(() => {
  jest.clearAllMocks();
  verifySupabaseJwt.mockResolvedValue({ sub: 'user-1', email: 'admin@x.test' });
  checkAndIncrement.mockResolvedValue(true);
  requireAdmin.mockResolvedValue({ email: 'admin@x.test', role: 'owner' });
});

describe('public routes (no auth)', () => {
  it('dispatches each public route and never verifies a token', async () => {
    expect((await worker.fetch(pub('/v1/telemetry'), makeEnv(), CTX)).status).toBe(200);
    expect((await worker.fetch(pub('/v1/feedback'), makeEnv(), CTX)).status).toBe(200);
    expect((await worker.fetch(pub('/v1/evals/report'), makeEnv(), CTX)).status).toBe(200);
    expect((await worker.fetch(pub('/v1/config', 'GET'), makeEnv(), CTX)).status).toBe(200);
    expect(handleTelemetry).toHaveBeenCalled();
    expect(handleConfig).toHaveBeenCalled();
    expect(verifySupabaseJwt).not.toHaveBeenCalled();
  });

  it('maps a thrown public handler to 500', async () => {
    handleTelemetry.mockRejectedValueOnce(new Error('boom'));
    const res = await worker.fetch(pub('/v1/telemetry'), makeEnv(), CTX);
    expect(res.status).toBe(500);
    expect((await res.json() as { error: string }).error).toBe('boom');
  });
});

describe('bearer-gated routes', () => {
  it('dispatches avatar / google-token / push-register / prompts', async () => {
    expect(await (await worker.fetch(authed('/v1/image/avatar'), makeEnv(), CTX)).text()).toBe('avatar');
    expect(await (await worker.fetch(authed('/v1/google/token'), makeEnv(), CTX)).text()).toBe('google-token');
    expect(await (await worker.fetch(authed('/v1/push/register'), makeEnv(), CTX)).text()).toBe('push-register');
    expect(await (await worker.fetch(authed('/v1/prompts', 'GET'), makeEnv(), CTX)).text()).toBe('prompts');
  });

  it('dispatches sync push/pull and enforces their rate limit', async () => {
    expect(await (await worker.fetch(authed('/v1/sync/push'), makeEnv(), CTX)).text()).toBe('sync-push');
    expect(await (await worker.fetch(authed('/v1/sync/pull', 'GET'), makeEnv(), CTX)).text()).toBe('sync-pull');
    checkAndIncrement.mockResolvedValueOnce(false);
    expect((await worker.fetch(authed('/v1/sync/push'), makeEnv(), CTX)).status).toBe(429);
  });

  it('returns 429 when the avatar bucket is exhausted', async () => {
    checkAndIncrement.mockResolvedValueOnce(false);
    const res = await worker.fetch(authed('/v1/image/avatar'), makeEnv(), CTX);
    expect(res.status).toBe(429);
    expect(proxyAvatar).not.toHaveBeenCalled();
  });

  it('maps a thrown bearer-gated handler to 500', async () => {
    handleGoogleToken.mockRejectedValueOnce(new Error('token boom'));
    expect((await worker.fetch(authed('/v1/google/token'), makeEnv(), CTX)).status).toBe(500);
  });
});

describe('admin sub-route table', () => {
  const cases: Array<[string, string, jest.Mock]> = [
    ['/v1/admin/flags', 'GET', handleAdminFlags],
    ['/v1/admin/prompts', 'GET', handleAdminPrompts],
    ['/v1/admin/telemetry/funnel', 'GET', handleAdminTelemetry],
    ['/v1/admin/feedback', 'GET', handleAdminFeedback],
    ['/v1/admin/push/stats', 'GET', handleAdminPush],
    ['/v1/admin/evals/latest', 'GET', handleAdminEvals],
    ['/v1/admin/overview', 'GET', handleAdminOverview],
    ['/v1/admin/ai-ops', 'GET', handleAdminAiOps],
    ['/v1/admin/users', 'GET', handleAdminUsers],
  ];
  it.each(cases)('dispatches %s to its handler', async (path, method, mock) => {
    const res = await worker.fetch(authed(path, method), makeEnv(), CTX);
    expect(res.status).toBe(200);
    expect(mock).toHaveBeenCalled();
  });

  it('returns 404 for an unknown admin route', async () => {
    const res = await worker.fetch(authed('/v1/admin/nope', 'GET'), makeEnv(), CTX);
    expect(res.status).toBe(404);
    expect((await res.json() as { error: string }).error).toBe('admin route not found');
  });

  it('returns 403 when requireAdmin rejects', async () => {
    requireAdmin.mockRejectedValueOnce(new Error('admin: not authorized'));
    const res = await worker.fetch(authed('/v1/admin/flags', 'GET'), makeEnv(), CTX);
    expect(res.status).toBe(403);
  });

  it('maps a thrown admin handler to 500', async () => {
    handleAdminFlags.mockRejectedValueOnce(new Error('flags boom'));
    expect((await worker.fetch(authed('/v1/admin/flags', 'GET'), makeEnv(), CTX)).status).toBe(500);
  });
});

describe('/gemini-live inline state machine', () => {
  interface FakeSocket {
    accept: jest.Mock; send: jest.Mock; close: jest.Mock; addEventListener: jest.Mock;
    listeners: Record<string, Array<(e: unknown) => void>>;
  }
  const makeSocket = (): FakeSocket => {
    const listeners: Record<string, Array<(e: unknown) => void>> = {};
    return { listeners, accept: jest.fn(), send: jest.fn(), close: jest.fn(), addEventListener: jest.fn((t: string, cb: (e: unknown) => void) => { (listeners[t] ??= []).push(cb); }) };
  };
  const g = globalThis as { WebSocketPair?: unknown };
  const realFetch = globalThis.fetch;
  let server: FakeSocket;
  let upstream: FakeSocket;
  let upstreamUpgrades: boolean;

  beforeEach(() => {
    server = makeSocket(); upstream = makeSocket(); upstreamUpgrades = true;
    g.WebSocketPair = function () { return { 0: makeSocket(), 1: server }; };
    globalThis.fetch = (() => {
      const r = new Response(null, { status: 200 });
      (r as { webSocket?: unknown }).webSocket = upstreamUpgrades ? upstream : null;
      return Promise.resolve(r);
    }) as typeof globalThis.fetch;
  });
  afterEach(() => { delete g.WebSocketPair; globalThis.fetch = realFetch; });

  const upgrade = (): Request => new Request('https://w.test/gemini-live', { method: 'GET', headers: { Upgrade: 'websocket' } });
  const drive = async (msg: unknown) => { await server.listeners['message'][0]({ data: JSON.stringify(msg) }); };

  it('authenticates, then connects upstream and pipes the setup message', async () => {
    // The trailing 101 Response throws under undici; listeners are wired first.
    await worker.fetch(upgrade(), makeEnv(), CTX).catch(() => undefined);
    expect(server.accept).toHaveBeenCalled();

    await drive({ auth: 'good-jwt' });
    expect(verifySupabaseJwt).toHaveBeenCalledWith('good-jwt', expect.anything());
    expect(server.send.mock.calls.some((c) => String(c[0]).includes('authOk'))).toBe(true);

    await drive({ setup: { model: 'gemini' } });
    expect(upstream.accept).toHaveBeenCalled();
    expect(upstream.send).toHaveBeenCalled(); // forwarded the setup frame
  });

  it('reports upstream unavailability and closes with 1011', async () => {
    upstreamUpgrades = false;
    await worker.fetch(upgrade(), makeEnv(), CTX).catch(() => undefined);
    await drive({ auth: 'good-jwt' });
    await drive({ setup: {} });
    expect(server.send.mock.calls.some((c) => String(c[0]).includes('upstream voice service unavailable'))).toBe(true);
    expect(server.close).toHaveBeenCalledWith(1011, 'upstream unavailable');
  });
});
