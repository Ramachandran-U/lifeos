# LifeOS AI Proxy (Cloudflare Worker)

The single server-side surface for the app. It keeps LLM keys out of the mobile/web bundle, verifies the caller's Supabase JWT, enforces per-user daily limits, and serves config, prompts, telemetry, feedback, OAuth token exchange, and the admin portal API.

The LLM provider is selected by `LLM_PROVIDER` (currently **Gemini** by default — the app's `modelRouter.ts` requests `gemini-*` model IDs). The `/claude` route name is historical; its request/response body is provider-neutral.

## Endpoints

### Public (no auth)
- `POST /v1/telemetry` — anonymous telemetry ingest (device-id only).
- `POST /v1/feedback` — anonymous feedback ingest.
- `GET /v1/config` — config the consumer app polls at startup (feature flags, etc.).
- `POST /v1/evals/report` — CI eval-report ingest. Token-auth via `Bearer EVAL_REPORTER_TOKEN` (not a Supabase JWT); intentionally outside the admin gate.
- `GET /gemini-live` (WebSocket upgrade) — bidirectional proxy to Gemini Live for voice. **In-band auth**: the client sends `{"auth":"<supabase_jwt>"}` as its first message, the Worker verifies and replies `{"authOk":true}`, then splices in the upstream (browsers can't set headers or long query strings on WS upgrades).

### Authenticated (require `Authorization: Bearer <supabase_jwt>`)
- `POST /claude` — forwards to the configured LLM provider. Body: `{ system?, messages, maxTokens?, model?, cacheSystem?, task?, tools? }`. Returns `{ text, functionCalls, model, usage }`.
- `GET /health` — liveness check.
- `POST /v1/google/token` — server-side Google OAuth token exchange (holds `GOOGLE_CLIENT_SECRET`; keeps it out of the bundle). Used by Calendar / Fit / Gmail integrations.
- `POST /v1/push/register` — register an Expo push token for the user.
- `GET /v1/prompts` — remote-overridable system prompts.

### Admin (`/v1/admin/*` — require a valid Supabase JWT **and** a row in `admins`)
`flags`, `prompts`, `telemetry`, `feedback`, `push`, `evals`, `overview`, `ai-ops`, `users`. Back the admin portal (see `lifeos/admin/`).

## Setup

```bash
cd workers/ai-proxy
npm install
npx wrangler login

# Rate-limit KV
npx wrangler kv:namespace create RATE_LIMIT
# Copy the printed id into wrangler.toml -> [[kv_namespaces]].id

# Set Supabase project ref + JWKS URL in wrangler.toml [vars], plus LLM_PROVIDER.
# Then set secrets:
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put ANTHROPIC_API_KEY      # optional fallback provider
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put EVAL_REPORTER_TOKEN

# Local dev
npm run dev   # listens on http://localhost:8787

# Deploy
npm run deploy
```

After deploy, set `EXPO_PUBLIC_AI_PROXY_URL` in the app's `.env` (and EAS/Pages secrets for prod builds) to the Worker URL, e.g. `https://lifeos-ai-proxy.<you>.workers.dev`.

## Limits

Configurable in `wrangler.toml` `[vars]`:
- `DAILY_AI_REQUEST_LIMIT` (default 200)
- `DAILY_VOICE_MINUTES_LIMIT` (default 15)

`429` is returned when the caller exceeds their daily bucket. Keys are `ai:<userId>:<UTC-date>` in KV and expire after 48h.
