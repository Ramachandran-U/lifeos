# LifeOS AI Proxy (Cloudflare Worker)

Routes client AI calls through a server-side Worker so API keys never enter the mobile bundle. Verifies the caller's Supabase JWT, enforces per-user daily limits, proxies Claude HTTP and Gemini Live WebSocket.

## Endpoints

- `POST /claude` — forwards to Anthropic `/v1/messages`. Requires `Authorization: Bearer <supabase_jwt>`. Request body: `{ system?, messages, maxTokens?, model? }`. Returns `{ text }`.
- `GET /gemini-live` (WebSocket upgrade) — bidirectional proxy to Gemini Live. Token passed as `?token=<supabase_jwt>` query param (browsers can't set headers on WS).
- `GET /health` — liveness check.

## Setup

```bash
cd workers/ai-proxy
npm install
npx wrangler login

# Create KV namespace for rate limits
npx wrangler kv:namespace create RATE_LIMIT
# Copy the printed id into wrangler.toml -> [[kv_namespaces]].id

# Set Supabase project ref + JWKS URL in wrangler.toml [vars]
# Then set secrets:
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put GEMINI_API_KEY

# Local dev
npm run dev   # listens on http://localhost:8787

# Deploy
npm run deploy
```

After deploy, set `EXPO_PUBLIC_AI_PROXY_URL` in the app's `.env` (and EAS secrets for prod builds) to the Worker URL, e.g. `https://lifeos-ai-proxy.<you>.workers.dev`.

## Limits

Configurable in `wrangler.toml` `[vars]`:
- `DAILY_AI_REQUEST_LIMIT` (default 200)
- `DAILY_VOICE_MINUTES_LIMIT` (default 15)

429 returned when the caller exceeds their daily bucket. Keys are `ai:<userId>:<UTC-date>` in KV and expire after 48h.
