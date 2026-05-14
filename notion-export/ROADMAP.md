# Roadmap

## Immediate (this sprint — by 2026-05-21)

| Priority | Item | Source | Owner | Acceptance |
|---|---|---|---|---|
| P0 | Root `ErrorBoundary` wrapping `<Stack>` | §P0-4 | Codex T4 | Crashing screen no longer blanks app; `ui_crash` event logged in telemetry |
| P0 | Push token end-to-end verified | §P0-2 | Manual + native build | One device row appears in worker's `expo_push_tokens` after first open |
| P0 | Single-source-of-truth for wake/sleep/work | Tech Debt #17 | Engineering | `what-lifeos-knows` edits also update `users` row; routine planner reads one canonical source |
| P0 | Smoke test green on deployed web | Discovered defects | Engineering | `npx playwright test e2e/smoke.spec.ts` passes against `https://lifeos-6r5-eqa.pages.dev` |
| P1 | Drop zombie tables | §P1-5 | Codex T8 | `contacts`, `habits`, `learning_resources`, `career_profiles` removed; migration added |

## Short-Term (next 4 weeks)

| Priority | Item | Source |
|---|---|---|
| P1 | Drizzle migrations generated + applied idempotently | §P1-7 |
| P1 | `webStorage.ts` split per entity | §P1-6 |
| P1 | Typed telemetry events (`EVENTS` const map) | §P1-8 |
| P1 | Native OAuth — Gmail / Calendar / Fit on iOS + Android | Inferred |
| P1 | Agent planner unit tests (mock LLM; assert deterministic guards) | Tech Debt #18 |
| P2 | Memoize `buildProfileContext` per chat session | §P2-10 |
| P2 | Goal-comments UI surfacing | Tech Debt #9 |
| P2 | Tokens to Expo SecureStore on native | Tech Debt #14 |

## Medium-Term (next quarter)

| Priority | Item | Why |
|---|---|---|
| P2 | Onboarding v2 graduation — retire day1-* | §P2-9 |
| P2 | Cost ledger surfaced in admin OR demoted to eval-only | §P2-11 |
| P2 | Doc reconciliation pass | §P2-12 |
| P2 | CI deploy for web (GitHub Action with secrets) | Tech Debt #12 |
| P2 | Multi-device sync (Phase 2 in CLAUDE.md) | Founder priority |
| P2 | Voice assistant web parity | Voice epic |
| P2 | Hex radar tap-through to domain detail | UX request |
| P2 | Offline web (service worker caching) | Polish |

## Scaling Roadmap (six months out)

| Theme | Item |
|---|---|
| Reliability | EAS native builds + over-the-air updates |
| Reliability | Sentry-equivalent crash reporting hooked into worker + admin |
| Cost | Surface per-user AI cost; per-feature budget thresholds |
| Performance | Move from full-bundle deploy to chunked / lazy-loaded routes |
| Data | Migrate transactions + history to Supabase Postgres (per-user RLS) |
| Multi-tenant | Make worker rate-limit user-scoped, not device-scoped |
| Quality | Test the entire AI surface with the eval CI gating deploys |
| Product | Family / household routine sharing (Phase 3) |
| Product | Adaptive coaching — proactive nudges based on inferred patterns |

## Refactor Priorities (ranked)

1. **Single source of truth for schedule** — wake/sleep/work in three places today.
2. **Drizzle migrations** — schema split between `schema.ts` and raw SQL in `index.ts` is fragile.
3. **`webStorage.ts` split** — 695 lines, edited every time a new entity arrives.
4. **Onboarding consolidation** — three flows + duplicate `first_blueprint` badge sites.
5. **Tokens to secure storage** — Gmail tokens in plaintext localStorage is the highest blast-radius security debt.
6. **`Obsidian Context/` cleanup** — accidental commit; remove in a follow-up.

## Product Opportunities (founder-level)

| Opportunity | Rationale |
|---|---|
| Daily AI briefing as a notification | The brief is generated; surfacing as a single push would close the loop. |
| Reflection-driven habit acceptance | The `evening-reflect` flow is built; using its output to *propose* habit changes is a natural extension. |
| Family / shared household routines | Multi-tenant priority; high differentiation. |
| Wearable integrations beyond Google Fit | Apple Health (native HealthKit), Oura, Whoop. |
| Voice-first journaling export | Voice client exists; structured exports for therapist / coach handoff. |
| Polymath leaderboard | Friends curiosity log — social, gentle competition. |

## Anti-Goals (explicit non-priorities)

- Public account-level sharing or feeds.
- Habit-tracking competitive against bigger players (Streaks, Habitica) — we collapse that into routine + quests.
- Generic todo app surface — work belongs to goals or to a routine block.
- Crypto / web3 anything.
- AdTech / monetised attention.

## Phasing Reference

| Phase | Scope |
|---|---|
| Phase 1 (Current) | Single-user app on web + native; on-device data; AI proxy via worker |
| Phase 2 | Multi-device sync via Supabase Postgres; Plaid (US) for finance |
| Phase 3 | Household / shared routines; coaching layer; vector DB for retrieval |
