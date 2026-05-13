# LifeOS Architect Review & Punch-list — 2026-05-13

Recall trigger: when the user says **"fix the defects raised by solution architect"**, work through this list top-down. Mark items as ✅ in this file (or move them to a "Done" section) as they're closed.

Branch this was written against: `claude/interesting-rubin-97ecf6` at commit `7fa58a7`.

---

## P0 — Do this week

### P0-1. Fix 6 pre-existing TypeScript errors

All concentrated in 3 files. Strict-mode project — these signal the type checker is being implicitly ignored.

- [ ] **`app/(tabs)/finance.tsx` (4 errors)**
  - L203/L205: `WebFinanceMilestone` shape diverges from the inline state type — missing `goalId` and `createdAt` fields. Pick one source of truth; either widen the inline type or narrow what `getFinanceMilestonesByGoal` returns.
  - L380/L409: `outlineStyle: 'none'` on `TextInput` is RN-web-only but typed against `TextStyle`. Wrap in `Platform.select({ web: { outlineStyle: 'none' as const }, default: {} })`.

- [ ] **`app/(tabs)/health.tsx` (1 error)**
  - L187: `WebFoodEntry.fibre: number \| undefined` vs. an inline `number \| null`. Align — either `null` everywhere or `undefined` everywhere. Match the existing record shape (`undefined` is the web convention here).

- [ ] **`evals/cases/ragRetrieve.ts` (1 error)**
  - L19: output type lacks the index signature the eval suite's `Grader` shape expects. Add `[k: string]: unknown` or relax the suite generic.

**Acceptance:** `npx tsc --noEmit 2>&1 | wc -l` returns 0.

### P0-2. Wire push-token registration (or delete it)

`src/utils/pushRegister.ts` has 0 imports. Admin push broadcasts currently reach **zero devices**.

- [ ] Call `registerPushToken()` from `src/hooks/useNotifications.ts` after permission is granted.
- [ ] Verify a device row appears in the worker's `expo_push_tokens` table after one app open.
- [ ] If push broadcast is not a roadmap item, delete `pushRegister.ts` and the worker route instead.

### P0-3. Add indexes on hot-path columns

`src/db/index.ts` only declares one `CREATE INDEX` (on `chat_messages`). Add for:

- [ ] `routine_blocks (date)` — every Today load filters by date
- [ ] `routine_blocks (date, status)` — replan + inference scan
- [ ] `behaviour_events (created_at)` — weekly insight + inference job
- [ ] `behaviour_events (event_type, created_at)` — funnel + inference
- [ ] `goals (user_id, parent_id)` — hierarchy traversal

Use `CREATE INDEX IF NOT EXISTS` so reruns are safe. Match the pattern of the existing chat_messages_user_idx.

### P0-4. Add a root ErrorBoundary

`CLAUDE.md` claims "Error boundaries on every screen." None found in `app/` or `src/`.

- [ ] Create `src/components/shared/ErrorBoundary.tsx` (class component, since React Native still requires it).
- [ ] Wrap `app/_layout.tsx`'s `<Stack>` in `<ErrorBoundary>`.
- [ ] Log the caught error via `track('ui_crash', { error, stack })` so we see it in admin telemetry.

---

## P1 — Next sprint

### P1-5. Drop zombie tables (or commit to building them)

Schema-only with no queries, no UI, no roadmap commitment:

- [ ] `contacts`, `contact_interactions` (Social module — WIP for months)
- [ ] `habits` (no habit-tracking surface anywhere)
- [ ] `learning_resources`, `career_profiles` (Career tab uses `localStorage` via `careerStorage.ts`, never these SQLite tables)

Remove from `src/db/schema.ts`, the `CREATE TABLE` block in `src/db/index.ts`, and any orphan web-storage helpers. Add a migration that drops them on existing installs (or leave the tables in place if migration risk > value — but stop pretending in `schema.ts`).

### P1-6. Split `webStorage.ts` and `db/index.ts` per-entity

Both files are >350 lines and have to be edited every time a new entity is added.

- [ ] Split `src/db/webStorage.ts` (695 lines) into `src/db/webStorage/{users,routine,health,goals,...}.ts` with an `index.ts` re-export.
- [ ] Split the inline SQL `CREATE TABLE` block in `src/db/index.ts` into `src/db/migrations/init.ts` (or actual Drizzle migrations — see P1-7) so each entity owns its table definition.

### P1-7. Generate + commit actual Drizzle migrations

`drizzle.config.ts` points to `./src/db/migrations` — the directory doesn't exist. Schema lives in two places (`schema.ts` + raw SQL in `index.ts`) and can drift silently.

- [ ] Run `npx drizzle-kit generate` to produce the initial migration.
- [ ] Commit `src/db/migrations/*.sql`.
- [ ] Replace the hand-maintained `CREATE TABLE IF NOT EXISTS` block in `initDatabase()` with `runMigrations()` that applies migrations idempotently.

### P1-8. Type the telemetry event names

Stringly-typed event names — a typo silently drops the event (worker allowlist swallows unknowns).

- [ ] Promote event names to a const map in `src/utils/telemetry.ts`:
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
- [ ] Replace every literal in `track('...')` call sites with `track(EVENTS.x, …)`. Catches typos at compile time and gives a single grep target.

---

## P2 — Soon

### P2-9. Plan v2 onboarding graduation

Three onboarding paths coexist (legacy `day1-*`, discovery import, v2 chat). `_layout.tsx` still defaults new users to `day1-vision`.

- [ ] Pick a target rollout % at which `onboarding_v2 = true` becomes default for everyone.
- [ ] Update `app/_layout.tsx` to route new users to `/welcome-intent` directly (it already exists as an entry — just stop bypassing it).
- [ ] After v2 is the default, delete `app/(onboarding)/day1-vision.tsx`, `day1-career.tsx`, `day1-routine.tsx`, `src/db/queries/discoverySeed.ts`, and remove the `first_blueprint` badge duplication across three commit sites.

### P2-10. Memoize `buildProfileContext` per chat session

`app/chat.tsx`'s `send()` re-runs `getUserProfile` + `getRoutineBlocksByDate` + `buildProfileContext` on every message. Cheap now (one SQLite read each), but wasteful.

- [ ] Cache the context block in a `useRef` keyed by `profile.lastUpdated` + today's date. Rebuild only when either changes.

### P2-11. Surface `costLedger` or remove it

`src/ai/costLedger.ts` has in-memory accumulators that are read only by the eval runner. If you ever charge per-user this is foundational; if not, it's complexity for ops alone.

- [ ] Decide: ship a cost view in the admin portal, OR demote to eval-only and delete the runtime hooks.

### P2-12. Reconcile docs with backend posture

- [ ] `MASTER_BRIEF.md` differentiator #3 still says "Everything lives on-device in SQLite — no backend, no data sharing." Worker + Supabase auth + opt-in telemetry contradict this verbatim. Rewrite to match the FAQ section already updated.
- [ ] `CLAUDE.md` lists `expo-health` as a dependency for HealthKit. Actually you use Google Fit + manual logs. Remove the line.
- [ ] `AI_FUNCTIONS.md` now mentions `LLM_PROVIDER` env var on the Worker for switching providers. Either add a test that exercises every provider path, or note in the doc that only Anthropic is wired in production.

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
- 2026-05-13 / T4 verification: `npx tsc --noEmit` on the current `lifeosv1` base reports unrelated gamification errors: `XpBar`/`XPBar` casing and duplicate `xpForLevel`, `levelFromXP`, and `xpProgressInLevel` exports in `src/utils/gamification.ts`. This is outside the root ErrorBoundary scope.
