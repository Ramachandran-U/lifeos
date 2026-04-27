import { verifySupabaseJwt } from './auth';
import { checkAndIncrement } from './rateLimit';
import { proxyClaude } from './claude';
import { proxyGeminiLive } from './gemini';

export interface Env {
  RATE_LIMIT: KVNamespace;
  ANTHROPIC_API_KEY: string;
  GEMINI_API_KEY: string;
  SUPABASE_JWKS_URL: string;
  SUPABASE_PROJECT_REF: string;
  DAILY_AI_REQUEST_LIMIT: string;
  DAILY_VOICE_MINUTES_LIMIT: string;
  ALLOWED_ORIGIN: string;
}

function corsHeaders(env: Env): HeadersInit {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonError(status: number, message: string, env: Env): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(env) },
  });
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    const url = new URL(req.url);

    // WebSocket upgrade for Gemini Live — handled before auth-header parsing
    // because browsers cannot set arbitrary headers on WebSocket handshakes.
    // The client passes `?token=<supabase jwt>` in the query string instead.
    if (url.pathname === '/gemini-live' && req.headers.get('Upgrade') === 'websocket') {
      const token = url.searchParams.get('token');
      if (!token) return new Response('missing token', { status: 401 });
      const claims = await verifySupabaseJwt(token, env).catch(() => null);
      if (!claims) return new Response('invalid token', { status: 401 });
      return proxyGeminiLive(req, env, claims.sub);
    }

    // All other routes require Bearer auth.
    const authHeader = req.headers.get('Authorization') ?? '';
    const match = authHeader.match(/^Bearer\s+(.+)$/);
    if (!match) return jsonError(401, 'missing bearer token', env);
    const claims = await verifySupabaseJwt(match[1], env).catch(() => null);
    if (!claims) return jsonError(401, 'invalid or expired token', env);
    const userId = claims.sub;

    if (url.pathname === '/claude' && req.method === 'POST') {
      const ok = await checkAndIncrement(
        env.RATE_LIMIT,
        `ai:${userId}`,
        Number(env.DAILY_AI_REQUEST_LIMIT),
      );
      if (!ok) return jsonError(429, 'daily AI limit reached', env);
      return proxyClaude(req, env, corsHeaders(env));
    }

    if (url.pathname === '/health' && req.method === 'GET') {
      return new Response('ok', { headers: corsHeaders(env) });
    }

    return jsonError(404, 'not found', env);
  },
};
