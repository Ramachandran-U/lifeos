import { verifySupabaseJwt } from './auth';
import { checkAndIncrement } from './rateLimit';
import { proxyClaude } from './claude';
import { proxyGeminiLive } from './gemini';
import { handleConfig } from './routes/config';
import { handleAdminFlags } from './routes/admin/flags';
import { handleAdminPrompts } from './routes/admin/prompts';
import { handlePrompts } from './routes/prompts';
import { requireAdmin } from './lib/adminAuth';

export interface Env {
  RATE_LIMIT: KVNamespace;
  ANTHROPIC_API_KEY: string;
  GEMINI_API_KEY: string;
  SUPABASE_JWKS_URL: string;
  SUPABASE_PROJECT_REF: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  DAILY_AI_REQUEST_LIMIT: string;
  DAILY_VOICE_MINUTES_LIMIT: string;
  ALLOWED_ORIGIN: string;
}

function corsHeaders(env: Env): HeadersInit {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
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

    // Public config endpoint — no auth. Consumer app polls this at startup.
    if (url.pathname === '/v1/config' && req.method === 'GET') {
      try {
        return await handleConfig(req, env, corsHeaders(env));
      } catch (e) {
        return jsonError(500, e instanceof Error ? e.message : 'config error', env);
      }
    }

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

    if (url.pathname === '/v1/prompts' && req.method === 'GET') {
      try {
        return await handlePrompts(req, env, corsHeaders(env));
      } catch (e) {
        return jsonError(500, e instanceof Error ? e.message : 'prompts error', env);
      }
    }

    // Admin routes — require both a valid Supabase JWT and a row in admins.
    if (url.pathname.startsWith('/v1/admin/')) {
      let admin;
      try {
        admin = await requireAdmin(env, { email: claims.email as string | undefined });
      } catch (e) {
        return jsonError(403, e instanceof Error ? e.message : 'forbidden', env);
      }

      if (url.pathname === '/v1/admin/flags' || url.pathname.startsWith('/v1/admin/flags/')) {
        try {
          return await handleAdminFlags(req, env, admin, corsHeaders(env));
        } catch (e) {
          return jsonError(500, e instanceof Error ? e.message : 'admin flags error', env);
        }
      }

      if (url.pathname === '/v1/admin/prompts' || url.pathname.startsWith('/v1/admin/prompts/')) {
        try {
          return await handleAdminPrompts(req, env, admin, corsHeaders(env));
        } catch (e) {
          return jsonError(500, e instanceof Error ? e.message : 'admin prompts error', env);
        }
      }

      return jsonError(404, 'admin route not found', env);
    }

    return jsonError(404, 'not found', env);
  },
};
