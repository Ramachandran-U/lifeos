# REPO_INVENTORY — LifeOS

Snapshot date: 2026-05-29. Branch: `lifeosv1`. Root: `c:\personal\Project X\lifeos`.

## Top-level layout

| Path | Files | Purpose |
|------|------:|---------|
| `app/` | 51 | Expo Router screens (auth, onboarding, tabs, modal/standalone routes) |
| `src/` | 343 | Application source (ai, store, db, components, hooks, integrations, finance, sync, cognition, explore, theme, utils) |
| `workers/` | 2078* | Cloudflare Worker `ai-proxy` (Claude + Gemini bridge). Most files are `node_modules`; source = 5 TS files |
| `admin/` | 26 | Next.js admin portal (Supabase-backed) — prompts, telemetry, evals, feedback, push |
| `docs/` | 27 | Engineering/product docs (architecture, security, testing, finance pipeline, gamification, design prompts) |
| `evals/` | 20 | Jest-based AI evals (datasets, cases, benchmarks, grader, reports) |
| `e2e/` | 9 | Playwright smoke + feature specs |
| `scripts/` | 6 | Build helpers (food DB, onboarding audio, post-export, ai-proxy launcher) |
| `supabase/` | 5 | Admin/telemetry SQL migrations (0001–0005) |
| `assets/` | 8 | Fonts + images |
| `public/` | 3 | Web export static files |
| `dist/` | 149 | Built Expo web export (artifact) |
| `jest.mocks/` | 3 | Jest mocks |
| `implementation-plan/` | 3 | Phase implementation plans |
| `roadmap/` | 2 | Program roadmap + architecture audit |
| `qa/` | 1 | Debug handover notes |
| `design-bundle/`, `design upgrade/` | 8 + zips | External design artefacts |
| `smoke-output/`, `test-results/`, `tmp/` | runtime | Generated; excluded from indexing |
| `.github/` | 2 workflows | `e2e.yml`, `evals.yml` |

*`workers/` count includes its own `node_modules`. Source-only file count = 5 (`auth.ts`, `claude.ts`, `gemini.ts`, `index.ts`, `rateLimit.ts`).

## Largest folders by source file count

1. `src/` (343) — bulk of the app
2. `app/` (51) — routes
3. `admin/` (26)
4. `evals/` (20)
5. `e2e/` (9)

Inside `src/`, the heaviest subtrees are `components/` (~70 files across `ui`, `shared`, `gamification`, `modules/*`), `ai/` (~60 files), `db/` (~40 files incl. `webStorage/` parity layer), `finance/` (~15 files).

## Tech stack (from `package.json`)

### Runtime / framework
- React Native `0.81.5` + React `19.1.0`
- Expo SDK `~54.0.0` + `expo-router ~6.0.23` (file-based routing)
- React Native Reanimated `~4.1.1`, Gesture Handler `~2.28.0`, Screens `~4.16.0`, Safe Area `~5.6.2`, SVG `15.12.1`, Worklets `0.5.1`
- React Native Web `^0.21.0` for the web build
- `@shopify/flash-list`, `expo-linear-gradient`

### Data
- `expo-sqlite ~16.0.10` + `drizzle-orm ^0.45.1` + `drizzle-kit ^0.31.9`
- `dexie ^4.4.2` — IndexedDB layer for the web build (`src/db/webStorage/*`)
- `@react-native-async-storage/async-storage 2.2.0`
- `@supabase/supabase-js ^2.104.0` (auth + admin telemetry/feedback/push tables)
- `nanoid ^5.1.7` for IDs
- `zod ^4.3.6` for validation
- `zustand ^5.0.12` + `@tanstack/react-query ^5.90.21` for state/cache

### Device APIs (Expo)
`expo-apple-authentication`, `expo-auth-session`, `expo-av`, `expo-calendar`, `expo-constants`, `expo-contacts`, `expo-crypto`, `expo-document-picker`, `expo-file-system`, `expo-haptics`, `expo-health` (placeholder `0.0.0`), `expo-image-picker`, `expo-linking`, `expo-notifications`, `expo-sharing`, `expo-speech`, `expo-splash-screen`, `expo-status-bar`, `expo-web-browser`.

### Fonts
`@expo-google-fonts/dm-sans`, `@expo-google-fonts/nunito`.

### Dev / test
- TypeScript `~5.9.2` (strict — see `tsconfig.json`)
- Jest `^30` + `ts-jest ^29.4.9` + `@types/jest`
- Playwright `^1.59.1` for e2e + smoke
- `cross-env`, `xlsx` (build-food-db)

## Build tooling

- `expo` CLI for start/android/ios/web
- `expo export --platform web` + `scripts/post-export-web.js` → `dist/`
- Deploy: `wrangler pages deploy dist --project-name=lifeos-6r5 --branch=lifeos`
- AI proxy: separate Cloudflare Worker in `workers/ai-proxy/` (`wrangler dev` / `wrangler deploy`)
- Drizzle migrations under `src/db/migrations/0000…0003*.sql` (+ `meta/` journal)
- Supabase migrations under `supabase/migrations/0001…0005*.sql`

## Package manager
- npm (`package-lock.json` present at root, `admin/`, and `workers/ai-proxy/`)
- No yarn.lock, no pnpm-lock.

## CI/CD (`.github/workflows/`)

| Workflow | Purpose |
|----------|---------|
| `e2e.yml` | Playwright tests on PRs touching `app/`, `src/`, `e2e/`, deps |
| `evals.yml` | Eval suite (Jest) |

No deploy workflow checked in — deploy is manual via `npm run deploy` (Cloudflare Pages) and `wrangler deploy` for the worker.

## External integrations (grep evidence)

| Integration | Where | Notes |
|-------------|-------|-------|
| Anthropic Claude | `workers/ai-proxy/src/claude.ts` | Provider in the proxy worker (one of two) |
| Google Gemini | `workers/ai-proxy/src/gemini.ts`, `src/ai/modelRouter.ts` | **Active provider** — model router emits `gemini-2.5-flash` / `gemini-3.5-flash` |
| Supabase | `src/integrations/supabase/{auth,client,session}.ts`, `admin/lib/supabase*.ts`, `supabase/migrations/*` | Auth + admin portal backing + telemetry tables |
| Google OAuth (generic) | `src/integrations/google/oauth.ts` | Shared PKCE driver |
| Google Auth (sign-in) | `src/integrations/googleAuth/{client,oauth}.ts`, `app/google-auth-callback.tsx` | |
| Google Calendar | `src/integrations/googleCalendar/{client,oauth}.ts`, `app/calendar-callback.tsx` | |
| Google Fit | `src/integrations/googleFit/{client,oauth}.ts`, `app/fit-callback.tsx` | 314-line client |
| Gmail (finance) | `src/finance/gmail/{fetcher,oauth}.ts`, `app/gmail-callback.tsx` | Transaction email ingestion |
| ElevenLabs | `src/integrations/elevenlabs/{client,scripts}.ts` | Onboarding narration TTS |
| Apple Sign-In | `expo-apple-authentication` dep | Auth screens |
| Apple HealthKit | `expo-health` (placeholder version `0.0.0`) | **Likely stub** — no implementation found |
| Open Food Facts | `src/utils/openFoodFacts.ts` | Food search fallback |
| Plaid | Not present (PRD references it for Phase 3 only) | |

## Environment & config files

`tsconfig.json`, `jest.config.js`, `jest.mocks/`, `playwright.config.ts`, `app.json`, `drizzle.config.ts`, `.env.example` (referenced in CLAUDE.md, not in tree at root). Worker has its own `tsconfig.json` + `wrangler.toml`.

## Notable runtime files

- `expo.log` at repo root (dev artifact, should not be committed)
- `smoke-output/`, `test-results/`, `tmp/` are runtime byproducts
