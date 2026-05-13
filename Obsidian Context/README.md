# LifeOS Docs Index

Context docs to help re-enter the project quickly. Start here, then open the specific doc you need.

| Doc | When to read |
|-----|--------------|
| [`../CLAUDE.md`](../CLAUDE.md) | Always — project conventions, tech stack, AI client pattern |
| [`PRODUCT_TECHNICAL_DOC.md`](PRODUCT_TECHNICAL_DOC.md) | Full technical spec — architecture, features, data model, AI functions |
| [`MASTER_BRIEF.md`](MASTER_BRIEF.md) | Marketing-ready content pack — positioning, features, taglines, FAQs |
| [`GAMIFICATION.md`](GAMIFICATION.md) | XP, levels, quests, badges, streaks, Rewards tab, HexRadar |
| [`FINANCE_PIPELINE.md`](FINANCE_PIPELINE.md) | Gmail OAuth → parsers (banks + UPI) → Dexie → categorizer → insights |
| [`WEB_VS_NATIVE.md`](WEB_VS_NATIVE.md) | The `Platform.OS === 'web'` storage branching pattern |
| [`AI_FUNCTIONS.md`](AI_FUNCTIONS.md) | Every AI function: input, output, Zod schema, mock path |
| [`AI_TEST_PLAN.md`](AI_TEST_PLAN.md) | How to run evals, RAG, agent, cost/tracing reports |
| [`ADMIN_PORTAL_PLAN.md`](ADMIN_PORTAL_PLAN.md) | Admin portal (Next.js) — Phases 1–5 shipped (Flags, Prompts, Telemetry, Schema failures, Evals, Feedback, Push) |
| [`PRE_PRODUCTION_CHECKLIST.md`](PRE_PRODUCTION_CHECKLIST.md) | Open items before App Store / production Worker deploy — all 🔴 blockers resolved, most 🟠 closed |
| [`MANUAL_OPS_TODO.md`](MANUAL_OPS_TODO.md) | Operational steps the human still needs to run in dashboards / CLIs (Wrangler secrets, Supabase migrations, GitHub repo secrets) |
| [`SECURITY.md`](SECURITY.md) | RLS design, admin onboarding, MFA debt, telemetry privacy contract |
| [`TESTING.md`](TESTING.md) | Jest unit tests, AI eval harness (7 suites), benchmarks, Playwright e2e |
| [`claude-design-prompt-web.md`](claude-design-prompt-web.md) | Web design prompt (artifact-driven UI) |
| [`claude-design-prompt-mobile.md`](claude-design-prompt-mobile.md) | Mobile design prompt |

## One-paragraph orientation

LifeOS is a React Native + Expo (Router 6) app that runs on iOS, Android, and Web (installable PWA on Cloudflare Pages). Sensitive domain data is on-device: SQLite + Drizzle on native, localStorage/IndexedDB (Dexie) on web — every query file branches on `Platform.OS`. Identity is **Supabase Auth** (email/password + Google + Apple), and all AI traffic is brokered by the **`workers/ai-proxy` Cloudflare Worker** (Wrangler 4) which verifies a Supabase JWT, enforces per-user daily quotas in KV (separate buckets for chatbot vs other AI), proxies Google OAuth token exchange server-side, and forwards to Claude / Gemini / OpenAI (switchable via `LLM_PROVIDER`); the app never ships AI keys. The Routine Builder is **agentic** — `planRoutineAgent` runs a `retrieve → propose → critique → commit` loop with RAG over real user history (recent reflections, behaviour events, blood-report summaries). Feature flags and system prompts are fetched live from the Worker (`/v1/config`, `/v1/prompts`) with bundled fallbacks, edited via the **admin portal** (`admin/`, Next.js, Vercel) which also surfaces anonymous opt-in telemetry, schema-failure feeds, CI eval pass rates, in-app feedback, and push broadcast. State is Zustand (with `persist` middleware for prompts + flags). The user journey: auth → welcome-intent → either v2 conversational onboarding or the Discovery Import paste flow → main tabs (**Today, Life, Explore, Rewards, Profile**). Cross-cutting layers: Ask LifeOS chatbot, voice assistant (Gemini Live), evening Reflect ritual, gamification (XP / 5 streaks / 8 badges / hex radar), Google Calendar + Fit + Gmail integrations through a shared PKCE driver. Finance categorization is a **4-tier pipeline** (cache → rule → distilled local k-NN classifier → batched AI) — most syncs make zero AI calls.
