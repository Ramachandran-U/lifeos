# LifeOS Architect Review & Punch-list — 2026-05-13

Recall trigger: when the user says **"fix the defects raised by solution architect"**, work through this list top-down. Mark items as ✅ in this file (or move them to a "Done" section) as they're closed.

Branch this was written against: `claude/interesting-rubin-97ecf6` at commit `7fa58a7`.

## Status (as of 2026-05-14)

The full sweep happened across two sessions on 2026-05-14. Items ticked below.

**Open after sweep:**
- §P0-2 part 2 — push token e2e verify needs an EAS native build to confirm a row reaches `expo_push_tokens` (gated on device build).
- §P1-7 part 3 — swap `initDatabase()` to `runMigrations()` needs Metro `.sql` resolver wiring (requires babel/metro plugin work; deferred).
- §P2-9 — onboarding v2 graduation: product call on rollout % pending.
- §P2-11 — `costLedger` surface-vs-delete: product call pending.
- Parent (cross-repo) `CLAUDE.md` `expo-health` line — auto-mode classifier blocks edits outside repo root; manual edit needed.

**Discovered defects log** (added during the sweep, all resolved):
- `2026-05-14 / T1 verification` — Playwright smoke had `import.meta` parse + Privacy-residency selector timeout. ✅ Resolved — `import.meta.env` neutraliser confirmed working in dist; smoke nav now waits + scrolls before clicking.
- `2026-05-14 / Aurora v2 launch` — React #185 infinite loop from `useDomainHistoryStore.yesterdaySnapshot()` returning a fresh object each call. ✅ Fixed via select(entries) + useMemo. Smoke seed now exercises the bug class.
- `2026-05-14 / Gmail Connect` — OAuth callback routes (Gmail, Calendar, Fit) were not whitelisted by the layout's auth guard; user landed on Today instead of completing the exchange. ✅ Fixed — any `*-callback` segment is now in-OAuth-callback.
- `2026-05-14 / boot` — Supabase auth listener fired `INITIAL_SESSION` with `null` for any user without a Supabase session, silently signing out legacy email/password users. ✅ Fixed — only `SIGNED_OUT` triggers reset.
- `2026-05-14 / Analyse my career path` — silent failure on Zod parse + no UI error surfacing. ✅ Fixed — sanitizer for common Gemini hallucinations + Career screen now renders `useAI`'s error.

---

## P0 — Do this week

### P0-1. Fix 6 pre-existing TypeScript errors

All concentrated in 3 files. Strict-mode project — these signal the type checker is being implicitly ignored.

- [x] ✅ **`app/(tabs)/finance.tsx` (4 errors)**
  - L203/L205: `WebFinanceMilestone` shape diverges from the inline state type — missing `goalId` and `createdAt` fields. Pick one source of truth; either widen the inline type or narrow what `getFinanceMilestonesByGoal` returns.
  - L380/L409: `outlineStyle: 'none'` on `TextInput` is RN-web-only but typed against `TextStyle`. Wrap in `Platform.select({ web: { outlineStyle: 'none' as const }, default: {} })`.

- [x] ✅ **`app/(tabs)/health.tsx` (1 error)**
  - L187: `WebFoodEntry.fibre: number \| undefined` vs. an inline `number \| null`. Align — either `null` everywhere or `undefined` everywhere. Match the existing record shape (`undefined` is the web convention here).

- [x] ✅ **`evals/cases/ragRetrieve.ts` (1 error)**
  - L19: output type lacks the index signature the eval suite's `Grader` shape expects. Add `[k: string]: unknown` or relax the suite generic.

**Acceptance:** `npx tsc --noEmit 2>&1 | wc -l` returns 0.

### P0-2. Wire push-token registration (or delete it)

`src/utils/pushRegister.ts` has 0 imports. Admin push broadcasts currently reach **zero devices**.

- [x] ✅ Call `registerPushToken()` from `src/hooks/useNotifications.ts` after permission is granted.
- [ ] Verify a device row appears in the worker's `expo_push_tokens` table after one app open.
- [ ] If push broadcast is not a roadmap item, delete `pushRegister.ts` and the worker route instead.

### P0-3. Add indexes on hot-path columns

`src/db/index.ts` only declares one `CREATE INDEX` (on `chat_messages`). Add for:

- [x] ✅ `routine_blocks (date)` — every Today load filters by date
- [x] ✅ `routine_blocks (date, status)` — replan + inference scan
- [x] ✅ `behaviour_events (created_at)` — weekly insight + inference job
- [x] ✅ `behaviour_events (event_type, created_at)` — funnel + inference
- [x] ✅ `goals (user_id, parent_id)` — hierarchy traversal

Use `CREATE INDEX IF NOT EXISTS` so reruns are safe. Match the pattern of the existing chat_messages_user_idx.

### P0-4. Add a root ErrorBoundary

`CLAUDE.md` claims "Error boundaries on every screen." None found in `app/` or `src/`.

- [x] ✅ Create `src/components/shared/ErrorBoundary.tsx` (class component, since React Native still requires it).
- [x] ✅ Wrap `app/_layout.tsx`'s `<Stack>` in `<ErrorBoundary>`.
- [x] ✅ Log the caught error via `track(EVENTS.uiCrash, { error, stack })` so we see it in admin telemetry.

---

## P1 — Next sprint

### P1-5. Drop zombie tables (or commit to building them)

Schema-only with no queries, no UI, no roadmap commitment:

- [x] ✅ `contacts`, `contact_interactions` (Social module — WIP for months)
- [x] ✅ `habits` (no habit-tracking surface anywhere)
- [x] ✅ `learning_resources`, `skill_gaps`, `career_profiles` (Career tab uses `localStorage` via `careerStorage.ts`, never these SQLite tables)

Remove from `src/db/schema.ts`, the `CREATE TABLE` block in `src/db/index.ts`, and any orphan web-storage helpers. Add a migration that drops them on existing installs (or leave the tables in place if migration risk > value — but stop pretending in `schema.ts`).

### P1-6. Split `webStorage.ts` and `db/index.ts` per-entity

Both files are >350 lines and have to be edited every time a new entity is added.

- [x] ✅ Split `src/db/webStorage.ts` (695 lines) into `src/db/webStorage/{users,routine,health,goals,...}.ts` with an `index.ts` re-export.
- [ ] Split the inline SQL `CREATE TABLE` block in `src/db/index.ts` into `src/db/migrations/init.ts` (or actual Drizzle migrations — see P1-7) so each entity owns its table definition.

### P1-7. Generate + commit actual Drizzle migrations

`drizzle.config.ts` points to `./src/db/migrations` — the directory doesn't exist. Schema lives in two places (`schema.ts` + raw SQL in `index.ts`) and can drift silently.

- [x] ✅ Run `npx drizzle-kit generate` to produce the initial migration.
- [x] ✅ Commit `src/db/migrations/*.sql`.
- [ ] Replace the hand-maintained `CREATE TABLE IF NOT EXISTS` block in `initDatabase()` with `runMigrations()` that applies migrations idempotently.

### P1-8. Type the telemetry event names

Stringly-typed event names — a typo silently drops the event (worker allowlist swallows unknowns).

- [x] ✅ Promote event names to a const map in `src/utils/telemetry.ts`:
  ```ts
  export const EVENTS = {
    onboardingV2Started: 'onboarding_v2_started',
    slotFilled: 'slot_filled',
    discoveryChatCompleted: 'discovery_chat_completed',
    discoveryChatAbandoned: 'discovery_chat_abandoned',
    routineGenerated: 'routine_generated',
    firstBlockCompleted: 'first_block_completed',
    routineReplanned: 'routine_replanned',
    tomorrowRoutineGenerated: 'tomorrow_routine_generated',
    profileInferenceRun: 'profile_inference_run',
    // ...
  } as const;
  ```
- [x] ✅ Replace every literal in `track('...')` call sites with `track(EVENTS.x, …)`. Catches typos at compile time and gives a single grep target. Worker allowlist also synced — 11 of 18 events were silently 400'd in prod before this.

---

## P2 — Soon

### P2-9. Plan v2 onboarding graduation

Three onboarding paths coexist (legacy `day1-*`, discovery import, v2 chat). `_layout.tsx` still defaults new users to `day1-vision`.

- [ ] Pick a target rollout % at which `onboarding_v2 = true` becomes default for everyone.
- [ ] Update `app/_layout.tsx` to route new users to `/welcome-intent` directly (it already exists as an entry — just stop bypassing it).
- [ ] After v2 is the default, delete `app/(onboarding)/day1-vision.tsx`, `day1-career.tsx`, `day1-routine.tsx`, `src/db/queries/discoverySeed.ts`, and remove the `first_blueprint` badge duplication across three commit sites.

### P2-10. ✅ Memoize `buildProfileContext` per chat session

`app/chat.tsx`'s `send()` re-runs `getUserProfile` + `getRoutineBlocksByDate` + `buildProfileContext` on every message. Cheap now (one SQLite read each), but wasteful.

- [x] ✅ Cache the context block in a `useRef` keyed by `profile.lastUpdated` + today's date. Rebuild only when either changes.

### P2-11. Surface `costLedger` or remove it

`src/ai/costLedger.ts` has in-memory accumulators that are read only by the eval runner. If you ever charge per-user this is foundational; if not, it's complexity for ops alone.

- [ ] Decide: ship a cost view in the admin portal, OR demote to eval-only and delete the runtime hooks.

### P2-12. Reconcile docs with backend posture

- [x] ✅ `MASTER_BRIEF.md` differentiator #3 — rewritten 2026-05-14 to acknowledge worker + Supabase + opt-in telemetry while affirming on-device for sensitive data.
- [ ] `CLAUDE.md` lists `expo-health` as a dependency for HealthKit. Actually you use Google Fit + manual logs. Remove the line. — _Blocked: auto-mode classifier prevents editing files outside the project root. Manual edit needed._
- [x] ✅ `AI_FUNCTIONS.md` LLM_PROVIDER note — clarified to reflect actual per-task `pickModel()` switch + that only Anthropic path is exercised in prod (Gemini code paths exist but unverified against live traffic).

---

## Verification gate

When working this list, after each P0 item:
1. `npx tsc --noEmit 2>&1 | wc -l` → did the count drop?
2. `npm run evals` → still 10/10 green?
3. `git diff --stat` → did the change stay within the scoped files?

For P1/P2 items, also include:
4. A note in `docs/MASTER_BRIEF.md` / `PRODUCT_TECHNICAL_DOC.md` if the change is user-visible or marketing-relevant.

---

## Source

Full audit log lives in this branch's session transcript. Key signals that drove the list:
- 47 pre-existing TS errors, all in 3 files, stable for weeks
- `grep -rln 'pushRegister' src/ app/` → 0 hits
- `grep -rln 'StreakCounter' src/ app/` → 0 hits (delete)
- `grep -rln 'XpChip' src/ app/` → 0 hits (delete)
- 5 tables in `schema.ts` with no query files
- `src/db/migrations` referenced by `drizzle.config.ts` but doesn't exist
- 3 onboarding paths active simultaneously; `first_blueprint` badge fires from 3 different commit sites

## Discovered defects

- 2026-05-13 / T1 verification: `npx playwright test e2e/smoke.spec.ts` fails after Expo web is running because routes throw `SyntaxError: Cannot use 'import.meta' outside a module`; the profile navigation smoke also times out waiting for `text=Privacy & data residency`. This is outside the T1 TypeScript-fix scope and should be handled in T9 smoke triage.
