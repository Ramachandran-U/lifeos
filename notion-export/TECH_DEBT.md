# Technical Debt Register

Severity scale: 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low.

## Active Debt

| # | Debt Area | Severity | Description | Suggested Fix | Impact if Ignored |
|---|---|---|---|---|---|
| 1 | Drizzle migrations missing | 🟠 High | `drizzle.config.ts` points to `src/db/migrations` which doesn't exist. Schema lives in two places (`schema.ts` + raw SQL in `index.ts`) and can drift silently. | Run `drizzle-kit generate`; commit the SQL; replace hand-maintained `CREATE TABLE IF NOT EXISTS` block with `runMigrations()` | Schema drift between native, web, and Supabase; impossible to reason about migrations across installed devices |
| 2 | Web/native query duplication | 🟠 High | Every query file has a `Platform.OS === 'web'` branch into `webStorage.ts` (695 lines). Adding an entity requires editing 3 files. | Split `webStorage.ts` per entity; co-locate native + web in one query file per entity | Maintenance cost grows with each new entity |
| 3 | Stringly-typed telemetry events | 🟡 Medium | A typo in a `track('...')` call silently drops the event (worker allowlist swallows unknowns). | Promote to `EVENTS` const map; replace literals with `EVENTS.x` | Lost analytics; bugs invisible until you notice the missing data |
| 4 | Zombie tables | 🟡 Medium | `contacts`, `contact_interactions`, `habits`, `learning_resources`, `career_profiles` defined in schema but have no queries or UI. | Drop with a migration, or commit to building them | Schema lies; new contributors waste time wiring through them |
| 5 | Three onboarding flows live simultaneously | 🟡 Medium | day1-* (legacy), discovery-* (paste import), discovery-chat (v2). `_layout.tsx` still defaults new users to day1-vision in some paths. | Pick rollout %; route new users to welcome-intent only; delete day1-* once v2 is default | Cognitive overhead; duplicate `first_blueprint` award sites; bugs hard to test against |
| 6 | No root ErrorBoundary | 🟠 High | `CLAUDE.md` claims "Error boundaries on every screen" — none exist in `app/` or `src/`. A render crash takes the whole app down. | Class component `ErrorBoundary` wrapping `<Stack>` in `app/_layout.tsx`; log via `track('ui_crash')` | Single bad render unmounts the app; no telemetry on crashes |
| 7 | Push token wiring unverified end-to-end | 🟠 High | `registerPushToken()` is called after permission, but no confirmation that a row reaches the worker's `expo_push_tokens` table for any real device. | Manual native run with logging; or add a server-side debug endpoint | Admin push broadcasts may be reaching zero devices |
| 8 | Cost ledger surfaces nowhere | 🟢 Low | `src/ai/costLedger.ts` accumulates in memory; read only by eval runner. | Surface in admin OR demote to eval-only | Foundational if you ever bill per-user; complexity-for-ops today |
| 9 | Goal-comments table built, UI not wired | 🟡 Medium | `goalComments` query + tests exist; no surface displays them. | Add a thread view to `GoalDetailSheet` | Half-finished feature signal |
| 10 | Doc/code mismatch | 🟡 Medium | `MASTER_BRIEF.md` claim "Everything lives on-device in SQLite — no backend, no data sharing" contradicted by worker + Supabase + opt-in telemetry. | Rewrite to match FAQ. Drop `expo-health` reference in CLAUDE.md (uses Google Fit + manual). Annotate `LLM_PROVIDER` env var in `AI_FUNCTIONS.md`. | Confused contributors; investor narrative drifts from reality |
| 11 | Web bundle env vars off-repo | 🟠 High | `.env` is gitignored. `EXPO_PUBLIC_AI_PROXY_URL`, `EXPO_PUBLIC_SUPABASE_*` only on the deploying machine. Different machine = bundle inlines empty strings (already shipped that bug). | Document in `docs/PRE_PRODUCTION_CHECKLIST.md`; consider a `.env.deploy.example` and a CI-gated deploy with secrets | Production breakage from a different deploy machine |
| 12 | Manual web deploy | 🟡 Medium | `npm run deploy` runs locally with `wrangler pages deploy`. No CI. | GitHub Action with `EXPO_PUBLIC_*` secrets | Bus factor + reproducibility |
| 13 | E2E smoke broken on web | 🟡 Medium | `npx playwright test e2e/smoke.spec.ts` fails — `SyntaxError: Cannot use 'import.meta' outside a module` despite post-export neutraliser; profile-residency selector timeout. | Debug script vs runtime mismatch; verify smoke against fresh `npm run deploy` output | False sense of regression coverage |
| 14 | OAuth tokens in localStorage | 🟠 High | `lifeos_gmail_tokens`, `lifeos_gcal_tokens`, `lifeos_gfit_tokens` stored in plain localStorage. | Expo SecureStore on native; encrypted-at-rest plan for web | XSS theft of bank-read OAuth tokens |
| 15 | Schema-only height_cm column native, not surfaced | 🟢 Low | Native UI to set height pending; web flow updates it via `EditVitalsSheet`. | Mirror EditVitalsSheet on native; or move height to userProfile | Inconsistent UX between web and native |
| 16 | Browser localStorage churn | 🟡 Medium | All web data lives in localStorage. Clearing cookies/incognito wipes everything. | Migrate to IndexedDB for high-value sets (already done for transactions). Add export/restore. | "Asked to set vitals every login" reports |
| 17 | Three sources of truth for schedule | 🟠 High | `wakeTime` lives on user row, in `userProfile.schedule`, and as transient picker state. `what-lifeos-knows` updates only userProfile; day1-routine updates only user row. | Pick one canonical source (user row); add a sync helper for v2 edits | Already caused real "10am wake → routine starts at 7am" bug |
| 18 | No tests for routine planner agent | 🟠 High | The propose → critique → commit loop has no unit/integration test exercising the deterministic guards. | Add Jest test with mocked `callAI` returning blocks outside wake-sleep window; assert all filtered | Regressions in the agent reach production unnoticed |
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

## Debt-to-Capacity Snapshot

- **Top 3 to fix this sprint:** root ErrorBoundary, push token verification, schedule single-source-of-truth.
- **Top 3 to fix this quarter:** Drizzle migrations, webStorage split, onboarding v2 graduation.
- **Top 3 to live with (for now):** cost ledger surface, doc reconciliation, manual web deploy.
