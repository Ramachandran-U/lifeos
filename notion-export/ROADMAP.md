# Roadmap

## Immediate (this sprint — by 2026-05-21)

| Priority | Item | Source | Status |
|---|---|---|---|
| P0 | Root `ErrorBoundary` wrapping `<Stack>` | §P0-4 | ✅ Done (`c63b83a`, 2026-05-14) |
| P0 | Single-source-of-truth for wake/sleep/work | Tech Debt #17 | ✅ Done (`c63b83a`, 2026-05-14) |
| P0 | Drop zombie tables | §P1-5 | ✅ Done (`c613024`, 2026-05-14) |
| P0 | Smoke nav test fix | Discovered defects | ✅ Partial (`24edc46`); full green-pass against deployed URL pending |
| P0 | Push token end-to-end verified | §P0-2 | ⏳ Blocked — needs EAS native build |
| P0 | Tests for schedule SSOT invariant | new | ✅ Done (`a529ba1`, 2026-05-14 — extracted to `scheduleSync.ts` + 6 tests) |
| P0 | CI deploy via GitHub Action | Tech Debt #12 | ⏳ Open |
| P0 | Aurora Refined v2 design pass | DELTA.md | ✅ Done (10 commits ending `4427722`, 2026-05-14) |
| P0 | React #185 loop fix + smoke seed | new | ✅ Done (`0203eee` + `912a5f5`) |
| P0 | OAuth callback whitelist | new | ✅ Done (`70aaa07`) |
| P0 | Supabase listener fix | new | ✅ Done (`3f9cd4b`) |
| P1 | analyseSkillGap sanitizer | new | ✅ Done (`b8ed72a`) |
| P1 | `npm run verify` pre-commit gate | new | ✅ Done (`91eb8eb`) |

## Short-Term (next 4 weeks)

| Priority | Item | Source | Status |
|---|---|---|---|
| P1 | Drizzle migrations baseline + idempotent | §P1-7 | ✅ Baseline done; migrator swap pending (needs Metro `.sql` resolver) |
| P1 | `webStorage.ts` split per entity | §P1-6 | ✅ Done (`f004e13`, 2026-05-14) |
| P1 | Typed telemetry events (`EVENTS` const map) | §P1-8 | ✅ Done (`c613024`, 2026-05-14) |
| P1 | Agent planner unit tests | Tech Debt #18 | ✅ Done (`c63b83a`, 2026-05-14) |
| P1 | Memoize `buildProfileContext` per chat session | §P2-10 | ✅ Done (`24edc46`, 2026-05-14) |
| P1 | Doc reconciliation | §P2-12 | ✅ MASTER_BRIEF + AI_FUNCTIONS done; parent CLAUDE.md `expo-health` ref still pending |
| P1 | Native OAuth — Gmail / Calendar / Fit on iOS + Android | Inferred | ⏳ Open |
| P2 | Goal-comments UI surfacing | Tech Debt #9 | ⏳ Open |
| P2 | Tokens to Expo SecureStore on native | Tech Debt #14 | ⏳ Open |
| P2 | Drizzle migrator swap (`initDatabase` → `runMigrations`) | §P1-7 part 2 | ⏳ Needs Metro plugin |

## Medium-Term (next quarter)

| Priority | Item | Why |
|---|---|---|
| P2 | Onboarding v2 graduation — retire day1-* | §P2-9 (product call pending) |
| P2 | Cost ledger surfaced in admin OR demoted to eval-only | §P2-11 (product call pending) |
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

## Refactor Priorities (ranked, post-2026-05-14)

1. **Drizzle migrator swap** — baseline committed; needs Metro `.sql` resolver. Until this lands, schema lives in two places.
2. **Per-entity query duplication** — webStorage is now per-entity but each query file still has its own `Platform.OS === 'web'` branch. Co-locating native + web per entity would halve the count of files to edit.
3. **Onboarding consolidation** — three flows + duplicate `first_blueprint` badge sites. Needs a rollout decision.
4. **Tokens to secure storage** — Gmail/Calendar/Fit OAuth tokens in plaintext localStorage is the highest blast-radius security debt.
5. **`Obsidian Context/` cleanup** — accidental commit; remove in a follow-up.

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
