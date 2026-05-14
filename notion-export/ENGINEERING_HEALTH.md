# Engineering Health Report

## Scorecard

| Dimension | Rating | Trend | One-line Summary |
|---|---|---|---|
| Code organisation | A | → | Module boundaries clean; per-entity query files; per-engine module folders |
| TypeScript strictness | A | ↑ | Strict mode; 0 errors since 2026-05-13 |
| Test coverage — unit | B | → | 110 Jest tests; gamification + finance parsers covered; agent planner uncovered |
| Test coverage — eval | A | → | 10/10 green; CI report surfaced in admin |
| Test coverage — e2e | C | ↓ | Smoke broken against deployed web; routes scaffolded only |
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

## Weaknesses

1. **Three sources of truth for schedule.** Already caused a real bug (10am wake → 7am routine). Until this is consolidated, every routine-related fix is suspect.
2. **No root ErrorBoundary.** A single bad render unmounts the app — the doc claims protection that doesn't exist.
3. **Push delivery unverified.** Wiring exists; no evidence tokens reach the worker; admin push broadcasts may be no-ops in production.
4. **Web deploy is manual.** `npm run deploy` runs locally; secrets only exist on the deploying machine; we shipped a broken `.env` recently.
5. **Three onboarding flows live simultaneously.** Three commit sites for `first_blueprint`; impossible to A/B test cleanly.
6. **Zombie schema.** Five tables exist with no queries — schema drift between intent and reality.
7. **OAuth tokens in plaintext localStorage.** Highest blast-radius security debt; native should use SecureStore.
8. **`webStorage.ts` is 695 lines.** Adding any entity to the data model requires editing this monolith.
9. **No tests for the agent planner.** propose → critique → commit is the single most important path in the app and isn't unit tested.
10. **Single-machine deploy.** Bus factor + reproducibility risk.

## Recommendations (ranked)

| # | Recommendation | Effort | Impact |
|---|---|---|---|
| 1 | Add root ErrorBoundary + ui_crash telemetry | S | Big — turns silent crashes into actionable signal |
| 2 | Consolidate schedule to a single source (user row); add a sync helper | S | Removes a class of bugs |
| 3 | Write 3 Jest tests for `planRoutineAgent` covering wake-bound filter, module coercion, fixed-block honoring | M | Locks in correctness of the most-touched AI surface |
| 4 | Verify push end-to-end with a dev EAS build, add a self-check banner if no token after 60s | M | Closes a P0 |
| 5 | Drop zombie tables + add a Drizzle migration | M | Cleans schema; unblocks per-entity webStorage split |
| 6 | Web deploy via GitHub Action with `EXPO_PUBLIC_*` repo secrets | M | Reproducible; un-blocks bus factor |
| 7 | Tokens → Expo SecureStore on native; encrypted-at-rest plan for web | M | Material security improvement |
| 8 | Onboarding v2 graduation: gate `welcome-intent` behind a default-true flag once metrics confirm parity; remove day1-* | M | Removes parallel maintenance |
| 9 | Telemetry events typed via `EVENTS` const map | S | Compile-time guarantee against typos |
| 10 | Smoke test fixes — `import.meta` and Privacy-residency selector | S | Restores e2e signal |

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
