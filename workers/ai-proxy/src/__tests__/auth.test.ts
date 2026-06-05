/**
 * Supabase JWT verification. jose is mocked so we drive jwtVerify's outcome
 * without real keys: covers a valid token returning the payload, the
 * missing-sub rejection, the issuer wiring, and the lazily-cached remote JWKS
 * (created once, reused across calls).
 */
import type { Env } from '../index';

const jwtVerify = jest.fn<Promise<{ payload: Record<string, unknown> }>, [string, unknown, unknown]>();
const createRemoteJWKSet = jest.fn((_url: URL): string => 'JWKS');
// `jose` lives in the worker's own node_modules, not the root the node jest
// project resolves from — so mock it virtually (no on-disk module required).
jest.mock('jose', () => ({
  jwtVerify: (token: string, jwks: unknown, opts: unknown) => jwtVerify(token, jwks, opts),
  createRemoteJWKSet: (url: URL) => createRemoteJWKSet(url),
}), { virtual: true });

import { verifySupabaseJwt } from '../auth';

const env = (): Env => ({
  SUPABASE_JWKS_URL: 'https://proj.supabase.co/auth/v1/.well-known/jwks.json',
  SUPABASE_PROJECT_REF: 'proj',
} as Env);

beforeEach(() => { jest.clearAllMocks(); });

describe('verifySupabaseJwt', () => {
  it('returns the payload and verifies against the project issuer', async () => {
    jwtVerify.mockResolvedValueOnce({ payload: { sub: 'user-1', email: 'a@b.test' } });
    const payload = await verifySupabaseJwt('good-token', env());
    expect(payload.sub).toBe('user-1');
    expect(jwtVerify).toHaveBeenCalledWith('good-token', 'JWKS', { issuer: 'https://proj.supabase.co/auth/v1' });
  });

  it('throws when the verified payload has no sub', async () => {
    jwtVerify.mockResolvedValueOnce({ payload: { email: 'a@b.test' } });
    await expect(verifySupabaseJwt('subless', env())).rejects.toThrow('jwt missing sub');
  });

  it('creates the remote JWKS once and reuses it across calls', async () => {
    jest.resetModules();
    createRemoteJWKSet.mockClear();
    const { verifySupabaseJwt: fresh } = await import('../auth');
    jwtVerify.mockResolvedValue({ payload: { sub: 'u' } });
    await fresh('t1', env());
    await fresh('t2', env());
    expect(createRemoteJWKSet).toHaveBeenCalledTimes(1);
    expect(jwtVerify).toHaveBeenCalledTimes(2);
  });
});
