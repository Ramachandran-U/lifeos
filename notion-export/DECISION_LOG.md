# Decision Log (ADR-style)

> Format inspired by Architecture Decision Records. Decisions inferred from commits, code structure, and existing docs. Status: Adopted unless noted.

## ADR-001 · Expo + React Native + Expo Router as the app shell

- **Context:** Need iOS + Android + Web from a single codebase.
- **Decision:** Expo SDK 52 + React Native 0.76 + Expo Router (file-based).
- **Why:** Single team, fastest path to three surfaces; static web export via `expo export --platform web` reuses 95% of the native bundle.
- **Tradeoffs:** Some RN-only APIs need web shims (`Platform.OS` branches); `react-native-web` has quirks (e.g. `onMomentumScrollEnd` — see [[Bug-WheelTimePicker-2026-05-14]]).
- **Future implications:** Sticking with Expo means EAS is the natural next step for native builds; routes are file-based so refactors stay friendly.

## ADR-002 · TypeScript strict, no `any`, no `as unknown`

- **Context:** Single-author velocity; AI agents writing code; need compile-time safety.
- **Decision:** Strict mode enforced; Zod at every boundary.
- **Why:** Catches AI hallucinations and schema drift at parse time.
- **Tradeoffs:** Slows initial scaffolding; rewards mature codebases.
- **Future implications:** Type errors became actionable backlog items (Codex T1).

## ADR-003 · Drizzle ORM over Prisma / raw SQL

- **Context:** Need typed queries that compile to SQLite (native) and play nicely with a hand-rolled web fallback.
- **Decision:** Drizzle.
- **Why:** Lightweight, typed schemas, no codegen runtime, plays well with `expo-sqlite`.
- **Tradeoffs:** Migrations require running `drizzle-kit` — currently a debt (no `src/db/migrations/` committed).

## ADR-004 · Per-device SQLite as the primary store (Phase 1)

- **Context:** Privacy-first product positioning; no Phase 1 server cost.
- **Decision:** SQLite on native, localStorage on web (Dexie for high-volume transactions).
- **Why:** "Your data never leaves your device" as a Phase 1 narrative.
- **Tradeoffs:** No multi-device sync; lose data if browser storage cleared.
- **Future implications:** Phase 2 will mirror sensitive data to Supabase Postgres (per-user RLS) for sync, while keeping the on-device store as primary.

## ADR-005 · Cloudflare Worker proxy for all AI calls

- **Context:** Anthropic key cannot live in client bundle; need rate-limiting, provider switching, eval reporting.
- **Decision:** `workers/ai-proxy` Hono app on Cloudflare Workers; Supabase JWT auth.
- **Why:** Edge latency; free tier; KV for hot config; can swap Anthropic for Gemini per task.
- **Tradeoffs:** All AI traffic routes through one worker — quota + outage risk.
- **Future implications:** Cost ledger can move from in-memory to KV-backed per user.

## ADR-006 · Supabase for auth + admin Postgres

- **Context:** Need email + Google sign-in, plus a shared Postgres for telemetry, prompts, eval reports, feature flags.
- **Decision:** Supabase free tier.
- **Why:** Hosted Postgres + Auth + RLS in one product; admin portal authenticates via the same Supabase project.
- **Tradeoffs:** Vendor lock on auth flows; free-tier row limits.
- **Future implications:** Phase 2 sync of user data lives here.

## ADR-007 · Next.js Admin Portal (Vercel)

- **Context:** Operate the product: flags, prompts, telemetry, schema failures, eval reports, push broadcasts, feedback.
- **Decision:** Separate Next.js 14 App Router project at `admin/`, deployed on Vercel.
- **Why:** Keep the consumer app focused; ops team (founder + AI) needs an editor surface.
- **Tradeoffs:** Two deploy pipelines; two auth integrations.

## ADR-008 · Cloudflare Pages for web distribution (not Vercel)

- **Context:** Need free HTTPS hosting with a stable URL for the PWA.
- **Decision:** Cloudflare Pages (project `lifeos-6r5`, alias `lifeos-6r5-eqa.pages.dev`).
- **Why:** Free, permanent, same vendor as the worker; trivial wrangler integration.
- **Tradeoffs:** No CI deploy yet; relies on local `npm run deploy`.

## ADR-009 · Aurora Glass design language

- **Context:** Need a bold, expressive visual identity that feels alive (Duolingo × Headspace).
- **Decision:** Aurora theme — deep violet primary, six domain colours, glass surfaces, micro-animations on every state change.
- **Why:** Differentiation in a crowded productivity space; gamification reads as premium.
- **Tradeoffs:** Higher visual complexity = more performance work on web (Reanimated v3 + Skia not used here, but Aurora effects need care).

## ADR-010 · Routine Builder is an agent, not a single-shot LLM call

- **Context:** Single-shot prompts produced inconsistent routines and silently violated constraints.
- **Decision:** Multi-step agent — propose → critique → commit, with RAG over recent behaviour.
- **Why:** Self-critique catches obvious issues; recent-history retrieval personalises without overfitting.
- **Tradeoffs:** Higher cost per generation (3 LLM calls); deterministic guards still needed.
- **Future implications:** Migrating to native tool-use is a one-step swap of `callAI`.

## ADR-011 · Deterministic guards around the LLM

- **Context:** Even with prompt constraints, LLMs occasionally violate hard rules (e.g. block before wakeTime, hallucinated module names).
- **Decision:** Post-LLM filters: drop blocks outside `[wake, sleep]`; coerce unknown module strings to a known synonym or fallback.
- **Why:** Prompts are soft; UI errors leaking raw Zod messages is unacceptable.
- **Tradeoffs:** Adds code complexity; some legitimate creativity may be filtered.
- **Future implications:** Pattern should apply to every LLM-fed schema in the app.

## ADR-012 · Domain priorities are an ordered array

- **Context:** Original onboarding captured 1–3 unordered domains; AI couldn't weight them.
- **Decision:** Make `primaryDomains: DomainId[]` ordered; first element = top priority. UI lets users reorder.
- **Why:** Encodes priority without a new column.
- **Tradeoffs:** Order semantics now load-bearing — easy to break in a refactor.
- **Future implications:** Onboarding v2 should educate users on order, not just selection.

## ADR-013 · WheelTimePicker on web requires drag + tap fallbacks

- **Context:** Mouse-wheel / trackpad drag on `react-native-web` ScrollView often doesn't fire `onMomentumScrollEnd`, leaving the parent state stale.
- **Decision:** Wire `onScrollEndDrag` to the same handler, and make each option a Pressable that scrolls + commits.
- **Why:** Most reliable cross-input behaviour on web.
- **Tradeoffs:** Slight visual complexity (rows are now interactive).

## ADR-014 · Bundled food database (IFCT 2017 + INDB) instead of API

- **Context:** Food logging needs sub-100ms search latency and offline functionality.
- **Decision:** Ship ~1,600 items as a JSON bundle in the app.
- **Why:** Privacy, latency, India-specific coverage; no API quota.
- **Tradeoffs:** Bundle size; updates require app release. Open Food Facts is the fallback for packaged barcode-scanned items.

## ADR-015 · Telemetry off by default

- **Context:** Privacy-forward positioning.
- **Decision:** `useTelemetryStore.enabled = false` until user opts in.
- **Why:** Conservative default; trust signal.
- **Tradeoffs:** Lower-quality usage signal in early adoption.

## ADR-016 · Three onboarding flows (intentional for now)

- **Context:** Legacy day1-* keeps existing users moving; discovery-paste lets ChatGPT/Claude users import; discovery-chat is the long-term path.
- **Decision:** All three live simultaneously, gated by feature flag for v2.
- **Why:** Cohort-level safety while v2 stabilises.
- **Status:** **Adopted, but scheduled for retirement** — see §P2-9 in architect review.

## ADR-017 · Cost ledger built but not surfaced

- **Context:** Per-task cost accumulators in memory; only read by eval runner.
- **Decision (pending):** Surface in admin OR demote to eval-only.
- **Status:** **Open** — see §P2-11.

## ADR-018 · No CI for web deploy (yet)

- **Context:** `npm run deploy` runs locally with secrets on a single machine.
- **Decision (current):** Manual deploy.
- **Decision (planned):** GitHub Action with `EXPO_PUBLIC_*` + `CLOUDFLARE_API_TOKEN` secrets.
- **Status:** **Living debt** — acceptable for solo founder velocity; non-negotiable before team grows.

## ADR-019 · One commit per fix, one PR per task

- **Context:** AI agents (Codex, Claude) need a tight feedback loop.
- **Decision:** Branch per task (`codex/t<n>-...`); PR back to `lifeosv1`; verification gate (tsc, jest, evals, smoke) reported in the PR body.
- **Why:** Reviewable, revertible, traceable.
- **Tradeoffs:** Sometimes a tiny task gets a whole PR (e.g. T3 push-token was a 3-line no-op closure).

## ADR-020 · Direct commits to `lifeosv1` allowed for solo founder

- **Context:** Founder operates as TPM + engineer.
- **Decision:** Direct push permitted for fixes; AI workstreams open PRs.
- **Why:** Velocity over ceremony; recovery is one git command away.
- **Tradeoffs:** No formal review on founder commits. Architect-review docs do the review work asynchronously.

## ADR-021 · Anonymous device id for telemetry

- **Context:** Want to measure feature use without user PII.
- **Decision:** Generate a stable random `device_id` per install; ship with every telemetry event.
- **Why:** Funnel analysis without identity exposure.
- **Tradeoffs:** Can't tie events to a user without explicit join via Supabase user id.

## ADR-022 · Schedule single source of truth = user row

- **Context:** Wake/sleep/work times lived in three places (user row, `userProfile.schedule`, transient picker state). Two write surfaces (`what-lifeos-knows`, `day1-routine`) only updated one each, causing the routine generator to read stale values.
- **Decision (2026-05-14):** The user row is canonical. Both write surfaces mirror to the user row AND to `userProfile.schedule` on save.
- **Why:** The routine generator + notifications + `day1-routine` editor seed all read from the user row. Mirroring keeps `userProfile.schedule` consistent for the v2 discovery-chat path.
- **Tradeoffs:** Two writes per edit; if one fails (it's wrapped in try/catch) the other still lands.

## ADR-023 · Typed telemetry events

- **Context:** Stringly-typed `track('event_name')` calls — a typo silently 400'd the worker. We discovered 11 of 18 events were being dropped in production.
- **Decision (2026-05-14):** `EVENTS` const map in `src/utils/telemetry.ts`. `track()` signature requires `EventName`. The worker's allowlist is the same 18 entries.
- **Why:** Typos become compile-time errors; `git grep EVENTS.x` returns every emission site; adding an event is a single coordinated change.
- **Tradeoffs:** Two places to update (client + worker) when adding events. Worth it for the typing.

## ADR-024 · Per-entity web storage layout

- **Context:** `src/db/webStorage.ts` had reached 695 lines and every new entity needed an edit in this monolith.
- **Decision (2026-05-14):** Split into `src/db/webStorage/<entity>.ts` plus `_io.ts` (shared `load`/`save`) and `_keys.ts` (localStorage key registry). `webStorage.ts` is a barrel re-export so query files keep importing from `@/db/webStorage`.
- **Why:** Adding an entity = one new file; reviewing an entity's data shape happens in one place.
- **Tradeoffs:** Query files still have separate native/web branches (Tech Debt #2). Co-locating those would be the next step.

## ADR-025 · Deterministic guards apply to LLM outputs at every boundary

- **Context:** The routine planner already had post-LLM filters (drop blocks outside wake-sleep window; coerce hallucinated module strings). Same class of failure mode applies anywhere we Zod-parse model output.
- **Decision (codifying existing practice):** Every LLM-fed Zod schema gets a sanitiser pre-pass for known-failure-mode fields, plus filters for hard invariants.
- **Why:** Prompts are soft; production stability requires deterministic fallbacks.
- **Future implications:** Same pattern should extend to financial classifier output, blood-report parsing, and discovery-chat slot filling.

## ADR-026 · Zustand selectors must return stable references

- **Context:** `useDomainHistoryStore((s) => s.yesterdaySnapshot())` called a method that built a fresh object each invocation. Zustand compares selector results with `Object.is`. New object = "state changed" = re-render = re-select = infinite loop → React error #185.
- **Decision (2026-05-14):** Selectors return raw store fields (stable refs). Any derived shape lives in `useMemo` in the consumer, keyed on the raw refs.
- **Why:** Prevents this entire class of bug. Selectors are pure projections; derivations belong to consumers.
- **Future implications:** The smoke seed now exercises this code path (2-day history). Pattern to apply everywhere a store exposes a method returning a derived object.

## ADR-027 · OAuth callback whitelist matches any `*-callback` segment

- **Context:** The root layout's auth guard whitelisted only `google-auth-callback`. Gmail / Calendar / Fit callbacks fell through to the "redirect to /(tabs)" branch, killing the callback view before its code-exchange could run. Users saw "landed on Today" instead of completing the connect flow.
- **Decision (2026-05-14):** Treat any segment ending in `-callback` as in-OAuth-callback. Future integrations get the right behaviour automatically.
- **Why:** The set of callback routes will grow; explicit per-callback flags don't scale.
- **Tradeoffs:** A typo in a future route name like `xyz-callback` would also be whitelisted. Mitigated by the convention: callback routes are always under `app/<service>-callback.tsx`.

## ADR-028 · Supabase auth listener only acts on SIGNED_OUT

- **Context:** `supabase.auth.onAuthStateChange` fires INITIAL_SESSION on subscribe — with `null` for any boot without a Supabase session. The original handler reset the local user store on any falsy session, silently signing out legacy email/password users and any seeded E2E user on every reload.
- **Decision (2026-05-14):** Only react to the explicit `SIGNED_OUT` event.
- **Why:** Local auth (legacy email/password) is a real surface, not just dev fiction. The listener's job is to react to explicit sign-out, not to enforce Supabase-only auth.
- **Future implications:** Once Supabase becomes the only auth, this can be tightened (or the listener removed entirely if a different teardown path exists).

## ADR-029 · Aurora glow lives only in motion scenes

- **Context:** Original design used domain-color halos on resting components (z3 cards, RoutineBlock active, streak rows, hex radar dots). Heavy glow read as "toy" and visually noisy.
- **Decision (Aurora Refined v2, 2026-05-14):** Resting state uses pure shadow (#000 / #140828). Glow is reserved for celebration / transition scenes (LevelUpOverlay, BadgeUnlock, RewardOrchestrator).
- **Why:** Premium feel = quiet steady state + intense moments. Constant glow erodes the impact of the moments.
- **Tradeoffs:** Some screenshots from the original Aurora pass look "less expressive" — acceptable trade.

## ADR-030 · Pre-commit gate = `npm run verify`

- **Context:** Multiple bugs shipped this session were preventable: the React #185 loop would have failed smoke if the seed had 2 days of history; the auth-listener bug would have failed smoke if the seed user had no Supabase session (it does); the Aurora deploys were tested on stale browser state.
- **Decision (2026-05-14):** `npm run verify` = `tsc --noEmit && jest && npm run smoke`. Documented in `docs/TESTING.md`. Smoke runs against the deployed canonical URL, not local — so it catches CORS, env, and bundle-vs-runtime drift.
- **Why:** Local dev masks production-shaped failures; the deploy-URL smoke catches them.
- **Future implications:** Once CI deploy lands (Tech Debt #12), `verify` becomes a GitHub Action prerequisite for merge.

## ADR-031 · Phase 1 = no Plaid, no vector DB

- **Context:** Pressure to integrate financial aggregator + retrieval store.
- **Decision:** Deferred to Phase 2 / Phase 3.
- **Why:** Free Phase 1; Gmail + bank parsers cover India market; RAG in-memory is fine at current scale.
- **Tradeoffs:** US users blocked from finance; retrieval doesn't scale past ~thousands of items.
