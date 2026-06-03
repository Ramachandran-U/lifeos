import type { Env } from '../index';

// --- Mock the auth boundary. The router calls verifySupabaseJwt for every
// non-public route; we drive its outcome per-test. ---
const verifySupabaseJwt = jest.fn<Promise<{ sub: string; email?: string }>, [string, unknown]>();
jest.mock('../auth', () => ({
  verifySupabaseJwt: (token: string, env: unknown) => verifySupabaseJwt(token, env),
}));

// --- Mock the expensive proxy modules to observable no-ops so we can assert
// dispatch without touching the LLM / image providers. ---
const proxyClaude = jest.fn<Response, [Request, unknown, HeadersInit, unknown, string]>(
  () => new Response('claude-ok', { status: 200 }),
);
const proxyAvatar = jest.fn<Response, [Request, unknown, HeadersInit, unknown, string]>(
  () => new Response('avatar-ok', { status: 200 }),
);
jest.mock('../claude', () => ({
  proxyClaude: (req: Request, env: unknown, cors: HeadersInit, ctx: unknown, userId: string) =>
    proxyClaude(req, env, cors, ctx, userId),
}));
jest.mock('../avatar', () => ({
  proxyAvatar: (req: Request, env: unknown, cors: HeadersInit, ctx: unknown, userId: string) =>
    proxyAvatar(req, env, cors, ctx, userId),
}));
jest.mock('../gemini', () => ({
  proxyGeminiLive: jest.fn(),
}));

// --- Mock the Supabase REST boundary so requireAdmin (lib/adminAuth) decides
// admin vs non-admin without a network call. ---
const pgSelect = jest.fn<Promise<unknown[]>, [unknown, string, string]>();
jest.mock('../lib/supabase', () => ({
  pgSelect: (env: unknown, table: string, query: string) => pgSelect(env, table, query),
}));

// Import AFTER the mocks are registered so the router binds to the stubs.
import worker from '../index';

// Map-backed fake KV that satisfies the get/put/delete surface the router and
// rateLimit.checkAndIncrement reach. `store` is exposed for assertions; `kv` is
// cast to KVNamespace per-method (no `as unknown`) so it drops into Env.
interface FakeKv {
  store: Map<string, string>;
  get: jest.Mock;
  put: jest.Mock;
  delete: jest.Mock;
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
  // overloaded KVNamespace member (sufficient overlap → no `as unknown`). The
  // jest.Mock handles stay exposed for assertions.
  const kv = {
    get: ((key: string) => get(key)) as KVNamespace['get'],
    put: ((key: string, value: string) => put(key, value)) as KVNamespace['put'],
    delete: ((key: string) => {
      del(key);
      return Promise.resolve();
    }) as KVNamespace['delete'],
  } as Pick<KVNamespace, 'get' | 'put' | 'delete'> as KVNamespace;
  return { store, get, put, delete: del, kv };
}

const TODAY = new Date().toISOString().slice(0, 10);

function makeEnv(over: Partial<Env> = {}): Partial<Env> {
  return {
    ALLOWED_ORIGINS: 'https://app.lifeos.test,https://admin.lifeos.test',
    DAILY_AI_REQUEST_LIMIT: '50',
    DAILY_CHATBOT_LIMIT: '5',
    ...over,
  };
}

const CTX = {} as ExecutionContext;

beforeEach(() => {
  verifySupabaseJwt.mockReset();
  proxyClaude.mockClear();
  proxyAvatar.mockClear();
  pgSelect.mockReset();
});

describe('OPTIONS preflight', () => {
  it('returns 204 with CORS headers and no body', async () => {
    const env = makeEnv();
    const req = new Request('https://x/claude', {
      method: 'OPTIONS',
      headers: { Origin: 'https://app.lifeos.test' },
    });
    const res = await worker.fetch(req, env as Env, CTX);
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://app.lifeos.test');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('OPTIONS');
    expect(await res.text()).toBe('');
  });
});

describe('corsHeaders origin resolution', () => {
  it('echoes an allowlisted Origin', async () => {
    const env = makeEnv();
    const req = new Request('https://x/health', {
      method: 'OPTIONS',
      headers: { Origin: 'https://admin.lifeos.test' },
    });
    const res = await worker.fetch(req, env as Env, CTX);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://admin.lifeos.test');
  });

  it("returns 'null' for a non-allowlisted Origin", async () => {
    const env = makeEnv();
    const req = new Request('https://x/health', {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example.com' },
    });
    const res = await worker.fetch(req, env as Env, CTX);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('null');
  });

  it("returns '*' when ALLOWED_ORIGINS contains '*'", async () => {
    const env = makeEnv({ ALLOWED_ORIGINS: 'https://app.lifeos.test,*' });
    const req = new Request('https://x/health', {
      method: 'OPTIONS',
      headers: { Origin: 'https://anything.example.com' },
    });
    const res = await worker.fetch(req, env as Env, CTX);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it("returns 'null' on the no-Origin (native) branch when not wildcarded", async () => {
    const env = makeEnv();
    // No Origin header — mobile/native requests omit it.
    const req = new Request('https://x/health', { method: 'OPTIONS' });
    const res = await worker.fetch(req, env as Env, CTX);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('null');
  });
});

describe('Bearer auth gate', () => {
  it('missing Bearer → 401', async () => {
    const env = makeEnv();
    const req = new Request('https://x/claude', { method: 'POST' });
    const res = await worker.fetch(req, env as Env, CTX);
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'missing bearer token' });
    expect(verifySupabaseJwt).not.toHaveBeenCalled();
  });

  it('invalid token → 401 (verifySupabaseJwt throws)', async () => {
    const env = makeEnv();
    verifySupabaseJwt.mockRejectedValueOnce(new Error('token expired'));
    const req = new Request('https://x/claude', {
      method: 'POST',
      headers: { Authorization: 'Bearer bad-token' },
    });
    const res = await worker.fetch(req, env as Env, CTX);
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'invalid or expired token' });
    expect(proxyClaude).not.toHaveBeenCalled();
  });
});

describe('/claude rate-limit buckets', () => {
  it("task:'chatbot' increments the chatbot bucket and dispatches to proxyClaude", async () => {
    const kv = makeKv();
    const env = makeEnv({ RATE_LIMIT: kv.kv });
    verifySupabaseJwt.mockResolvedValueOnce({ sub: 'user-1' });
    const req = new Request('https://x/claude', {
      method: 'POST',
      headers: { Authorization: 'Bearer good' },
      body: JSON.stringify({ task: 'chatbot' }),
    });
    const res = await worker.fetch(req, env as Env, CTX);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('claude-ok');
    expect(proxyClaude).toHaveBeenCalledTimes(1);
    expect(proxyClaude.mock.calls[0][4]).toBe('user-1');
    // chatbot bucket touched, default bucket untouched.
    expect(kv.store.get(`ai:chatbot:user-1:${TODAY}`)).toBe('1');
    expect(kv.store.has(`ai:user-1:${TODAY}`)).toBe(false);
  });

  it('default task increments the default AI bucket, not the chatbot bucket', async () => {
    const kv = makeKv();
    const env = makeEnv({ RATE_LIMIT: kv.kv });
    verifySupabaseJwt.mockResolvedValueOnce({ sub: 'user-2' });
    const req = new Request('https://x/claude', {
      method: 'POST',
      headers: { Authorization: 'Bearer good' },
      body: JSON.stringify({ task: 'decomposeGoal' }),
    });
    const res = await worker.fetch(req, env as Env, CTX);
    expect(res.status).toBe(200);
    expect(proxyClaude).toHaveBeenCalledTimes(1);
    expect(kv.store.get(`ai:user-2:${TODAY}`)).toBe('1');
    expect(kv.store.has(`ai:chatbot:user-2:${TODAY}`)).toBe(false);
  });

  it('over the default daily limit → 429, no dispatch', async () => {
    // Seed the default bucket at the limit so checkAndIncrement refuses.
    const kv = makeKv({ [`ai:user-3:${TODAY}`]: '50' });
    const env = makeEnv({ RATE_LIMIT: kv.kv });
    verifySupabaseJwt.mockResolvedValueOnce({ sub: 'user-3' });
    const req = new Request('https://x/claude', {
      method: 'POST',
      headers: { Authorization: 'Bearer good' },
      body: JSON.stringify({ task: 'decomposeGoal' }),
    });
    const res = await worker.fetch(req, env as Env, CTX);
    expect(res.status).toBe(429);
    await expect(res.json()).resolves.toEqual({ error: 'daily AI limit reached' });
    expect(proxyClaude).not.toHaveBeenCalled();
  });

  it('over the chatbot daily limit → 429 with chat-specific message', async () => {
    const kv = makeKv({ [`ai:chatbot:user-4:${TODAY}`]: '5' });
    const env = makeEnv({ RATE_LIMIT: kv.kv });
    verifySupabaseJwt.mockResolvedValueOnce({ sub: 'user-4' });
    const req = new Request('https://x/claude', {
      method: 'POST',
      headers: { Authorization: 'Bearer good' },
      body: JSON.stringify({ task: 'chatbot' }),
    });
    const res = await worker.fetch(req, env as Env, CTX);
    expect(res.status).toBe(429);
    await expect(res.json()).resolves.toEqual({ error: 'daily chat limit reached' });
    expect(proxyClaude).not.toHaveBeenCalled();
  });
});

describe('routing fallthrough', () => {
  it('unknown authenticated path → 404', async () => {
    const env = makeEnv({ RATE_LIMIT: makeKv().kv });
    verifySupabaseJwt.mockResolvedValueOnce({ sub: 'user-5' });
    const req = new Request('https://x/v1/does-not-exist', {
      method: 'POST',
      headers: { Authorization: 'Bearer good' },
    });
    const res = await worker.fetch(req, env as Env, CTX);
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'not found' });
  });

  it('GET /health → 200 ok for an authenticated request', async () => {
    const env = makeEnv({ RATE_LIMIT: makeKv().kv });
    verifySupabaseJwt.mockResolvedValueOnce({ sub: 'user-6' });
    const req = new Request('https://x/health', {
      method: 'GET',
      headers: { Authorization: 'Bearer good' },
    });
    const res = await worker.fetch(req, env as Env, CTX);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
  });
});

describe('/v1/admin/* gate', () => {
  it('non-admin (no row in admins) → 403', async () => {
    const env = makeEnv({
      RATE_LIMIT: makeKv().kv,
      SUPABASE_URL: 'https://proj.supabase.test',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-fake',
    });
    verifySupabaseJwt.mockResolvedValueOnce({ sub: 'user-7', email: 'nope@lifeos.test' });
    pgSelect.mockResolvedValueOnce([]); // requireAdmin → not authorized
    const req = new Request('https://x/v1/admin/flags', {
      method: 'GET',
      headers: { Authorization: 'Bearer good' },
    });
    const res = await worker.fetch(req, env as Env, CTX);
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'admin: not authorized' });
  });
});

describe('/gemini-live auth phase', () => {
  it('rejects an invalid auth token and closes with code 4001', async () => {
    const env = makeEnv({ GEMINI_API_KEY: 'gemini-fake' });
    verifySupabaseJwt.mockRejectedValueOnce(new Error('bad token'));

    // Capture the messages/close the server socket emits during the auth phase.
    const sent: string[] = [];
    let closedCode: number | undefined;
    const listeners: Record<string, ((e: unknown) => void)[]> = {};
    const serverSocket = {
      accept: jest.fn(),
      send: jest.fn((data: string) => sent.push(data)),
      close: jest.fn((code?: number) => {
        closedCode = code;
      }),
      addEventListener: jest.fn((type: string, cb: (e: unknown) => void) => {
        (listeners[type] ??= []).push(cb);
      }),
    };
    const clientSocket = { accept: jest.fn() };

    const WebSocketPairMock = jest.fn(() => ({ 0: clientSocket, 1: serverSocket }));
    const g = globalThis as { WebSocketPair?: unknown };
    const prevPair = g.WebSocketPair;
    g.WebSocketPair = WebSocketPairMock;

    try {
      const req = new Request('https://x/gemini-live', {
        method: 'GET',
        headers: { Upgrade: 'websocket' },
      });
      // The handler registers the server socket's listeners synchronously and
      // only THEN returns `new Response(null, { status: 101, ... })`. undici's
      // Response (the node test runtime) rejects status 101 — that's a CF-only
      // status — so fetch throws here. The auth-phase state machine we care
      // about already ran (listeners are registered), so we swallow the throw
      // and drive the captured message listener directly.
      await worker.fetch(req, env as Env, CTX).catch(() => undefined);
      expect(serverSocket.accept).toHaveBeenCalled();

      // Fire the client's first message: a bad auth token.
      const onMessage = listeners['message']?.[0];
      expect(onMessage).toBeDefined();
      await onMessage?.({ data: JSON.stringify({ auth: 'bad-jwt' }) });

      expect(verifySupabaseJwt).toHaveBeenCalledWith('bad-jwt', expect.anything());
      expect(sent.some((m) => m.includes('authError'))).toBe(true);
      expect(closedCode).toBe(4001);
    } finally {
      g.WebSocketPair = prevPair;
    }
  });
});
