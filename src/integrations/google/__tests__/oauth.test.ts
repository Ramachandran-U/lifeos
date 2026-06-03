/**
 * Token-lifecycle coverage for the shared Google OAuth (PKCE) driver.
 * Focused on getAccessToken refresh/expiry logic, isConnected, the
 * completeOAuth verifier guard + token round-trip, and consumeReturnPath.
 * The crypto-backed web-redirect path (startOAuth) is intentionally not tested.
 */

// The driver reads the current Supabase bearer through this thin accessor when
// it exchanges/refreshes tokens. Stub it so workerTokenExchange has a bearer.
jest.mock('@/integrations/supabase/session', () => ({
  getSupabaseAccessToken: jest.fn(async () => 'supabase-bearer'),
}));

// Minimal in-memory window/localStorage/sessionStorage shims for the node test
// env — the driver gates every storage read on `typeof window !== 'undefined'`.
beforeAll(() => {
  const local: Record<string, string> = {};
  const session: Record<string, string> = {};
  const makeStore = (store: Record<string, string>) => ({
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  });
  (globalThis as { window?: unknown }).window = { location: { origin: 'https://app.test' } };
  (globalThis as { localStorage?: unknown }).localStorage = makeStore(local);
  (globalThis as { sessionStorage?: unknown }).sessionStorage = makeStore(session);
});

import {
  getAccessToken,
  isConnected,
  completeOAuth,
  consumeReturnPath,
  clearTokens,
  type OAuthConfig,
  type GoogleTokens,
} from '../oauth';
import { getSupabaseAccessToken } from '@/integrations/supabase/session';

const CFG: OAuthConfig = {
  scopes: 'openid email',
  tokenKey: 'test_tokens',
  verifierKey: 'test_verifier',
  redirectPath: '/test-callback',
};

const CLIENT_ID = 'fake-client-id.apps.googleusercontent.com';

function mockResponse(data: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => data } as unknown as Response;
}

const fetchMock = jest.fn();

function seedTokens(tokens: GoogleTokens): void {
  localStorage.setItem(CFG.tokenKey, JSON.stringify(tokens));
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  (getSupabaseAccessToken as jest.Mock).mockResolvedValue('supabase-bearer');
});

describe('getAccessToken', () => {
  it('returns the cached token when it is far from expiry (no refresh)', async () => {
    seedTokens({ access_token: 'cached-tok', refresh_token: 'r', expires_at: Date.now() + 3_600_000 });

    const tok = await getAccessToken(CLIENT_ID, CFG);

    expect(tok).toBe('cached-tok');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshes when inside the ~30s expiry skew', async () => {
    seedTokens({ access_token: 'stale-tok', refresh_token: 'refresh-tok', expires_at: Date.now() + 10_000 });
    fetchMock.mockResolvedValueOnce(mockResponse({ access_token: 'fresh-tok', expires_in: 3600 }));

    const tok = await getAccessToken(CLIENT_ID, CFG);

    expect(tok).toBe('fresh-tok');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // The exchange POSTs a refresh_token grant to the worker token route.
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.grant_type).toBe('refresh_token');
    expect(body.refresh_token).toBe('refresh-tok');
    // Refreshed token is persisted (keeps the original refresh_token).
    const persisted = JSON.parse(localStorage.getItem(CFG.tokenKey) as string) as GoogleTokens;
    expect(persisted.access_token).toBe('fresh-tok');
    expect(persisted.refresh_token).toBe('refresh-tok');
  });

  it('returns null when the token is expired and there is no refresh_token', async () => {
    seedTokens({ access_token: 'dead-tok', expires_at: Date.now() - 1000 });

    const tok = await getAccessToken(CLIENT_ID, CFG);

    expect(tok).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null when there are no stored tokens', async () => {
    expect(await getAccessToken(CLIENT_ID, CFG)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('clears tokens and returns null on invalid_grant during refresh', async () => {
    seedTokens({ access_token: 'stale-tok', refresh_token: 'revoked', expires_at: Date.now() - 1000 });
    fetchMock.mockResolvedValueOnce(mockResponse({ error: 'invalid_grant' }, false, 400));

    const tok = await getAccessToken(CLIENT_ID, CFG);

    expect(tok).toBeNull();
    // invalid_grant means the refresh token is dead — the bucket is wiped.
    expect(localStorage.getItem(CFG.tokenKey)).toBeNull();
    expect(isConnected(CFG)).toBe(false);
  });

  it('returns null but keeps tokens on a non-invalid_grant refresh failure', async () => {
    seedTokens({ access_token: 'stale-tok', refresh_token: 'transient', expires_at: Date.now() - 1000 });
    fetchMock.mockResolvedValueOnce(mockResponse({ error: 'temporarily_unavailable' }, false, 503));

    const tok = await getAccessToken(CLIENT_ID, CFG);

    expect(tok).toBeNull();
    // A transient server error must NOT discard the refresh token.
    expect(localStorage.getItem(CFG.tokenKey)).not.toBeNull();
  });
});

describe('isConnected', () => {
  it('is true when a token bucket is present', () => {
    seedTokens({ access_token: 't', expires_at: Date.now() + 1000 });
    expect(isConnected(CFG)).toBe(true);
  });

  it('is false when nothing is stored', () => {
    expect(isConnected(CFG)).toBe(false);
  });

  it('is false (does not throw) when the stored JSON is corrupt', () => {
    localStorage.setItem(CFG.tokenKey, '{not valid json');
    expect(isConnected(CFG)).toBe(false);
  });
});

describe('completeOAuth', () => {
  it('throws when the PKCE verifier is missing', async () => {
    await expect(completeOAuth('auth-code', CLIENT_ID, CFG)).rejects.toThrow(/Missing PKCE verifier/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('exchanges the code, round-trips the tokens to storage, and clears the verifier', async () => {
    sessionStorage.setItem(CFG.verifierKey, 'pkce-verifier-123');
    fetchMock.mockResolvedValueOnce(
      mockResponse({ access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 1800 }),
    );

    await completeOAuth('auth-code', CLIENT_ID, CFG);

    // Tokens are readable back through the public surface.
    expect(isConnected(CFG)).toBe(true);
    const stored = JSON.parse(localStorage.getItem(CFG.tokenKey) as string) as GoogleTokens;
    expect(stored.access_token).toBe('new-access');
    expect(stored.refresh_token).toBe('new-refresh');
    expect(stored.expires_at).toBeGreaterThan(Date.now());
    // A fresh (far-from-expiry) token is returned without a refresh round-trip.
    expect(await getAccessToken(CLIENT_ID, CFG)).toBe('new-access');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // The verifier is consumed.
    expect(sessionStorage.getItem(CFG.verifierKey)).toBeNull();
    // The exchange used an authorization_code grant.
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.grant_type).toBe('authorization_code');
    expect(body.code).toBe('auth-code');
    expect(body.code_verifier).toBe('pkce-verifier-123');
  });
});

describe('consumeReturnPath', () => {
  it('reads and then clears the stored return path', () => {
    sessionStorage.setItem(`${CFG.verifierKey}_return`, '/goals?tab=active');

    expect(consumeReturnPath(CFG)).toBe('/goals?tab=active');
    // Second read is empty — it was consumed.
    expect(consumeReturnPath(CFG)).toBeNull();
  });

  it('returns null when nothing was stashed', () => {
    expect(consumeReturnPath(CFG)).toBeNull();
  });
});

describe('clearTokens', () => {
  it('removes the persisted bucket', () => {
    seedTokens({ access_token: 't', expires_at: Date.now() + 1000 });
    clearTokens(CFG);
    expect(isConnected(CFG)).toBe(false);
  });
});
