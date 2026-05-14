# Technical Debt Register

Severity scale: 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low.

## Active Debt

| # | Debt Area | Severity | Description | Suggested Fix | Impact if Ignored |
|---|---|---|---|---|---|
| 1 | Drizzle migrator integration (part 2) | 🟡 Medium | Baseline migration committed (`0000_*.sql` with `IF NOT EXISTS`), but `initDatabase` still uses the hand-maintained `CREATE TABLE` block. Migrator swap requires Metro `.sql` resolver. | Wire `babel-plugin-drizzle-orm` or a Metro custom resolver for `.sql` imports; swap to `runMigrations` | Future migrations need to be added in two places |
| 2 | Web/native query duplication | 🟡 Medium | Per-entity `Platform.OS === 'web'` branch persists; webStorage is now per-entity (✅ split done) but query files still branch. | Co-locate native + web in one query file per entity (deferred) | Each new entity still touches both the query and the webStorage entity module |
| 3 | _resolved_ — Typed telemetry events | — | Shipped 2026-05-14 (`c613024`) — `EVENTS` map + worker allowlist sync. 11 of 18 events were silently 400'd before; all now flow. | — | — |
| 4 | _resolved_ — Zombie tables dropped | — | Shipped 2026-05-14 (`c613024`) — `contacts`, `contact_interactions`, `habits`, `learning_resources`, `skill_gaps`, `career_profiles` removed from schema + index.ts; DROP IF EXISTS for existing installs. | — | — |
| 5 | Three onboarding flows live simultaneously | 🟡 Medium | day1-* (legacy), discovery-* (paste import), discovery-chat (v2). `_layout.tsx` still defaults new users to day1-vision in some paths. | Pick rollout %; route new users to welcome-intent only; delete day1-* once v2 is default | Cognitive overhead; duplicate `first_blueprint` award sites; bugs hard to test against |
| 6 | _resolved_ — Root ErrorBoundary | — | Shipped 2026-05-14 (`c63b83a`). Render crash now shows a recoverable fallback + emits `EVENTS.uiCrash` telemetry. | — | — |
| 7 | Push token wiring unverified end-to-end | 🟠 High | `registerPushToken()` is called after permission, but no confirmation that a row reaches the worker's `expo_push_tokens` table for any real device. | Manual native run with logging; or add a server-side debug endpoint | Admin push broadcasts may be reaching zero devices |
| 8 | Cost ledger surfaces nowhere | 🟢 Low | `src/ai/costLedger.ts` accumulates in memory; read only by eval runner. | Surface in admin OR demote to eval-only | Foundational if you ever bill per-user; complexity-for-ops today |
| 9 | Goal-comments table built, UI not wired | 🟡 Medium | `goalComments` query + tests exist; no surface displays them. | Add a thread view to `GoalDetailSheet` | Half-finished feature signal |
| 10 | Doc/code mismatch (partial) | 🟢 Low | `MASTER_BRIEF.md` ✅ corrected and `AI_FUNCTIONS.md` ✅ LLM_PROVIDER note updated (2026-05-14, `24edc46`). Parent `CLAUDE.md` `expo-health` ref still present (auto-mode classifier blocks edits outside repo). | Manual edit of `../CLAUDE.md` to drop `expo-health` line. | One stale reference; no operational impact |
| 11 | Web bundle env vars off-repo | 🟠 High | `.env` is gitignored. `EXPO_PUBLIC_AI_PROXY_URL`, `EXPO_PUBLIC_SUPABASE_*` only on the deploying machine. Different machine = bundle inlines empty strings (already shipped that bug). | Document in `docs/PRE_PRODUCTION_CHECKLIST.md`; consider a `.env.deploy.example` and a CI-gated deploy with secrets | Production breakage from a different deploy machine |
| 12 | Manual web deploy | 🟡 Medium | `npm run deploy` runs locally with `wrangler pages deploy`. No CI. | GitHub Action with `EXPO_PUBLIC_*` secrets | Bus factor + reproducibility |
| 13 | E2E smoke broken on web (partial) | 🟢 Low | `import.meta.env` neutraliser confirmed working in deployed bundle. Profile-residency nav: smoke now waits + scrolls before click (`24edc46`). Pending: green-pass against deployed URL. | Run smoke against deployed Pages URL; iterate on remaining selectors | Regression cover still partial |
| 14 | OAuth tokens in localStorage | 🟠 High | `lifeos_gmail_tokens`, `lifeos_gcal_tokens`, `lifeos_gfit_tokens` stored in plain localStorage. | Expo SecureStore on native; encrypted-at-rest plan for web | XSS theft of bank-read OAuth tokens |
| 15 | Schema-only height_cm column native, not surfaced | 🟢 Low | Native UI to set height pending; web flow updates it via `EditVitalsSheet`. | Mirror EditVitalsSheet on native; or move height to userProfile | Inconsistent UX between web and native |
| 16 | Browser localStorage churn | 🟡 Medium | All web data lives in localStorage. Clearing cookies/incognito wipes everything. | Migrate to IndexedDB for high-value sets (already done for transactions). Add export/restore. | "Asked to set vitals every login" reports |
| 17 | _resolved_ — Schedule single source of truth | — | Shipped 2026-05-14 (`c63b83a`). `what-lifeos-knows` mirrors schedule edits to user row; `day1-routine` mirrors them to userProfile. | — | — |
| 18 | _resolved_ — Planner agent tests | — | Shipped 2026-05-14 (`c63b83a`). 5 Jest tests cover wake-bound filter, sleep-bound filter, module coercion, critique override, empty-plan fallback. | — | — |
| 19 | `Obsidian Context/` mirror committed by mistake | 🟢 Low | A docs mirror got swept into a recent commit. | `git rm -r "Obsidian Context/"` in a follow-up | Duplicate docs drift |
| 20 | XPBar / XpBar case-collision history | 🟢 Low | Already cleaned, but git history still shows a deleted-and-re-added file. | Avoid case-only renames going forward; document in CLAUDE.md | None going forward |

## Recently Paid Down

| # | Debt | Resolved In | Resolved On |
|---|---|---|---|
| – | 6 pre-existing TS errors | `e635841` (Codex T1) | 2026-05-13 |
| – | Missing hot-path SQLite indexes | `98c5d25` (Codex T2) | 2026-05-13 |
| – | Duplicate `xpForLevel` block | `9faf071` | 2026-05-13 |
| – | Case-collision `XPBar.tsx` | `35fe008` | 2026-05-13 |
| – | OAuth redirected to landing instead of originating page | `1930b10` | 2026-05-14 |
| – | Negative daily XP | `1930b10` | 2026-05-14 |
| – | HexRadar visual clutter | `1930b10` | 2026-05-14 |
| – | WheelTimePicker dropping web mouse-drag selections | `d2e4d27` | 2026-05-14 |
| – | Routine ignoring user wake time | `cedaf2a` + `3944ddd` + `d2e4d27` | 2026-05-14 |
| – | AI schema crash on unknown module string | `3944ddd` | 2026-05-14 |
| – | Root ErrorBoundary added | `c63b83a` | 2026-05-14 |
| – | Schedule single-source-of-truth (user row) | `c63b83a` | 2026-05-14 |
| – | Planner agent unit tests | `c63b83a` | 2026-05-14 |
| – | Zombie schema tables removed | `c613024` | 2026-05-14 |
| – | Drizzle baseline migration committed | `c613024` | 2026-05-14 |
| – | Typed telemetry events + worker allowlist sync (11 of 18 events were silently 400'd) | `c613024` | 2026-05-14 |
| – | Chat profile-context memo | `24edc46` | 2026-05-14 |
| – | MASTER_BRIEF + AI_FUNCTIONS doc reconcile | `24edc46` | 2026-05-14 |
| – | Smoke nav test scroll/click fix | `24edc46` | 2026-05-14 |
| – | webStorage.ts (695 lines) split per entity | `f004e13` | 2026-05-14 |

## Debt-to-Capacity Snapshot

- **Top 3 to fix this sprint:** push-token verification (gated on EAS), CI deploy (`#12`), tests for schedule SSOT invariant.
- **Top 3 to fix this quarter:** Drizzle migrator swap (`#1`), tokens to SecureStore (`#14`), onboarding v2 graduation (`#5`).
- **Top 3 to live with (for now):** cost ledger surface (`#8`), per-entity query duplication (`#2`), parent CLAUDE.md edit (`#10`).
