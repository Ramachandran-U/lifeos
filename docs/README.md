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
| [`ADMIN_PORTAL_PLAN.md`](ADMIN_PORTAL_PLAN.md) | Admin portal (Next.js) — flags + prompt registry — design + status |
| [`PRE_PRODUCTION_CHECKLIST.md`](PRE_PRODUCTION_CHECKLIST.md) | Open items before App Store / production Worker deploy |
| [`SECURITY.md`](SECURITY.md) | RLS design, admin onboarding, MFA debt |
| [`TESTING.md`](TESTING.md) | Jest, evals, Playwright e2e |
| [`claude-design-prompt-web.md`](claude-design-prompt-web.md) | Web design prompt (artifact-driven UI) |
| [`claude-design-prompt-mobile.md`](claude-design-prompt-mobile.md) | Mobile design prompt |

## One-paragraph orientation

LifeOS is a React Native + Expo (Router 6) app that runs on iOS, Android, and Web (installable PWA on Cloudflare Pages). Sensitive domain data is on-device: SQLite + Drizzle on native, localStorage/IndexedDB (Dexie) on web — every query file branches on `Platform.OS`. Identity is **Supabase Auth** (email/password + Google + Apple), and all AI traffic is brokered by the **`workers/ai-proxy` Cloudflare Worker** which verifies a Supabase JWT, enforces per-user daily quotas in KV, and forwards to Claude (Anthropic) or Gemini Live; the app never ships AI keys. Feature flags and system prompts are fetched live from the Worker (`/v1/config`, `/v1/prompts`) with bundled fallbacks, edited via the **admin portal** (`admin/`, Next.js). State is Zustand. The user journey: auth → welcome-intent → either 3-screen onboarding (vision → career → routine) **or** Discovery Import (paste a ChatGPT/Claude self-description) → main tabs (**Today, Life, Explore, Rewards, Profile** — Goals/Health/Finance/Career are reached via the Life hub). Cross-cutting layers: Ask LifeOS chatbot (`app/chat.tsx`), voice assistant (Gemini Live), evening Reflect ritual, gamification (XP / 5 streaks / 8 badges / hex radar), Google Calendar + Fit + Gmail integrations through a shared PKCE driver.
