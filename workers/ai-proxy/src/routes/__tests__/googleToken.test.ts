import type { Env } from '../../index';
import { handleGoogleToken } from '../googleToken';

const CORS: HeadersInit = { 'Access-Control-Allow-Origin': '*' };

function makeEnv(over: Partial<Env> = {}): Partial<Env> {
  return {
    GOOGLE_CLIENT_ID: 'client-id-fake',
    GOOGLE_CLIENT_SECRET: 'client-secret-fake',
    ...over,
  };
}

function req(body: unknown, method = 'POST'): Request {
  const init: RequestInit = { method };
  // GET/HEAD requests cannot carry a body (undici rejects it).
  if (method !== 'GET' && method !== 'HEAD') {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  return new Request('https://x/v1/google/token', init);
}

const realFetch = global.fetch;
const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as typeof fetch;
});

afterAll(() => {
  global.fetch = realFetch;
});

describe('handleGoogleToken', () => {
  it('non-POST → 405', async () => {
    const res = await handleGoogleToken(req({}, 'GET'), makeEnv() as Env, CORS);
    expect(res.status).toBe(405);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('secret not configured → 500', async () => {
    const res = await handleGoogleToken(
      req({ grant_type: 'refresh_token', refresh_token: 'r' }),
      makeEnv({ GOOGLE_CLIENT_SECRET: '' }) as Env,
      CORS,
    );
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: 'GOOGLE_CLIENT_ID/SECRET not configured on Worker',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('invalid JSON body → 400', async () => {
    const res = await handleGoogleToken(req('{nope'), makeEnv() as Env, CORS);
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'invalid JSON body' });
  });

  it('authorization_code missing fields → 400', async () => {
    const res = await handleGoogleToken(
      req({ grant_type: 'authorization_code', code: 'c' }),
      makeEnv() as Env,
      CORS,
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: 'missing code/code_verifier/redirect_uri',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refresh_token missing field → 400', async () => {
    const res = await handleGoogleToken(
      req({ grant_type: 'refresh_token' }),
      makeEnv() as Env,
      CORS,
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'missing refresh_token' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('unsupported grant_type → 400', async () => {
    const res = await handleGoogleToken(
      req({ grant_type: 'password' }),
      makeEnv() as Env,
      CORS,
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'unsupported grant_type' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('authorization_code happy path → forwards to Google with PKCE params', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: 'at', refresh_token: 'rt' }), { status: 200 }),
    );
    const res = await handleGoogleToken(
      req({
        grant_type: 'authorization_code',
        code: 'auth-code',
        code_verifier: 'verifier',
        redirect_uri: 'https://app/cb',
      }),
      makeEnv() as Env,
      CORS,
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ access_token: 'at', refresh_token: 'rt' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://oauth2.googleapis.com/token');
    const bodyParams = new URLSearchParams(init?.body as string);
    expect(bodyParams.get('grant_type')).toBe('authorization_code');
    expect(bodyParams.get('code')).toBe('auth-code');
    expect(bodyParams.get('code_verifier')).toBe('verifier');
    expect(bodyParams.get('redirect_uri')).toBe('https://app/cb');
    expect(bodyParams.get('client_secret')).toBe('client-secret-fake');
  });

  it('refresh_token happy path → forwards refresh_token and passes Google status through', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }),
    );
    const res = await handleGoogleToken(
      req({ grant_type: 'refresh_token', refresh_token: 'rt-123' }),
      makeEnv() as Env,
      CORS,
    );
    // Google's 400 is passed through verbatim.
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'invalid_grant' });
    const bodyParams = new URLSearchParams(fetchMock.mock.calls[0][1]?.body as string);
    expect(bodyParams.get('grant_type')).toBe('refresh_token');
    expect(bodyParams.get('refresh_token')).toBe('rt-123');
  });
});
