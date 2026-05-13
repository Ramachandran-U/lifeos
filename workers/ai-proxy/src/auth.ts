import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import type { Env } from './index';

let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null;

export async function verifySupabaseJwt(
  token: string,
  env: Env,
): Promise<JWTPayload & { sub: string }> {
  if (!jwksCache) {
    jwksCache = createRemoteJWKSet(new URL(env.SUPABASE_JWKS_URL));
  }
  const { payload } = await jwtVerify(token, jwksCache, {
    issuer: `https://${env.SUPABASE_PROJECT_REF}.supabase.co/auth/v1`,
  });
  if (!payload.sub) throw new Error('jwt missing sub');
  return payload as JWTPayload & { sub: string };
}
