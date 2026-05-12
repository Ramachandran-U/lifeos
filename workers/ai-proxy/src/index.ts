import { verifySupabaseJwt } from './auth';
import { checkAndIncrement } from './rateLimit';
import { proxyClaude } from './claude';
import { proxyGeminiLive } from './gemini';
import { handleConfig } from './routes/config';
import { handleAdminFlags } from './routes/admin/flags';
import { handleAdminPrompts } from './routes/admin/prompts';
import { handleAdminTelemetry } from './routes/admin/telemetry';
import { handlePrompts } from './routes/prompts';
import { handleGoogleToken } from './routes/googleToken';
import { handleTelemetry } from './routes/telemetry';
import { requireAdmin } from './lib/adminAuth';

export interface Env {
  RATE_LIMIT: KVNamespace;
  LLM_PROVIDER: string;
  ANTHROPIC_API_KEY: string;
  GEMINI_API_KEY: string;
  OPENAI_API_KEY: string;
  SUPABASE_JWKS_URL: string;
  SUPABASE_PROJECT_REF: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  DAILY_AI_REQUEST_LIMIT: string;
  DAILY_CHATBOT_LIMIT: string;
  DAILY_VOICE_MINUTES_LIMIT: string;
  ALLOWED_ORIGINS: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
}

/**
 * Build CORS headers by matching the request's Origin against the allowlist
 * configured in `ALLOWED_ORIGINS` (comma-separated). Mobile (native) requests
 * don't send Origin, so they hit the no-origin branch and get a safe default.
 * Anything not on the allowlist gets `null`, which most browsers treat as
 * "no CORS for you."
 */
function corsHeaders(req: Request, env: Env): HeadersInit {
  const allowed = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = req.headers.get('Origin') ?? '';
  const allowAny = allowed.includes('*');
  const allowed_origin = allowAny
    ? '*'
    : allowed.includes(origin)
      ? origin
      : 'null';
  return {
    'Access-Control-Allow-Origin': allowed_origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonError(status: number, message: string, req: Request, env: Env): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(req, env) },
  });
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(req, env) });
    }

    const url = new URL(req.url);

    // Public anonymous telemetry ingest — no auth. Device-id only.
    if (url.pathname === '/v1/telemetry' && req.method === 'POST') {
      try {
        return await handleTelemetry(req, env, corsHeaders(req, env));
      } catch (e) {
        return jsonError(500, e instanceof Error ? e.message : 'telemetry error', req, env);
      }
    }

    // Public config endpoint — no auth. Consumer app polls this at startup.
    if (url.pathname === '/v1/config' && req.method === 'GET') {
      try {
        return await handleConfig(req, env, corsHeaders(req, env));
      } catch (e) {
        return jsonError(500, e instanceof Error ? e.message : 'config error', req, env);
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
    if (!match) return jsonError(401, 'missing bearer token', req, env);
    const claims = await verifySupabaseJwt(match[1], env).catch(() => null);
    if (!claims) return jsonError(401, 'invalid or expired token', req, env);
    const userId = claims.sub;

    if (url.pathname === '/claude' && req.method === 'POST') {
      // Peek at the body to decide which bucket this call counts against.
      // Chatbot calls have their own daily cap so a chatty user can't
      // starve the Routine Builder / Goal decomposer / etc.
      let task: string | undefined;
      try {
        const body = (await req.clone().json()) as { task?: string };
        task = body.task;
      } catch {
        // body unreadable → fall through to default bucket
      }

      const isChatbot = task === 'chatbot';
      const bucketKey = isChatbot ? `ai:chatbot:${userId}` : `ai:${userId}`;
      const limit = isChatbot
        ? Number(env.DAILY_CHATBOT_LIMIT)
        : Number(env.DAILY_AI_REQUEST_LIMIT);

      const ok = await checkAndIncrement(env.RATE_LIMIT, bucketKey, limit);
      if (!ok) {
        const message = isChatbot
          ? 'daily chat limit reached'
          : 'daily AI limit reached';
        return jsonError(429, message, req, env);
      }
      return proxyClaude(req, env, corsHeaders(req, env));
    }

    if (url.pathname === '/health' && req.method === 'GET') {
      return new Response('ok', { headers: corsHeaders(req, env) });
    }

    if (url.pathname === '/v1/google/token' && req.method === 'POST') {
      try {
        return await handleGoogleToken(req, env, corsHeaders(req, env));
      } catch (e) {
        return jsonError(500, e instanceof Error ? e.message : 'google token error', req, env);
      }
    }

    if (url.pathname === '/v1/prompts' && req.method === 'GET') {
      try {
        return await handlePrompts(req, env, corsHeaders(req, env));
      } catch (e) {
        return jsonError(500, e instanceof Error ? e.message : 'prompts error', req, env);
      }
    }

    // Admin routes — require both a valid Supabase JWT and a row in admins.
    if (url.pathname.startsWith('/v1/admin/')) {
      let admin;
      try {
        admin = await requireAdmin(env, { email: claims.email as string | undefined });
      } catch (e) {
        return jsonError(403, e instanceof Error ? e.message : 'forbidden', req, env);
      }

      if (url.pathname === '/v1/admin/flags' || url.pathname.startsWith('/v1/admin/flags/')) {
        try {
          return await handleAdminFlags(req, env, admin, corsHeaders(req, env));
        } catch (e) {
          return jsonError(500, e instanceof Error ? e.message : 'admin flags error', req, env);
        }
      }

      if (url.pathname === '/v1/admin/prompts' || url.pathname.startsWith('/v1/admin/prompts/')) {
        try {
          return await handleAdminPrompts(req, env, admin, corsHeaders(req, env));
        } catch (e) {
          return jsonError(500, e instanceof Error ? e.message : 'admin prompts error', req, env);
        }
      }

      if (url.pathname.startsWith('/v1/admin/telemetry')) {
        try {
          return await handleAdminTelemetry(req, env, admin, corsHeaders(req, env));
        } catch (e) {
          return jsonError(500, e instanceof Error ? e.message : 'admin telemetry error', req, env);
        }
      }

      return jsonError(404, 'admin route not found', req, env);
    }

    return jsonError(404, 'not found', req, env);
  },
};
