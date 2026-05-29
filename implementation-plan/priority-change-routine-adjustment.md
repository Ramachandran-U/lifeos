# Priority Change → Routine Adjustment

> Comprehensive plan for making the routine actually *respond* when a user changes their life priorities. Covers every scenario, the two-option UX, tradeoff surfacing, impact on existing systems, and a phased rollout.

## Status (updated 2026-05-30)

| Phase | Status | Where it landed |
|---|---|---|
| **Phase A** — Two-option sheet, "Start tomorrow" pre-gens via `generateAndSaveTomorrow`, impact summary, behaviour event, `priorityAdjust` flag | ✅ **Shipped** | PR #43 (squash `8161fa1`) |
| **Phase B** — Real "Adjust now" with `replanRemainingDay`, `RoutineDiffPreview`, 5-phase sheet (`choice`/`loading`/`preview`/`applied`/`error`), 24h-TTL `replanStash` undo | ✅ **Shipped** | PR #50 (squash `16e199c`) |
| **Phase C** — Wire `GOAL_REBALANCE_PROMPT` as follow-up; "why did you change?" capture; animated diff transitions | ⏳ Not started | — |

**Design decisions resolved during build:**
- **Undo is routine-only** — restoring blocks reverses today's plan but priorities stay updated. (Spec originally proposed full reversal; the simpler model was preferred during implementation.)
- **AI failure shows an error phase** — no silent fall-through to tomorrow. Try-again / Start-tomorrow / Skip on failure.
- **Active expedition cap & expedition slowdown surfacing** — design captured in `assessImpact`; expedition table column not yet added (Explore v2 ships expeditions but the impact-time wiring uses an empty list for now).

The rest of this doc is the original spec, retained as the design reference.

---

## The broken feedback loop (why this matters)

Today: a user opens Profile → Edit Priorities → reorders/adds/removes domains → taps Save → `setPrimaryDomains(selectedInOrder)` updates the store → `router.back()` → **nothing happens.** The routine continues as if nothing changed. The user took the most meaningful action possible (reprioritized their life direction) and the app silently swallowed it.

This is the opposite of "adaptive." Priority change is the single strongest intent signal the user can emit — stronger than completing a block, stronger than a mood check-in. An adaptive life OS must *visibly respond* to it, immediately, or the user learns that settings are decorative.

## The product thesis

**When you change what matters, your day should change with it — on your terms.**

Two options, the user decides:
1. **"Adjust my day now"** — replan today's *remaining* blocks to reflect the new priorities. Completed/in-progress blocks are untouched (you can't unlive a morning).
2. **"Start fresh tomorrow"** — keep today as-is; tomorrow's plan is regenerated with the new priorities. Simpler, less disruptive, good default.

Both surface **what you're gaining AND what you're losing** before confirming — tradeoff awareness is the thing that makes this feel intelligent, not robotic.

## Every scenario, mapped

### S1 — User promotes a new domain (adds "health" to priorities)
- **Adjust now:** planner inserts 1-2 health blocks into today's remaining slots (displacing low-priority fillers or rest).
- **Tomorrow:** tomorrow's plan includes health blocks proportional to its priority rank.
- **Side effects:** stagnation detector starts watching health; polymath score computation reweights.

### S2 — User demotes a domain (removes "finance")
- **Adjust now:** finance blocks in remaining-today are replaced or shortened. If a finance block is linked to a specific goal, surface: *"Your 4pm Finance Review is tied to your savings goal — remove it or keep it?"*
- **Tomorrow:** finance time shrinks; freed time goes to higher-priority domains.
- **Side effects:** stagnation detector STOPS watching finance (it's not in primaryDomains); active finance goals are NOT abandoned (goals and priorities are independent — you can deprioritize a domain without canceling its goals). Any active finance expedition keeps running (user-committed; expedition status is separate from domain priority).

### S3 — User reorders priorities (health above career)
- **Adjust now:** if today has both health and career blocks, health blocks get the better (productive-hour) slots; career blocks shift to less-prime time.
- **Tomorrow:** the planner's constraint `primaryDomains` is ordered by priority — first domain gets the first/best time slots.
- **Side effects:** goal rebalance prompt (GOAL_REBALANCE_PROMPT — currently unused, wired here) can suggest re-allocating weekly hours.

### S4 — Change mid-day (some blocks completed, some in-progress)
- **Adjust now:** only REMAINING blocks (status `upcoming`) are eligible for replan. Completed and in-progress are frozen. The planner receives `frozenBlocks: [completed+inProgress]` as constraints.
- **Edge:** if the only remaining block is a 30-min wind-down at 10pm and it's 9pm, the replan has almost no room — surface: *"Not much day left — adjusting tomorrow instead?"* (graceful degradation, not a weird 1-block replan).

### S5 — Change in the evening (today nearly done)
- Default to "Start fresh tomorrow" (pre-selected). "Adjust now" is dimmed or shows a note: *"Only N minutes of today remain."* The user can still force it, but the UX guides them toward tomorrow.

### S6 — Change affects a domain with an active streak
- Demoting a domain does NOT break its streak retroactively — streaks track past behaviour, not future intent.
- But if no blocks for that domain appear in tomorrow's plan, the streak will naturally lapse (which is honest — the user chose this). Surface: *"Heads up — removing Health means your 12-day workout streak may lapse."* Not a blocker, just awareness.

### S7 — Change affects an active expedition
- Expeditions are user-committed journeys. Deprioritizing the domain does NOT auto-abandon the expedition. The expedition card stays in the Active row.
- The planner MAY allocate less time to that domain's blocks, which could slow expedition progress. Surface: *"Your 'History of Jazz' expedition is in Curiosity — it'll continue, but at a slower pace."*

### S8 — AI replan fails (network/timeout)
- Fallback: the priority change is saved to the store (always succeeds, local-first), and the user sees: *"Saved — your routine will update at the next daily refresh."* The evening-reflect tomorrow-regen picks it up automatically.
- Never block a priority save on an AI call. The store update is synchronous; the replan is best-effort.

### S9 — Undo
- For "Adjust now": the replaced blocks are kept in a `replacedBlocks` stash (not deleted) for 24h. An undo toast appears: *"Routine adjusted. Undo?"* Tapping undo restores the original blocks.
- For "Start tomorrow": undo is even simpler — regenerate tomorrow with the OLD priorities (the store keeps the previous `primaryDomains` until the undo window closes).
- After 24h, the stash clears and the replacedBlocks are truly gone.

### S10 — Multiple rapid changes (user is experimenting)
- Debounce: if the user saves priorities, goes back, re-enters, and saves again within 5 minutes, the replan uses the LATEST priorities and cancels any in-flight replan from the prior save.
- The undo stash always refers to the state BEFORE the first change in the window (so undo goes back to the real baseline, not an intermediate tweak).

## The UX flow

```
[Edit Priorities screen]
  user toggles/reorders → taps Save
                ↓
[Priority Change Sheet — slides up over the edit screen]
  ┌─────────────────────────────────────────────┐
  │  Your priorities are updated.                │
  │                                              │
  │  WHAT CHANGES                                │
  │  + Health: ~30 min added to your day         │
  │  − Finance: afternoon block removed          │
  │  ⚠ Your 12-day workout streak may lapse      │
  │    if Health is removed                      │
  │                                              │
  │  ┌──────────────┐  ┌────────────────────┐   │
  │  │ Adjust today │  │ Start tomorrow (R) │   │
  │  └──────────────┘  └────────────────────┘   │
  │                                              │
  │  (Skip — just save the setting)              │
  └─────────────────────────────────────────────┘
```

- **"Start tomorrow" is the recommended default** — less cognitive load, less risk, and the user gets to see the change fresh in the morning.
- **"Adjust today"** replans only remaining blocks. Shows a diff preview before confirming:

```
  ┌─────────────────────────────────────────────┐
  │  TODAY'S ADJUSTED PLAN                       │
  │                                              │
  │  ✓ 09:00 Deep work (career)     [kept]      │
  │  ✓ 11:00 Lunch                  [kept]      │
  │  ★ 13:00 30-min jog (health)    [NEW]       │
  │  ✕ 14:00 Finance review         [removed]   │
  │  ~ 15:00 Focus work → moved to 14:00        │
  │  ✓ 18:00 Wind down              [kept]      │
  │                                              │
  │  ┌───────────┐  ┌──────────────────┐        │
  │  │   Cancel  │  │  Apply changes   │        │
  │  └───────────┘  └──────────────────┘        │
  └─────────────────────────────────────────────┘
```

- **"Skip"** (the third option) saves the priorities silently — for users who just want to update the setting and don't care about routine changes right now. The next natural regen (evening reflect) picks it up. This is the safe "I don't want to think about this" escape hatch.

## Technical architecture

### What already exists and gets reused
| System | How it's reused |
|---|---|
| **Planner agent** (`src/ai/agent/planner.ts`) | The replan engine for "adjust today" — receives frozenBlocks + new primaryDomains |
| **`generateAndSaveTomorrow`** (`src/ai/replanApply.ts`) | The regen engine for "start tomorrow" |
| **`GOAL_REBALANCE_PROMPT`** (`src/ai/prompts/goals.ts`) | Finally wired — surfaces tradeoffs on domain changes |
| **Routine queries** (`src/db/queries/routine.ts`) | Replace/restore blocks |
| **Stagnation detector** (`src/cognition/domainStagnation.ts`) | Recalibrates watched domains on priority change |
| **Behaviour events** (`src/db/queries/behaviour.ts`) | Logs `priority_change` as a cognitive signal |
| **Mutation log** (`src/sync/mutationLog.ts`) | Block replacements are synced + reversible |

### New modules
- `src/cognition/priorityChangeHandler.ts` — pure orchestrator (testable):
  - `computePriorityDiff(oldDomains, newDomains)` → `{ added, removed, reordered, unchanged }`
  - `assessImpact(diff, todayBlocks, streaks, activeExpeditions, goals)` → `PriorityChangeImpact` (what's gained, lost, at-risk)
  - `buildReplanConstraints(completedBlocks, inProgressBlocks)` → constraints for the planner agent
  - `shouldDefaultToTomorrow(remainingMinutesToday)` → boolean (< 60 min → suggest tomorrow)
- `src/components/shared/PriorityChangeSheet.tsx` — the two-option bottom sheet with tradeoff preview
- `src/components/shared/RoutineDiffPreview.tsx` — the before/after diff card for "adjust today"

### Data flow

```
[Edit Priorities] → Save
  │
  ├─ setPrimaryDomains(newOrder)          (always, synchronous)
  ├─ updateUser(userId, {primaryDomains}) (always, synchronous)
  ├─ logBehaviourEvent('priority_change') (always)
  ├─ resetStagnationCooldowns(diff)       (always)
  │
  └─ show PriorityChangeSheet
       │
       ├─ [Start tomorrow]
       │    └─ pre-generate tomorrow in background
       │       (generateAndSaveTomorrow with new priorities)
       │       → toast "Tomorrow's plan is ready"
       │
       ├─ [Adjust today]
       │    └─ computeImpact → show RoutineDiffPreview
       │       → user confirms → replan remaining blocks
       │       → stash old blocks (undo, 24h TTL)
       │       → navigate to Today with success toast + undo
       │
       └─ [Skip]
            └─ router.back() — next evening-reflect picks it up
```

### The "adjust today" replan pipeline
1. Partition today's blocks: `frozen` (completed + in_progress) + `remaining` (upcoming).
2. Call `planRoutineAgent` with: new `primaryDomains`, `frozenBlocks` as `fixedBlocks` (the planner already respects those), goals filtered to new priorities, `inferredPreferences`.
3. Agent returns proposed blocks → diff against `remaining` → show `RoutineDiffPreview`.
4. On confirm: delete `remaining` blocks, insert proposed blocks, stash `remaining` in `replacedBlocks` (localStorage key, 24h TTL).
5. Fire telemetry + behaviour event.

### The "start tomorrow" pipeline
1. Call `generateAndSaveTomorrow` (already exists in `replanApply.ts`) with new priorities injected into the profile context.
2. If tomorrow's blocks already exist (from evening-reflect), delete and regenerate.
3. Background — don't block the UI. Toast when done.

## Impact on existing systems

| System | Impact | Action needed |
|---|---|---|
| **Stagnation detector** | Watched domains change → reset cooldowns for changed domains, so a newly-added domain isn't immediately flagged as "flat" | `resetCooldownsForDomains(changedDomains)` — clear recent insights for those domains |
| **Evening reflect** | If user chose "start tomorrow," the tomorrow blocks already exist → evening-reflect's `cloneRoutineToDate` should detect pre-existing blocks and skip cloning | Add a `hasPreGeneratedBlocks(date)` guard |
| **Expeditions** | Deprioritizing a domain doesn't abandon its expeditions | No code change — already decoupled by design |
| **Streaks** | Streak doesn't break retroactively; but removing the domain from routine means the streak naturally lapses | Surface in the impact assessment (awareness, not blocking) |
| **Goals** | Goals in a deprioritized domain aren't paused/deleted | Wire the GOAL_REBALANCE_PROMPT as an optional follow-up suggestion: *"You have 3 finance goals — want to pause any?"* (propose, never auto-pause) |
| **Profile learning** | `inferredPreferences` may reference habits from a deprioritized domain | Let it age out naturally (profileLearning.ts already uses a rolling window) |
| **Polymath score** | `constellationStats.breadth` counts distinct categories → removing a domain lowers breadth | Correct behaviour — no change needed |

## Telemetry

- `priority_change`: `{ added, removed, reordered, choice: 'now'|'tomorrow'|'skip' }`
- `priority_replan_now`: `{ blocksRemoved, blocksAdded, durationMs }`
- `priority_replan_tomorrow`: `{ pregenerated: boolean }`
- `priority_undo`: `{ withinSeconds }`
- **Quality north-star:** `replan_confirm_rate` (of users shown the diff, how many confirm vs cancel → if low, the diff is scary or the preview is broken).

## Edge cases & failure modes

| Case | Handling |
|---|---|
| AI replan fails (network/timeout) | Save succeeds (local-first); toast: "Saved — plan updates at next refresh"; evening-reflect catches it |
| User removes ALL domains | Save button disabled if selectedSet is empty (already enforced by `canSave`) |
| Replan produces worse blocks than original | The diff preview lets user cancel; undo toast for 24h if they confirm and regret |
| Very short remaining day (< 60 min) | Default to "tomorrow"; "adjust now" shows note: "Only N min remain" |
| Multiple rapid changes (< 5 min apart) | Debounce; cancel in-flight replan; undo stash points to pre-first-change baseline |
| Mid-replan the user navigates away | Background replan completes; blocks saved; toast shown via AchievementToast-style overlay |
| Priority change while offline | Save succeeds (local); replan queued; drains when online; tomorrow-regen at evening-reflect is fully offline-capable (local planner agent) |

## Rollout

### Phase A (ship first — the minimum that closes the feedback loop)
- `PriorityChangeSheet` with two options (tomorrow default + skip)
- "Start tomorrow" pre-generates via existing `generateAndSaveTomorrow`
- Impact summary (added/removed domains + streak warnings)
- Behaviour event logged
- Behind `priorityAdjust` feature flag
- **No "adjust now" yet** — tomorrow is simpler, lower-risk, covers 80% of the value

### Phase B (the powerful version)
- "Adjust today" with frozen-block constraints + RoutineDiffPreview + confirm + undo
- Wire GOAL_REBALANCE_PROMPT as a follow-up suggestion
- Stagnation-detector cooldown reset
- Debounce logic for rapid changes

### Phase C (polish)
- Expedition impact surfacing
- "Why did you change?" optional capture (feeds memory graph for identity-evolution tracking)
- Animated routine-diff preview (blocks slide in/out)
- Weekly "your priorities reshaped your week" insight in the monthly report

## Acceptance criteria

- [ ] Changing priorities in Edit Priorities triggers the PriorityChangeSheet
- [ ] "Start tomorrow" pre-generates a routine for tomorrow with the new priorities
- [ ] "Adjust today" replans only remaining blocks; completed/in-progress are untouched
- [ ] Diff preview shows what's added/removed/moved before confirming
- [ ] Undo toast appears after "adjust today"; restores original blocks within 24h
- [ ] Streak lapse warning surfaces for domains being removed that have active streaks
- [ ] AI failure doesn't block the priority save
- [ ] "Skip" saves priorities silently; evening-reflect picks them up
- [ ] Stagnation detector stops watching removed domains; starts watching added ones
- [ ] Behind `priorityAdjust` flag; off by default

## Build sequence

1. **Pure orchestrator** (`priorityChangeHandler.ts`): computePriorityDiff, assessImpact, shouldDefaultToTomorrow, buildReplanConstraints + tests
2. **PriorityChangeSheet component**: two-option sheet with impact summary
3. **Wire into edit-priorities.tsx**: replace `router.back()` with sheet presentation
4. **"Start tomorrow" integration**: call generateAndSaveTomorrow on selection + hasPreGeneratedBlocks guard in evening-reflect
5. **"Adjust today" integration** (Phase B): frozen-block planner call + RoutineDiffPreview + undo stash
6. **Goal rebalance suggestion** (Phase B): wire GOAL_REBALANCE_PROMPT
7. **Telemetry + flag**
