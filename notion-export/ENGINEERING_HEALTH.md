# Engineering Health Report

## Scorecard

| Dimension | Rating | Trend | One-line Summary |
|---|---|---|---|
| Code organisation | A | ↑ | webStorage now per-entity (12 files + 2 helpers); per-engine module folders; per-entity query files |
| TypeScript strictness | A | → | Strict mode; 0 errors since 2026-05-13 |
| Test coverage — unit | A- | ↑ | 356 Jest tests (gamification, finance parsers, agent planner, analyseSkillGap sanitizer, scheduleSync, etc.) |
| Test coverage — eval | A | → | 30/30 green (mock mode); CI report surfaced in admin |
| Test coverage — e2e | B | ↑↑ | Smoke 14/14 against deployed canonical URL; seed exercises the selector-returns-new-object bug class; `npm run smoke` + `npm run verify` are documented pre-commit gates |
| Documentation | A | ↑ | Master Brief, Tech Doc, AI Functions, Architect Review all current |
| CI/CD | B | → | Eval CI green; manual web deploy is the gap |
| Observability | B+ | ↑ | Worker tracing + per-task telemetry + admin schema-failure feed |
| Security | B | → | Supabase RLS + worker rate-limit + anon-only public keys; OAuth tokens still plaintext on web |
| Performance | B+ | → | Static export + edge CDN; lazy-loading routes opportunity |
| Maintainability | B | → | Web/native query duplication is the main load-bearing pain point |
| Scalability | B | → | Per-device SQLite scales horizontally; worker rate-limit is per-device today |
| Accessibility | C | → | Domain glyphs designed accessibility-forward; broader audit pending |
| Bus factor | D | → | One human + AI agents; deploy keys + secrets on a single machine |

## Strengths

1. **Clean conventions and ruthless adherence to them.** CLAUDE.md is the source of truth and the codebase honours it (theme tokens, named exports, no `any`, Zod at boundaries, mock-mode parity for every AI call).
2. **AI surface is mature.** Worker proxy, model router, cost ledger, tracing, agent + RAG, evals — all in place. New AI features layer on top.
3. **Web/native parity is real.** `index.web.ts` + `webStorage.ts` work today. The shared `OAuthCallbackView` and shared `createGoogleOAuthClient` are particularly tidy patterns.
4. **Design system shipped.** Aurora theme, motion, density, glass surfaces; gamification components imported from a separate design bundle and integrated.
5. **Honest punch-list culture.** `docs/ARCHITECT_REVIEW_2026-05-13.md` lists every known defect with severity and acceptance criteria — and PRs reference it.
6. **AI eval gating.** 10 cases run in CI; reports surface in admin; schema-failure feed catches model drift.
7. **Telemetry opt-in by default.** Privacy posture is conservative; data residency screen is a real surface, not a placeholder.

## Weaknesses (post 2026-05-14 sweep)

1. **Push delivery unverified.** Wiring exists; no evidence tokens reach the worker; admin push broadcasts may be no-ops in production. Gated on EAS native build.
2. **Web deploy is manual.** `npm run deploy` runs locally; secrets only exist on the deploying machine; we shipped a broken `.env` recently. CI deploy is the next obvious step.
3. **Three onboarding flows live simultaneously.** Three commit sites for `first_blueprint`; impossible to A/B test cleanly. Product call pending on retirement.
4. **OAuth tokens in plaintext localStorage.** Highest blast-radius security debt; native should use SecureStore.
5. **Per-entity query duplication.** webStorage is now per-entity (✅ split done) but every query file still has its own `Platform.OS === 'web'` branch. Two files to edit per new entity.
6. **Drizzle migrator not wired.** Baseline migration committed but `initDatabase` still uses the hand-maintained `CREATE TABLE` block. Needs Metro `.sql` resolver to swap.
7. **Single-machine deploy.** Bus factor + reproducibility risk.

### Resolved in 2026-05-14 sweep (morning + afternoon)
- ✅ Three sources of truth for schedule → user row is now canonical, mirroring extracted to `src/utils/scheduleSync.ts` with 6 invariant tests.
- ✅ No root ErrorBoundary → live in `_layout.tsx`, emits `EVENTS.uiCrash`.
- ✅ Zombie schema → 6 tables dropped.
- ✅ `webStorage.ts` 695 lines → split into 12 per-entity modules + 2 helpers.
- ✅ No tests for the agent planner → 5 Jest tests for the deterministic guards.

### Resolved in 2026-05-14 evening sweep (Aurora v2 + post-merge)
- ✅ Aurora Refined v2 design pass shipped — 10 commits, glow audit clean.
- ✅ React #185 infinite loop (yesterdaySnapshot zustand selector) → fixed via useMemo over entries; smoke seed now exercises the bug class.
- ✅ OAuth callback routes bouncing to Today → layout guard now treats any `*-callback` segment as in-callback.
- ✅ Supabase auth listener wiping legacy users on every boot → only `SIGNED_OUT` triggers reset, not INITIAL_SESSION-with-null.
- ✅ `analyseSkillGap` silent failure on Gemini schema drift → sanitizer + UI error caption.
- ✅ Pre-commit gate documented (`npm run verify` = tsc + jest + smoke).

## Recommendations (ranked, updated 2026-05-14)

| # | Recommendation | Effort | Impact | Status |
|---|---|---|---|---|
| 1 | Verify push end-to-end with a dev EAS build, add a self-check banner if no token after 60s | M | Closes a P0 | ⏳ Open (needs EAS) |
| 2 | Web deploy via GitHub Action with `EXPO_PUBLIC_*` repo secrets | M | Reproducible; un-blocks bus factor | ⏳ Open |
| 3 | Tokens → Expo SecureStore on native; encrypted-at-rest plan for web | M | Material security improvement | ⏳ Open |
| 4 | Onboarding v2 graduation: gate `welcome-intent` behind a default-true flag once metrics confirm parity; remove day1-* | M | Removes parallel maintenance | ⏳ Open (product call) |
| 5 | Drizzle migrator swap — wire Metro `.sql` resolver, replace `initDatabase` CREATE TABLE block with `runMigrations()` | M | Single source of schema truth | ⏳ Open (needs device test) |
| 6 | Add Jest tests for the schedule SSOT invariant | S | Locks in the new contract | ⏳ Open |
| ✅ | Add root ErrorBoundary + ui_crash telemetry | — | — | Done `c63b83a` |
| ✅ | Consolidate schedule to a single source (user row) | — | — | Done `c63b83a` |
| ✅ | Write Jest tests for `planRoutineAgent` deterministic guards | — | — | Done `c63b83a` |
| ✅ | Drop zombie tables + Drizzle baseline migration | — | — | Done `c613024` |
| ✅ | Telemetry events typed via `EVENTS` const map | — | — | Done `c613024` |
| ✅ | Smoke test fixes — `import.meta` and Privacy-residency selector | — | — | Done `24edc46` |
| ✅ | Split `webStorage.ts` per entity | — | — | Done `f004e13` |

## Quality Gates To Add To Every PR

- [ ] `npx tsc --noEmit` — must not increase error count from main.
- [ ] `npm test` — must stay green.
- [ ] `npm run evals` — must stay 10/10.
- [ ] `npx playwright test e2e/smoke.spec.ts` — must stay green (currently blocked, listed as Discovered defect).
- [ ] `git diff --stat` — confirm scope didn't grow.

## CI/CD Posture

| Surface | Pipeline Today | Recommended |
|---|---|---|
| Web app | `npm run deploy` (manual local) | GitHub Action `on: push to lifeosv1` |
| Worker | `wrangler deploy` (manual local) | GitHub Action with `CLOUDFLARE_API_TOKEN` secret |
| Admin portal | Vercel auto-deploy from GitHub | (Already in place) |
| Evals | `.github/workflows/evals.yml` posts to admin | (In place) |
| Native | None | EAS Build + OTA updates (long-term) |

## Operational Risks

| Risk | Likelihood | Impact | Owner Action |
|---|---|---|---|
| Single-machine deploy keys lost | M | H | Add CI secrets; document recovery |
| Worker CORS regression on rename | M | H | Allowlist both Pages URLs (already protected against) |
| Stale `.env` on deploy machine | H | H | Pre-deploy check for required `EXPO_PUBLIC_*` keys |
| Anthropic quota exhaustion | L | H | Cost ledger surfaced + circuit breaker per-task |
| Supabase free tier exhaustion | L | M | Watch row counts; upgrade when telemetry > 10k rows/day |

## Talent / Bus Factor

- **Single human author** (`Ramachandran-U`) for all commits.
- **Two AI collaborators** in active rotation: Claude Code and Codex (GPT-5.5) for parallel workstreams.
- **No code reviewers** — PRs are merged single-handed. Architect-review punch-list is the de-facto reviewer.
- **Recommendation:** when bringing on a human collaborator, route them to architect-review P1/P2 items first — high signal, low coordination cost.
