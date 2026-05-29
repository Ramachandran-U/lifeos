# Debug Handover — Verified QA Findings (BUG-008 … BUG-015)

> Prepared for a fresh Claude Code session. Each item was **verified against the source** (not just the QA report). For confirmed bugs you get the exact root cause (`file:line`), a debug/fix plan, and the regression test to add. **Do not fix anything blind — read the cited file first, then implement + test.**
>
> Two of the reported bugs did NOT reproduce in code; their entries explain why and what the reporter likely actually saw. One report had the right symptom but the **wrong root cause** — corrected below.

## Status (updated 2026-05-30) — ALL CLOSED

Every bug in this handover is now resolved on `lifeosv1`. This doc is retained as a **historical record** of the verification + fix-location reasoning, not an active task list.

| Bug | Resolution |
|---|---|
| BUG-001 #1 (userId mismatch) | `rewriteUserIdNative` + `ensureLocalUserFromAuth` (`f0e7854`) |
| BUG-001 #2 (weekly/daily dropped) | `AddGoalSheet` now uses `persistHierarchy` (batch `5c94184`) |
| BUG-008 (DB init double-invoke) | Module-level `didBootInit` guard in `_layout.tsx` (batch `5c94184`) |
| BUG-009 (domain taxonomy) | `mind`→`polymath` rename + 6th Life-hub card (`5aff7cb`) |
| BUG-010 (`/chat` bounced) | `chat` added to `routeGuard.ts` allowlist (batch `5c94184`) |
| BUG-011 (goal-text injection) | Regression test (`a4b070c`) |
| BUG-012 (decompose UX) | AbortController + Cancel + 8s "Still working" hint (batch `5c94184`) |
| BUG-013 (onboarding bypass) | Guard verified + test (`a4b070c`) |
| BUG-014 (unsorted storage) | Sort-on-read + test (batch `5c94184`) |
| BUG-015 (reflect selections lost) | `setReview` persists a draft via `upsertReflection` (batch `5c94184`) |

Reading the file-line citations below is still useful if you want to understand *how* those root causes were found — they remain accurate snapshots of the code at the time of the audit. The "Suggested fix order" section at the bottom is obsolete.

---

## Verification summary

| Bug | Reported severity | Verified status | Root cause located |
|---|---|---|---|
| BUG-008 DB-init multi-invoke | (note only) | **Confirmed — Low** | `app/_layout.tsx:37`, `src/db/index.web.ts:19` |
| BUG-009 domain taxonomy split | Medium | **Confirmed** | `LifeHubSheet.tsx:19`, `useGameStore` domains, `GOAL_TYPE_LEGEND` |
| BUG-010 `/chat` → `/` redirect | Medium | **Confirmed — wrong cause in report** | `app/_layout.tsx:142-158` (allowlist), NOT `chatbot_beta` |
| BUG-011 injection in goal text | Medium | **Not a bug** — defenses hold; add regression test | `AddGoalSheet`, `functions.ts` (Zod) |
| BUG-012 decompose slow, no progress UI | Medium | **Confirmed** | `AddGoalSheet.tsx:101-106` |
| BUG-013 onboarding bypass | Low | **Not reproduced** — guard present | `app/_layout.tsx:135-140` |
| BUG-014 routine blocks unsorted in storage | Low | **Confirmed** | `src/db/webStorage/routine.ts:20-32` |
| BUG-015 "Did it" not persisted on click | Low | **Confirmed** | `app/evening-reflect.tsx:116-119, 202-211` |
| BUG-001 goals don't persist (referenced) | (Critical, referenced) | **Not reproduced as stated** — but found a real adjacent defect (weekly/daily dropped) + a runtime hypothesis | `AddGoalSheet.tsx:37-72`, `useGoalStore.ts:17` |

---

## BUG-010 — `/chat` silently redirects to `/` (CONFIRMED; report's cause is wrong)
**Severity:** Medium · **Area:** Routing

**Verified root cause —** the report blamed `chatbot_beta: false`. That is NOT it. The real cause is the root layout's post-onboarding route allowlist. In [app/_layout.tsx:142-158](../app/_layout.tsx#L142), an onboarded user is only allowed on an explicit set of routes (`inTabs`, `inReflect`, `inSettings`, `inMonthlyInsight`, …). **`chat` is not in that list**, so line 158 `router.replace('/(tabs)')` fires. `app/chat.tsx` exists and is otherwise functional — it's orphaned by the guard. There is no `chatbot_beta` check anywhere near the routing.

**Debug/fix plan:**
1. Decide intent: is Chat meant to be reachable? If yes, add `const inChat = segments[0] === 'chat';` and include `inChat` in the `allowed` expression.
2. If Chat should be flag-gated, gate it *inside* `chat.tsx` (render a "Chat is in beta" state when `useFlagStore.getState().isEnabled('chatbot_beta')` is false) **and** still allow the route in the layout — otherwise the user gets a silent bounce, which is the actual bug.
3. Audit the same allowlist for other orphaned routes.

**Regression test:** Playwright smoke — navigate to `/chat` as an onboarded user; assert URL stays `/chat` (or shows the beta gate), not `/`.

**Risk:** Low. Additive change to a boolean expression.

---

## BUG-009 — Three different domain vocabularies (CONFIRMED)
**Severity:** Medium · **Area:** Life / Goals / data model

**Verified root cause —** three independent taxonomies for the same concept:
- **Score/storage domains** (`useGameStore` / `useDomainHistoryStore`, key `lifeos_domain_history_v1`): `goals, health, finance, career, social, mind`.
- **Life hub cards** ([LifeHubSheet.tsx:19-25](../src/components/shared/LifeHubSheet.tsx#L19)): exactly 5 — Goals, Health, Finance, Career, Social. **No "mind"/Polymath card.** Polymath is only reachable via the Explore tab, never the Life hub.
- **Goals screen "chips"**: these are actually the `GOAL_TYPE_LEGEND` goal-type labels (Career/Health/Finance/Social/Learning/Personal), a *fourth* vocabulary that uses `learning`/`personal` where the score model uses `mind`.

So a user can never reach the `mind` domain that's already being scored, and "Learning"/"Personal"/"Mind"/"Polymath" are used interchangeably for overlapping ideas.

**Debug/fix plan (decide taxonomy first — this is a product decision, not just code):**
1. Pin ONE canonical domain enum (likely the existing `DomainId` in `useUserStore`: `goals, health, finance, career, social, polymath`). Reconcile `mind` vs `polymath`.
2. Map `GOAL_TYPE` (career/health/finance/social/learning/personal) to canonical domains explicitly in one place; don't let goal-types masquerade as domains.
3. Add the 6th hub card to `LifeHubSheet` (`polymath`/`mind`) so the scored domain is reachable.
4. Add a unit test asserting the three surfaces resolve to the same canonical set.

**Risk:** Medium — touches scoring keys; if you rename `mind`→`polymath` in storage, add a migration/alias so existing `lifeos_domain_history_v1` data isn't orphaned.

> NOTE: this is the task-0 prerequisite for the domain-stagnation detector — see [implementation-plan/phase-2-domain-stagnation-detector.md](../implementation-plan/phase-2-domain-stagnation-detector.md).

---

## BUG-012 — Decompose has no progress/cancel/timeout UI (CONFIRMED)
**Severity:** Medium · **Area:** Goals / AI UX

**Verified root cause —** [AddGoalSheet.tsx:101-106](../src/components/modules/goals/AddGoalSheet.tsx#L101): while `loading`, it renders only `<LoadingDots />` + static "Breaking down your goal…". `handleDecompose` is a single `decomposeGoal()` round-trip via `useAI().call`; there is no staged progress, no cancel button, no after-N-seconds copy, no timeout. The ~18 s wall-clock is one cold model call.

**Debug/fix plan:**
1. Add a cancel affordance: thread an `AbortController` through `useAI`/`callAI` (verify `callAI` forwards `signal` to fetch; if not, that's a prerequisite) and a "Cancel" button that aborts and resets state.
2. Add a delayed "Still working… large goals can take ~20s" message after ~8 s (setTimeout cleared on resolve).
3. Confirm a timeout produces a user-readable message, not a hang.

**Regression test:** component test — mock a slow `decomposeGoal`; assert the delayed message appears and Cancel resets `hierarchy`/`loading`.

**Risk:** Low–Medium (depends on whether `callAI` already supports `AbortSignal`).

---

## BUG-014 — Routine blocks not sorted by `startTime` in web storage (CONFIRMED)
**Severity:** Low · **Area:** Persistence

**Verified root cause —** [src/db/webStorage/routine.ts:20-32](../src/db/webStorage/routine.ts#L20): `webInsertRoutineBlock` does `all.push(block)` (insertion order); the getters only `.filter(...)`, never sort. Storage order = insertion order. The UI compensates (e.g. [evening-reflect.tsx:69](../app/evening-reflect.tsx#L69)), so it's invisible today — purely a storage-cleanliness issue that will bite once a remote DB query assumes order.

**Debug/fix plan:** sort on read in the web getters (cheap, localized; parity with eventual SQL `ORDER BY start_time`). Don't sort on write.

**Regression test:** unit test on `webGetRoutineBlocksByDate` — insert out-of-order, assert ascending `startTime`.

**Risk:** Very low.

---

## BUG-015 — "Did it" click doesn't persist; mid-flow refresh loses selections (CONFIRMED)
**Severity:** Low–Medium · **Area:** Evening reflect / Persistence

**Verified root cause —** [evening-reflect.tsx:116-119](../app/evening-reflect.tsx#L116): `setReview` only calls `setBlockReviews((prev)=>…)` — pure React state. Block status is **never** written to `routine_blocks` by this screen, and the reflection record is only persisted in `finish()` via `upsertReflection(...)` at [line 205](../app/evening-reflect.tsx#L205). Hydration on mount only restores selections if a *completed* reflection already exists ([line 75](../app/evening-reflect.tsx#L75)). Therefore a refresh mid-flow loses all Did/Skipped/Moved selections.

**Debug/fix plan (pick one, confirm intended design):**
1. *Minimal:* persist an in-progress draft — write `blockReviews`/`mood` on each change (debounced); hydrate it on mount even when not finished.
2. *Fuller:* also reflect each Did/Skip into the block's `status` via `updateRoutineBlock(blockId, { status })` — but verify against `finish()`'s logic and the seed hydration at [line 80](../app/evening-reflect.tsx#L80).
3. Keep writes idempotent (no duplicate behaviour events).

**Regression test:** component test — set two reviews, simulate remount, assert restored.

**Risk:** Medium — interacts with `finish()` and the onboarding-v2 tomorrow-regeneration branch; read [lines 202-256](../app/evening-reflect.tsx#L202) first.

---

## BUG-008 — DB-init invoked without a run-once guard (CONFIRMED — Low)
**Severity:** Low · **Area:** Boot / cross-cutting

**Verified root cause —** [app/_layout.tsx:37-78](../app/_layout.tsx#L37): `init()` runs in a `useEffect` (stable deps → once per mount in prod, **twice under React StrictMode in dev**). No idempotency guard. On web, [index.web.ts:19](../src/db/index.web.ts#L19) logs each call → the console noise the reporter saw. `init()` also kicks `fetchFlags()`/`fetchPrompts()`.

**Good news on cost:** `fetchFlags` is staleness-guarded (`STALE_MS`, [useFlagStore.ts:46](../src/store/useFlagStore.ts#L46)) and early-returns when fresh — a double-invoke does **not** double-spend. Risk is cosmetic + future-proofing.

**Debug/fix plan:** add a module-level `didInit` guard around `init()`; downgrade/drop the web `console.log`; audit any future bootstrapping added to `init()`.

**Risk:** Low.

---

## BUG-011 — Prompt-injection / XSS in goal text (NOT A BUG; add regression test)
**Verified —** `decomposeGoal` output is parsed through a Zod schema ([src/ai/functions.ts](../src/ai/functions.ts) `GoalHierarchy`), and React escapes rendered text (no `dangerouslySetInnerHTML`). Defenses hold at the UI layer.

**Action (hardening):** add a Playwright regression that pastes the payload and asserts no `alert`, no system-prompt leak, inert text. (Already partially actioned in commit `a4b070c`.)

---

## BUG-013 — Onboarding bypass (NOT REPRODUCED)
**Verified —** [app/_layout.tsx:135-140](../app/_layout.tsx#L135) guards: `onboardingStage === 0` → `/welcome-intent`; `< ONBOARDING_COMPLETE` → `/(onboarding)/day1-vision`. A partially-onboarded user IS redirected. (Already actioned/tested in commit `a4b070c`.)

---

## BUG-001 (referenced) — "Decomposed goals don't persist" (NOT REPRODUCED AS STATED — adjacent defect found)
**Verified —** the web persistence path is correct: `AddGoalSheet.handleSave` → `useGoalStore.addGoal` ([useGoalStore.ts:17](../src/store/useGoalStore.ts#L17)) → `createGoal` → `webInsertGoal` → `save(GOALS_KEY)` ([webStorage/goals.ts:23](../src/db/webStorage/goals.ts#L23)). Life/yearly/monthly goals **should** survive reload on web.

**Two things to investigate at runtime:**
1. **userId mismatch hypothesis (most likely cause of the reporter's observation):** goals are saved under the `userId` active at creation. On reload, [app/_layout.tsx:43-54](../app/_layout.tsx#L43) re-derives the user from the Supabase session. If creation-time `userId` ≠ post-reload session id, `getGoalsByUser(userId)` returns nothing while the goal still sits in `GOALS_KEY`. **Verify:** create a goal, dump `localStorage.lifeos_goals`, reload, compare stored `userId` to `useUserStore.getState().userId`.
2. **Real adjacent defect (CONFIRMED in code):** `handleSave` ([AddGoalSheet.tsx:37-72](../src/components/modules/goals/AddGoalSheet.tsx#L37)) persists only `life` + `yearly` + `monthly`. It **silently drops `weekly` and `dailyTaskExamples`**, and reimplements persistence inline instead of using the canonical `persistHierarchy()` ([src/utils/persistHierarchy.ts](../src/utils/persistHierarchy.ts)) that onboarding uses ([day1-vision.tsx:51](../app/(onboarding)/day1-vision.tsx#L51)).

**Debug/fix plan:** reproduce #1 with the localStorage dump; if confirmed, fix belongs in auth→local-user reconciliation. For #2, replace the inline persistence with `persistHierarchy(userId, hierarchy, createGoal)` so `/goals` and onboarding share one path. Add a test asserting all five levels persist.

**Risk:** Medium — unifying on `persistHierarchy` changes what gets written; confirm the goals tree renderer handles the added weekly/daily nodes (it renders `childrenByParent` recursively, so it should).

---

## Suggested fix order
1. **BUG-001 investigation** (userId hypothesis) — potentially Critical if confirmed; cheap to check.
2. **BUG-010** (orphaned `/chat`) — one-line allowlist fix.
3. **BUG-015** (reflection draft persistence) — user-visible data loss.
4. **BUG-009** (taxonomy) — product decision first, then code (also unblocks the domain-stagnation detector).
5. **BUG-012** (decompose UX), **BUG-014** (sort-on-read), **BUG-008** (init guard) — quick hardening.
6. **BUG-011 / BUG-013** — done in `a4b070c`; keep the regression tests.

**Do not** start coding until you've read each cited file in full. Several fixes interact (BUG-001 unifying on `persistHierarchy`, BUG-015 touching `finish()`); land them as separate small commits with tests.
