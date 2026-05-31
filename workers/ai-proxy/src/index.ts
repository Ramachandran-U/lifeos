import { verifySupabaseJwt } from './auth';
import { checkAndIncrement } from './rateLimit';
import { proxyClaude } from './claude';
import { proxyAvatar } from './avatar';
import { proxyGeminiLive } from './gemini';
import { handleConfig } from './routes/config';
import { handleAdminFlags } from './routes/admin/flags';
import { handleAdminPrompts } from './routes/admin/prompts';
import { handleAdminTelemetry } from './routes/admin/telemetry';
import { handleAdminFeedback } from './routes/admin/feedback';
import { handleAdminPush } from './routes/admin/push';
import { handleFeedback } from './routes/feedback';
import { handlePushRegister } from './routes/push';
import { handleEvalReport } from './routes/evalReports';
import { handleAdminEvals } from './routes/admin/evals';
import { handleAdminOverview } from './routes/admin/overview';
import { handleAdminAiOps } from './routes/admin/aiOps';
import { handleAdminUsers } from './routes/admin/users';
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
  GROQ_API_KEY: string;
  SUPABASE_JWKS_URL: string;
  SUPABASE_PROJECT_REF: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  DAILY_AI_REQUEST_LIMIT: string;
  /** Daily per-user cap for avatar image generation. Defaults to 20 when unset. */
  DAILY_AVATAR_LIMIT?: string;
  /** Hard upper bound for output tokens per /claude call. Tune from wrangler.toml
   *  ([vars] MAX_TOKENS_CAP). Default 4096; raise toward 8000 when long-form
   *  generations (goal hierarchies, week-52 routines) need it. Parsed and
   *  bounded in claude.ts via resolveMaxTokensCap. */
  MAX_TOKENS_CAP?: string;
  DAILY_CHATBOT_LIMIT: string;
  DAILY_VOICE_MINUTES_LIMIT: string;
  ALLOWED_ORIGINS: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  EVAL_REPORTER_TOKEN: string;
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

    // Public anonymous feedback ingest — no auth.
    if (url.pathname === '/v1/feedback' && req.method === 'POST') {
      try {
        return await handleFeedback(req, env, corsHeaders(req, env));
      } catch (e) {
        return jsonError(500, e instanceof Error ? e.message : 'feedback error', req, env);
      }
    }

    // CI eval-report ingest — token-auth (Bearer EVAL_REPORTER_TOKEN), not
    // Supabase JWT. Lives outside the /v1/admin/ gate by design.
    if (url.pathname === '/v1/evals/report' && req.method === 'POST') {
      try {
        return await handleEvalReport(req, env, corsHeaders(req, env));
      } catch (e) {
        return jsonError(500, e instanceof Error ? e.message : 'eval report error', req, env);
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

    // In-band auth: accept the WS unconditionally (no token in URL — browsers
    // reject long query-string upgrades). The client sends {"auth":"TOKEN"} as
    // its first message; we verify, respond {"authOk":true}, then splice in
    // the Gemini upstream proxy.
    if (url.pathname === '/gemini-live' && req.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      (server as WebSocket).accept();

      // Explicit state machine. Previously this leaned on a string-sniff
      // `!raw.includes('"realtimeInput"')` to distinguish setup from audio,
      // which would fire a second upstream connection if the client ever sent
      // a non-realtimeInput message before/after setup (e.g. clientContent).
      type Phase = 'await_auth' | 'await_setup' | 'piping';
      let phase: Phase = 'await_auth';
      let authedUserId: string | null = null;
      let upstreamWs: WebSocket | null = null;
      let lockKey: string | null = null;
      let clientClosed = false;

      // Register client close/error handler IMMEDIATELY so a disconnect
      // during the upstream fetch still releases the KV lock and tears down.
      const teardown = async () => {
        clientClosed = true;
        try { upstreamWs?.close(); } catch {}
        try { (server as WebSocket).close(); } catch {}
        if (lockKey) {
          await env.RATE_LIMIT.delete(lockKey).catch(() => {});
          lockKey = null;
        }
      };
      (server as WebSocket).addEventListener('close', teardown);
      (server as WebSocket).addEventListener('error', teardown);

      (server as WebSocket).addEventListener('message', async (e) => {
        const raw = typeof e.data === 'string' ? e.data : '';
        try {
          if (phase === 'await_auth') {
            const msg = JSON.parse(raw);
            if (msg.auth) {
              const claims = await verifySupabaseJwt(msg.auth, env).catch(() => null);
              if (!claims) {
                (server as WebSocket).send(JSON.stringify({ authError: 'token expired or invalid' }));
                (server as WebSocket).close(4001, 'auth failed');
                return;
              }
              authedUserId = claims.sub;
              phase = 'await_setup';
              (server as WebSocket).send(JSON.stringify({ authOk: true }));
            }
            return;
          }

          if (phase === 'await_setup') {
            // Connect to Gemini upstream. Set lock + open WS only once.
            phase = 'piping'; // optimistic — flip back on error
            lockKey = `voice-lock:${authedUserId}`;

            const upstreamUrl = `https://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
            try {
              const upResp = await fetch(upstreamUrl, { headers: { Upgrade: 'websocket' } });
              upstreamWs = upResp.webSocket;
            } catch {
              upstreamWs = null;
            }
            // If the client closed while we were awaiting the upstream fetch,
            // bail out — the teardown registered above already released the lock.
            if (clientClosed) {
              try { upstreamWs?.close(); } catch {}
              return;
            }
            if (!upstreamWs) {
              (server as WebSocket).send(JSON.stringify({ authError: 'upstream voice service unavailable' }));
              (server as WebSocket).close(1011, 'upstream unavailable');
              return;
            }
            upstreamWs.accept();
            // Now that upstream is established, set the lock and forward the setup.
            await env.RATE_LIMIT.put(lockKey, '1', { expirationTtl: 60 });
            upstreamWs.send(raw);

            upstreamWs.addEventListener('message', (m) => {
              try { (server as WebSocket).send(m.data); } catch {}
            });
            upstreamWs.addEventListener('close', (ev) => {
              try {
                (server as WebSocket).send(JSON.stringify({
                  _upstreamClose: true,
                  code: (ev as CloseEvent).code,
                  reason: (ev as CloseEvent).reason || 'no reason',
                }));
              } catch {}
              teardown();
            });
            upstreamWs.addEventListener('error', teardown);
            return;
          }

          // phase === 'piping' — forward every subsequent client message
          // (audio chunks, clientContent, toolResponse, etc.) to Gemini.
          try { upstreamWs?.send(raw); } catch {}
        } catch (err) {
          const detail = err instanceof Error ? err.message : String(err);
          try { (server as WebSocket).send(JSON.stringify({ authError: detail })); } catch {}
          (server as WebSocket).close(1011, detail.slice(0, 120));
        }
      });

      return new Response(null, { status: 101, webSocket: client });
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
      return proxyClaude(req, env, corsHeaders(req, env), ctx, userId);
    }

    if (url.pathname === '/v1/image/avatar' && req.method === 'POST') {
      // Image generation is expensive — give it its own small daily bucket so a
      // user spamming "regenerate" can't drain the planner's AI quota.
      const limit = Number(env.DAILY_AVATAR_LIMIT) || 20;
      const ok = await checkAndIncrement(env.RATE_LIMIT, `ai:avatar:${userId}`, limit);
      if (!ok) return jsonError(429, 'daily avatar limit reached', req, env);
      return proxyAvatar(req, env, corsHeaders(req, env), ctx, userId);
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

    if (url.pathname === '/v1/push/register' && req.method === 'POST') {
      try {
        return await handlePushRegister(req, env, corsHeaders(req, env));
      } catch (e) {
        return jsonError(500, e instanceof Error ? e.message : 'push register error', req, env);
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

      if (url.pathname.startsWith('/v1/admin/feedback')) {
        try {
          return await handleAdminFeedback(req, env, admin, corsHeaders(req, env));
        } catch (e) {
          return jsonError(500, e instanceof Error ? e.message : 'admin feedback error', req, env);
        }
      }

      if (url.pathname.startsWith('/v1/admin/push')) {
        try {
          return await handleAdminPush(req, env, admin, corsHeaders(req, env));
        } catch (e) {
          return jsonError(500, e instanceof Error ? e.message : 'admin push error', req, env);
        }
      }

      if (url.pathname.startsWith('/v1/admin/evals')) {
        try {
          return await handleAdminEvals(req, env, admin, corsHeaders(req, env));
        } catch (e) {
          return jsonError(500, e instanceof Error ? e.message : 'admin evals error', req, env);
        }
      }

      if (url.pathname === '/v1/admin/overview') {
        try {
          return await handleAdminOverview(req, env, admin, corsHeaders(req, env));
        } catch (e) {
          return jsonError(500, e instanceof Error ? e.message : 'admin overview error', req, env);
        }
      }

      if (url.pathname.startsWith('/v1/admin/ai-ops')) {
        try {
          return await handleAdminAiOps(req, env, admin, corsHeaders(req, env));
        } catch (e) {
          return jsonError(500, e instanceof Error ? e.message : 'admin ai-ops error', req, env);
        }
      }

      if (url.pathname === '/v1/admin/users') {
        try {
          return await handleAdminUsers(req, env, admin, corsHeaders(req, env));
        } catch (e) {
          return jsonError(500, e instanceof Error ? e.message : 'admin users error', req, env);
        }
      }

      return jsonError(404, 'admin route not found', req, env);
    }

    return jsonError(404, 'not found', req, env);
  },
};
