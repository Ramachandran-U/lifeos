# Cluster 2: Cold-start & motivation surfaces

> **Ratified amendments (founder, 2026-06-10 — cross-spec resolutions, see 00-INDEX.md):**
> R1: the firstWin preset paletteKey `primaryLight` becomes `primaryDim`.
> R5: Explore's week stat at zero — 04's rule governs (card deleted, `THIS WEEK` banned); AC-7's Explore assertion is amended accordingly; the day-1 invitation lives in Explore's EmptyState hero.
> R6: Health streaks zero state — 04's row-level zero-suppression governs on the Health tab; this spec's three-state rule survives only in the flag-off legacy tree.
> R7: the Today-header XP caption (`Your first block fills this bar.`) applies only while `today_answer_first_v1` is off.
> R8: `FirstWinCard.tsx` enters Guard D's allowlist via the founder-approved `manifesto-change` batch (approved 2026-06-10, executed in Wave 3).
> R10: FirstWinCard renders a neutral GlassCard (03 removes the `accent` prop) with the `FIRST WIN` label inked in `c.xp`.
> R12: this spec takes `lifeos_flags_v3` → `lifeos_flags_v4` at landing.

All paths, line numbers, tokens, and APIs are now verified against the repo. Producing the hardened spec.

# Cold-Start Experience — Implementation Spec (HARDENED)
**Cluster:** Rewards zeros · Profile zeros · day-1 emptiness · zero-state radar meaning
**Repo:** `c:\personal\Project X\lifeos-w3` · All paths relative to repo root.

---

## 1. Current state

What the code and screenshots actually show for a fresh account (`tmp/audit-rewards.png`, `tmp/audit-profile.png`, `tmp/audit-today.png`, `tmp/audit-explore.png`, `tmp/audit-health.png` — all eleven `tmp/audit-*.png` files exist on disk):

- **Rewards** (`app/(tabs)/rewards.tsx`): hero renders LevelRing (`size={160}`, line 176) + "LEVEL 1 / Getting Started / Your story starts now." (the `proudLine` fallback, line 118) — the one good moment. Directly under it, the `StatBox` trio (lines 187–191) renders **"+0" / "1/19" / "0🔥"** on day 1, and the hero micro line reads **"0 / 300 XP to Level 2"** (line 184–186; `xpForLevel(2) = 300`, `src/utils/gamification.ts` line 188). Below: a flat `[0,0]` 7-day XP sparkline (line 97 pads an empty series to two zeros), the LEVEL LADDER / ProgressPath (lines 248–267), a 6-cell LIFE BALANCE grid at the install floor of 15 (lines 272–293; floor enforced by `Math.max(15, …)` in `src/store/useGameStore.ts` lines 203–210), a 19-tile badge grid with ≤1 earned (lines 312–319), five `StreakRow`s each reading "Best: 0 Now: 0 / 30 days to 30-day badge" (`src/components/gamification/StreakRow.tsx` lines 43–63), and `FreezeBank` opening with **"No streak shields banked"** (`src/components/gamification/FreezeBank.tsx` line 29). The screen is a ledger of things the user hasn't done, twelve hours into the relationship.
- **Profile** (`app/(tabs)/profile.tsx`, USAGE card lines 262–340): the stats row (lines 292–307) renders **"0 min / 0 / 0"** in `fontSizes.xxl` display type (`statValue`, lines 628–629), plus a Today/This-week segmented control (lines 266–289) toggling between two empty datasets, plus the caption "No activity tracked yet — open a tab to get started." (lines 322–324) in `c.textMuted` (the token the audit flagged as failing AA at caption sizes).
- **Today** (`app/(tabs)/index.tsx`): the HexRadar hero (lines 524–545 — placement is locked by founder decision; `size={340}`, line 531) renders a small hexagon at the `loadFromDB` floor of 15 with **no explanation of what the shape is or why it is small**. The header XP row (lines 581–597, `gamification === 'full'` branch) renders two nodes: micro **"L1 → L2"** (lines 586–588) and caption **"0/300 XP"** (lines 589–591).
- **Explore** (`app/(tabs)/explore.tsx` lines 598–604): a `Card` reading **"THIS WEEK / 0 min / across 0 interests"** (Label line 600, Heading line 601, Caption line 602).
- **Health** (`app/(tabs)/health.tsx` lines 398–416): a STREAKS card with two zeros in `fontSizes.xxl` display type (`streakCount` style, line 691) — "0 Workout / 0 Food log".
- **First-block plumbing that already exists and must be reused:** `app/(tabs)/index.tsx` lines 295–309 stamp `profile.firstBlockCompletedAt` exactly once and fire `EVENTS.firstBlockCompleted` (`src/utils/telemetry.ts` line 36). **This guard runs only when `onboarding_v2` is on** (line 295) — `onboarding_v2` is default-on in `FALLBACK_FLAGS` (`src/store/useFlagStore.ts` line 20). A block completion is worth 10 XP (`XP_VALUES.completeBlock`, `src/utils/gamification.ts` line 157), which `src/celebration/classify.ts` classifies as **micro** (threshold `XP_STANDARD_THRESHOLD = 25`, line 13) — meaning the first action a user ever completes in LifeOS produces a chip and nothing else, while `dayComplete` and `levelUp` get epic confetti. The biggest identity moment in the funnel currently has the smallest celebration in the system. The `dayComplete` flag-fallback pattern to mirror is `app/(tabs)/index.tsx` lines 429–433 (`isFlagEnabled('celebrationEngine') ? celebrate({ kind: 'dayComplete' }) : setShowConfetti(true)`).
- **Mechanics available behind flags** (`src/store/useFlagStore.ts` FALLBACK_FLAGS): `quests_v2` (line 65, default **false**; 3–5 procedural daily quests, `src/gamification/questEngine.ts` line 115: `count = 3 + Math.floor(rng() * 3)`), `celebrationEngine` (compile flag, `src/config/flags.ts` line 37, default false), `streak_protection_v1`, `variable_rewards_v1`, `progress_map_v1`.

---

## 2. Options considered

**A — Hide every zero.** Pure show-when-nonzero: any zero stat collapses, screens shrink on day 1. Honest and cheap, but it leaves Rewards as a near-empty screen with no forward motion — it removes the insult without adding the invitation, and day-1 Rewards becomes a dead tab users never return to.

**B — Reframe every zero as potential.** Keep all slots, swap zeros for aspirational copy ("19 badges waiting", "your streak begins today") in place. Keeps screen structure stable, but it preserves the "card sludge" the placement audit condemned, multiplies starter copy into noise (five streak rows each begging), and still opens the screen on a wall of not-yet.

**C — One first win, then the ledger earns its way in.** Day 1, the Rewards screen has exactly one job: get the user their first completed block. The stat row, sparkline, journey, balance grid, badge grid and streak list do not render until the first XP exists; their space is given to the expanded "Getting Started" hero, a single full-width First Win card, and the three day-1 quests (actions, not stats). Every other zero-surface in the app follows one written rule, and the first-ever block completion is promoted to an epic celebration. This is the only option consistent with the manifesto — "Answer first" (the screen answers "what do I do?"), "One hero per screen", "Celebrate moments, rest quiet".

**Committed: Option C.**

---

## 3. The spec

### 3.0 Flag

Add one runtime flag to `FALLBACK_FLAGS` in `src/store/useFlagStore.ts`:

```ts
// Cold-start program: zero-state replacement + first-win arc. Default ON —
// this fixes a broken first-run, it is not a retention experiment. The
// Worker /v1/config row is the kill switch.
cold_start_v1: true,
```

Bump the persist key `lifeos_flags_v3` → `lifeos_flags_v4` (line 138; the file's own comment at lines 132–137 mandates a bump when a fallback default lands as `true`). Every surface reads the flag with the exact expression `useFlagStore((s) => s.isEnabled('cold_start_v1'))` — no screen invents its own resolution path.

Every behavior in this spec is gated on `cold_start_v1`. Additional gates, exhaustively: the day-1 quest clamp (§3.3) requires `quests_v2`; the epic first-win particle layer requires `celebrationEngine` and falls back to the legacy `Confetti` exactly as `dayComplete` does (`app/(tabs)/index.tsx` lines 429–433); the first-win beat fires inside the existing `onboarding_v2` stamp guard (§3.3) — **with `onboarding_v2` off, the firstWin beat does not fire; this is a decision, not an accident** (`onboarding_v2` is default-on, Worker-killable, and the legacy funnel keeps the legacy behavior).

**Rollout:** ships default-on in the fallback. Worker cohort row `cold_start_v1=false` is the revert path. No staged percentage — the change only affects accounts with `totalXP === 0` plus per-stat starter strings, so blast radius is new installs by construction.

### 3.1 The zero-state rule (app-wide, one sentence)

> **A zero is never data: until a stat has been nonzero at least once, its slot renders the action that creates its first value — and when several zero-slots on one screen share the same first action, only the topmost renders and the rest collapse.**

Corollaries, all binding:
- Starter strings render in `c.textSecondary` (never `c.textMuted` — audit verdict 1, AA failure). Exactly two exceptions, both named here: the Rewards hero `proudLine` (promoted to `c.textPrimary`, §3.2) and the FirstWinCard h2 (component default `textPrimary`).
- A stat that has been nonzero and later returns to zero (e.g. weekly XP on a Monday) renders the number — that zero is earned data, not an empty account.
- **Single source of truth for copy:** every string introduced by this spec lives in one new file, `src/constants/starterCopy.ts`, as the exported `STARTER_COPY` object. Components import from it; no starter string is ever written inline in a component. The strings below are final — changing one is a spec change, not an implementation detail.
- **Single rendering component:** every single-line starter string renders through one new component, `src/components/shared/StarterLine.tsx` — built on `@/components/ui/Text`, props `{ children: string; variant?: 'body' | 'caption' | 'micro' }` (default `'body'`), color hard-bound to `c.textSecondary` inside the component with no color prop exposed. This makes trap #2 (demotion to `textMuted`) structurally impossible.
- **Compassion copy rules (binding, machine-checked):** no `STARTER_COPY` value contains the substrings `yet`, `still`, `only`, `haven't`, `don't`, or begins with `No `; none contains a standalone `0`; none begins with a digit. The co-located test `src/constants/__tests__/starterCopy.test.ts` asserts all four, plus that every value is ≤ 120 characters.

**Zero-surface table (complete coverage):**

| Screen | Current zero | Replacement under `cold_start_v1` |
|---|---|---|
| Rewards stat row | `+0` / `1/19` / `0🔥` | Row absent while `totalXP === 0`; `FirstWinCard` in its place (§3.2). From first XP: row renders; BEST STREAK slot at `bestStreak === 0` renders the string `starts today` via a new `starter` prop on `StatBox` (§3.5); at `bestStreak ≥ 1` renders `{n} days` (the `🔥` leaves the data slot permanently) |
| Rewards 7-DAY XP card | flat `[0,0]` sparkline | Card absent until `totalXP > 0` (collapses under the rule — FirstWinCard owns the shared action) |
| Rewards journey / LIFE BALANCE / badges grid | ladder at L1, six floor-score cells, 18 locked tiles | All absent until `totalXP > 0` |
| Rewards "THIS WEEK you…" recap | renders on zero-XP accounts off domain-delta noise (visible in `tmp/audit-rewards.png`) | Absent until `totalXP > 0` |
| Rewards STREAKS rows | five rows of `Best: 0 Now: 0` | Section absent until `totalXP > 0`; after that, each `count === 0 && best === 0` row renders the one-line starter variant (§3.5) |
| Rewards FreezeBank | "No streak shields banked" | `Your first shield is forming.` + progress sub-line in `c.textSecondary` (§3.5) |
| Profile USAGE card | `0 min / 0 / 0` + dead segmented control + muted caption | Stats row and segmented control absent while all three are zero; one `StarterLine` in their place (§3.4). Once any stat is nonzero: row renders, still-never-nonzero slots render `—` (em-dash, U+2014) |
| Profile "No activity tracked yet — open a tab to get started." | guilt-adjacent nudge in `textMuted` | Deleted (subsumed by the starter line). The TOP MODULES sub-block (lines 327–339) is already nonzero-gated — untouched |
| Explore THIS WEEK card | `0 min / across 0 interests` | Label `THIS WEEK` kept; Heading + Caption replaced by one `StarterLine` (§3.6) |
| Health STREAKS card | `0 Workout / 0 Food log` in xxl type | Both-zero state renders one `StarterLine` under the STREAKS label (§3.6); numbers return per-streak at first nonzero, per the exhaustive three-state rule in §3.6 |
| Today header XP caption | caption `0/300 XP` (lines 589–591, `gamification === 'full'` branch only) | At `totalXP === 0`: that caption node renders `Your first block fills this bar.` via `StarterLine variant="caption"`; the micro `L1 → L2` node and the XpBar stay (the bar is an affordance, not a stat). The `'minimal'` branch (bare XpBar) and `'off'` branch (nothing) are untouched |
| Today hex radar | unexplained floor-15 hexagon | `RadarMeaningCaption` under the radar while all six scores equal the floor (§3.7). **Radar position untouched.** |

### 3.2 Rewards day-1 — `FirstWinCard` + minimal mode

**File to modify:** `app/(tabs)/rewards.tsx`. **File to create:** `src/components/gamification/FirstWinCard.tsx`.

Define `const coldStart = useFlagStore((s) => s.isEnabled('cold_start_v1'));` and `const isColdStart = coldStart && totalXP === 0;`.

**While `isColdStart`, the scroll renders exactly three top-level sections, in this order, and nothing else** (each carries a testID for AC-2: `rewards-hero`, `first-win-card`, `rewards-quests-section`):

1. **Hero (expanded), testID `rewards-hero`.** LevelRing stays at `size={160}`. `LEVEL 1` caption stays. `levelTitle(1)` → "Getting Started" stays as `h2`. The `proudLine` "Your story starts now." is promoted from `variant="caption" muted` to `variant="bodyLg"` with `color={c.textPrimary}` (the `@/components/ui/Text` component takes both props — verified). The `0 / 300 XP to Level 2` micro line (lines 184–186) is replaced by `variant="micro"` color `c.textSecondary`: **`Your first block is worth your first 10 XP.`** (matches `XP_VALUES.completeBlock = 10`). The XpBar stays at `pct=0` (affordance). The StatBox row does not mount.
2. **`FirstWinCard`** (testID `first-win-card`):
   - `GlassCard accent={c.xp}` — GlassCard's own `radii.card` radius (= 22, `src/theme/radii.ts` line 7) is **not overridden**; the only style is `card: { padding: spacing.lg }` from the component's `StyleSheet.create` map.
   - Line 1: `SectionLabel color={c.xp}` → **`FIRST WIN`**
   - Line 2: `AuroraText variant="h2"` → **`Complete one block on Today.`**
   - Line 3: `AuroraText variant="body" color={c.textSecondary}`, string from `STARTER_COPY` keyed by gamification pref (`usePreferencesStore((s) => s.gamification)`):
     - `full` / `minimal`: **`That's the whole job for day one. Your XP, badges and streaks all start from that single tap.`**
     - `off`: **`That's the whole job for day one. Tomorrow's plan builds on it.`**
   - Line 4: `Button` full-width, title **`Go to Today`**, `onPress: () => router.push('/(tabs)')`, testID `first-win-cta`. (Button already implements `minHeight: 56` internally, `src/components/ui/Button.tsx` line 105 — no restyle.)
   - Entry motion: `Animated.View entering={FadeInDown.duration(MOTION_BUDGET.hero)}` (520ms, `src/theme/motion.ts` line 23) — the same unconditional entering pattern every card in the app uses (e.g. `app/(tabs)/explore.tsx` line 584). **No idle animation, ever**: `FirstWinCard.tsx` contains zero occurrences of `withRepeat` — asserted by AC-8's companion test.
3. **DAILY QUESTS, testID `rewards-quests-section`.** With `quests_v2` on: the existing v2 section (rewards.tsx lines 343–361), rendered directly beneath the card. With `quests_v2` off: the legacy DAILY QUESTS trio (lines 364–369) renders here, **and the legacy WEEKLY QUEST section (lines 370–375) does not mount while `isColdStart`** — the three-section contract wins. Day-1 only; the steady-state section order is untouched once `totalXP > 0`.

**Exit from minimal mode:** `totalXP` is a Zustand-subscribed selector (line 48), so the first `completeBlock` write re-renders the screen on the same render pass — minimal mode exits immediately, with no screen-level exit/enter animation added (sections appear plainly; the celebration is the FirstWin beat on Today, not a layout transition here).

**Real-stat thresholds (binding):** stat row, sparkline card, journey, balance grid, badge grid, streak section, week-recap card all become eligible at `totalXP ≥ 1` and never disappear again. BEST STREAK numeral at `bestStreak ≥ 1`. Per-streak row numerals at that streak's `count ≥ 1 || best ≥ 1`.

### 3.3 The first 10 minutes — arc and firing order

| t | Surface | What happens | Mechanic / flag |
|---|---|---|---|
| 0:00 | `(auth)` sign-up → `(onboarding)/day1-vision → day1-career → day1-routine` (all three files exist) | Unchanged. Produces the first day plan. | existing `onboarding_v2` |
| ~4:00 | Today (`app/(tabs)/index.tsx`) | Radar hero in its locked position, now with `RadarMeaningCaption` beneath it (§3.7). Header XP caption reads `Your first block fills this bar.` First plan blocks listed below. | `cold_start_v1` |
| ~4:01 | Quest seed | `useDailyQuests`'s `ensureToday` (called at `src/hooks/useDailyQuests.ts` line 89) inserts **exactly 3** quests (not 3–5). Mechanics, all pinned: (a) add `isFirstDay?: boolean` to `QuestSelectionCtx` (`src/gamification/questEngine.ts` line 79); (b) `buildCtx` (`useDailyQuests.ts` line 36) sets it `true` when yesterday's `getRoutineBlocksByDate` returns zero blocks AND `useGameStore.getState().totalXP === 0`; (c) in `selectDailyQuests` (line 115): `const count = ctx.isFirstDay ? 3 : 3 + Math.floor(rng() * 3);` and when `isFirstDay`, slot 1 is **constructed directly** — bypassing `targetFor`, because target 1 sits below `t_blocks_small`'s `[2,5]` range, which stays untouched for normal days — as `{ templateId: 't_blocks_small', title: STARTER_COPY (33 chars, ≤48 QuestCard limit): 'Complete your first routine block', module: 'goal', metricKey: 'blocks_completed', target: 1, xp: xpFor(template, 1) /* = 10 */ }`, with `t_blocks_small` and `blocks_completed` added to `usedTemplates`/`usedMetrics` so the remaining 2 procedural picks never double-tick the same metric; (d) the pinned quest is inserted with `source: 'pinned'` — widen the union at `src/db/queries/quests.ts` line 27 to `'template' | 'ai' | 'pinned'` — so the AI personalization pass's existing filter `q.source === 'template'` (`useDailyQuests.ts` line 94) already excludes it with zero new filter code, and `clampDraftToTemplate` never sees it. | `quests_v2` + `cold_start_v1` |
| ~6:00 | **First-ever block completion** (the FIRST celebration) | Inside the existing once-guard at `app/(tabs)/index.tsx` lines 295–309 (the `firstBlockCompletedAt` stamp; runs under `onboarding_v2`, default-on), after `upsertUserProfile` succeeds: fire the first-win beat. Sequence on one tap: (a) existing success haptic; (b) existing XP chip beat (`enqueueXPReward`, line 328; RewardOrchestrator choreography `rewardRise 380 / rewardHold 1100 / rewardExit 300`); (c) gated on `usePreferencesStore.getState().gamification !== 'off'`: `isFlagEnabled('celebrationEngine') ? celebrate({ kind: 'firstWin' }) : setShowConfetti(true)` — the exact `dayComplete` pattern at lines 429–433. When gamification pref is `'off'`, neither branch runs; the haptic and chip path behave as they do today. Fires exactly once per account, enforced by the stamp guard. | `cold_start_v1` + `onboarding_v2` (+ `celebrationEngine` for the Skia path) |
| ~6:05 | Quest #1 auto-ticks (`blocks_completed` metric) | Badge on Rewards tab; user claims → **exactly +10 XP** (`xpFor(t_blocks_small, 1)` = 10) → by the classifier thresholds (10 < `XP_STANDARD_THRESHOLD` 25) this is a **micro** beat: the chip is the whole celebration. This hierarchy is deliberate and final — the cannon belongs to the first block, the quiet chip to the claim; nothing about day 1 raises the claim's tier. | `quests_v2` |
| ~7:00 | Rewards tab | `totalXP` is exactly 10 after the block, exactly 20 after the quest claim: minimal mode has exited, the stat row, sparkline and journey render with real first numbers. The screen visibly *grew because of the user's action* — that is the cold-start payoff. | `cold_start_v1` |
| Day 1 evening | Evening Reflect | Unchanged: `dayComplete` epic fall if all blocks complete. Streak shields: no day-1 firing; FreezeBank shows its starter copy (§3.5). | existing |

**Celebration engine changes** (4 files, all unit-testable platform-free):
- `src/celebration/types.ts`: add `'firstWin'` to the `CelebrationKind` union (lines 22–28).
- `src/celebration/classify.ts`: `case 'firstWin': return 'epic';` — alongside the `levelUp`/`dayComplete`/`milestone` cases (lines 29–32), with the comment *"the first thing a user ever completes is an identity beat by definition."*
- `src/celebration/presets.ts`: `KIND_PRESETS.firstWin = { epic: { ...EPIC_CANNON, paletteKeys: ['xp', 'primaryLight', 'streak'] } }` (EPIC_CANNON defined at lines 35–40; duration stays `MOTION_BUDGET.celebrationFall`, 2000ms, motion.ts line 39).
- `src/celebration/useCelebrationStore.ts`, `sfxFor` (lines 59–65): the epic branch becomes exactly `return input.kind === 'levelUp' || input.kind === 'milestone' || input.kind === 'firstWin' ? 'fanfare' : 'sweep';`.
- Reduce-motion / `motionIntensity: 'off'`: the CelebrationHost renderer path degrades through the existing contract (Skia → Reanimated fallback; `useMotionScale()` returns 0 under OS reduce-motion or pref `'off'`, motion.ts lines 148–153, collapsing timing configs to duration 0). AC-5 makes this a checked assertion, not an assumption.

### 3.4 Profile day-1 — committed: show-when-nonzero with one starter line

**File to modify:** `app/(tabs)/profile.tsx` (USAGE card, lines 262–340).

`const usageEmpty = (stats?.totalMinutes ?? 0) === 0 && totalXP === 0 && longestStreak === 0;`

While `usageEmpty && cold_start_v1`: the USAGE label stays; the segmented Today/This-week control (lines 266–289) does **not** mount; the three-stat row (lines 292–307) does **not** mount; the sparkline/else-caption block (lines 309–325) does **not** mount. In their place, one `StarterLine` (default `body` variant, hard-bound `c.textSecondary`):

> **`Your stats begin with your first completed block on Today.`**

No CTA button here — Profile is a settings surface, not the funnel; the rule's collapse-corollary applies because Rewards and Today already carry the action.

Once any of the three stats is nonzero: the row and segmented control render; any individual stat that has still never been nonzero renders **`—`** (single em-dash, U+2014, in the existing `statValue` style with `color: c.textSecondary`) instead of `0`. The "No activity tracked yet — open a tab to get started." caption (lines 322–324) is deleted permanently — in both branches, not moved. The TOP MODULES sub-block is already gated on `topModules.length > 0` and is untouched.

### 3.5 Rewards starter variants (post-day-1 zeros)

- **`StreakRow`** (`src/components/gamification/StreakRow.tsx`): add a zero branch — when `count === 0 && best === 0`, render the **existing `styles.card` shell unchanged** (same border, same left-border streak color, same padding — no new style values) containing only the emoji + label row and one `StarterLine variant="caption"`; no flame, no bars, no `Best/Now`, no badge countdown. Strings (all in `STARTER_COPY`):
  - workout → **`Starts with your first workout.`**
  - learning → **`Starts with your first learning session.`**
  - foodTracking → **`Starts with your first logged meal.`**
  - journaling → **`Starts with your first evening reflection.`**
  - social → **`Starts with your first reach-out.`**
- **`FreezeBank`** (`src/components/gamification/FreezeBank.tsx`): the `freezes === 0` title (line 29) becomes **`Your first shield is forming.`**; the sub-line becomes **`{FREEZE_EARN_XP − progressXP} XP to go. Shields auto-cover a missed day, so a streak bends instead of breaking.`** In the `freezes === 0` branch the sub-line color changes from `c.textMuted` to `c.textSecondary`; the nonzero and bank-full branches keep their current styles and strings. The `⬡` placeholder glyph row and progress track stay (they read as forward motion, not deficit). The "No streak shields banked" string is deleted.
- **`StatBox`** (`app/(tabs)/rewards.tsx` lines 408–416): gains an optional `starter?: boolean` prop. When true, the value renders `variant="caption"` `color={c.textSecondary}` instead of `variant="h3" numeric color={color}`. BEST STREAK passes `starter` at `bestStreak === 0` with value **`starts today`**; at `bestStreak ≥ 1` it renders **`{n} days`** (the `🔥` leaves the data slot for good — audit verdict 3, emoji-in-data).

### 3.6 Explore + Health zero surfaces

- **Explore tab** (`app/(tabs)/explore.tsx` lines 599–603): when `totalMinutesWeek === 0`, keep `Label THIS WEEK` (line 600) and replace the Heading + Caption (lines 601–602) with one `StarterLine`:
  > **`Minutes you spend chasing curiosity add up here. Save a spark to start counting.`**
  At `totalMinutesWeek ≥ 1` the numeric card returns unchanged.
- **Health** (`app/(tabs)/health.tsx` lines 398–416): three exhaustive states, no fourth:
  1. `workout.count === 0 && workout.best === 0 && foodTracking.count === 0 && foodTracking.best === 0` → keep the `STREAKS` SectionLabel; replace the two-number row with one `StarterLine`: **`Streaks start with your first workout or logged meal.`**
  2. Exactly one of the two streaks has `count ≥ 1 || best ≥ 1` → render **both** columns: the nonzero column shows its number in the existing `streakCount` style; the zero column renders its starter fragment — **`first workout`** / **`first logged meal`** (both in `STARTER_COPY`) — via `StarterLine variant="caption"` in place of the number, with its existing emoji+label caption beneath.
  3. Both nonzero → the shipped two-number layout, unchanged.

### 3.7 Zero-state radar meaning (Today — placement locked)

**File to create:** `src/components/shared/RadarMeaningCaption.tsx`. **Files to modify:** `app/(tabs)/index.tsx`, `src/store/useGameStore.ts`.

- Mount it inside the existing hero `Animated.View` (lines 524–527), immediately after `<HexRadar … />` (line 544), so the radar itself does not move one pixel. That Animated.View additionally gains `testID="today-hero-radar"` (for AC-7's position assertion). The `heroWrap` style (lines 1131–1137) already centers children via `alignItems: 'center'` — no layout style is added to the wrapper.
- **Floor constant:** export `export const DOMAIN_SCORE_FLOOR = 15;` from `src/store/useGameStore.ts` and replace the raw `15`s at lines 164 and 203–210 with it. No new magic number enters this spec.
- Visibility condition, exact and complete: `Object.values(radarScores).every((v) => v === DOMAIN_SCORE_FLOOR)`. Recomputed every render; the moment any domain diverges the caption unmounts, and because `loadFromDB` clamps every score to `Math.max(DOMAIN_SCORE_FLOOR, …)`, scores can never return to the all-floor state — so the caption never returns, by construction rather than by stored state. Any additional mount condition is a spec violation reviewable by diff.
- Render: `AuroraText variant="caption"`, color `c.textSecondary`, `textAlign: 'center'`, `marginTop: spacing.sm`, and a required `maxWidth` prop — the Today mount passes the same `340` the `HexRadar size={340}` mount uses (component-geometry props follow the existing `size={160}`/`size={340}` convention; no new literal). Entry shares the hero's existing `FadeIn.delay(280).duration(600)` by living inside the same Animated.View — no separate animation, no idle animation.
- Copy (in `STARTER_COPY`):
  > **`Your life in six directions. It starts small on purpose — every block you finish pulls the shape outward.`**
- Web parity: plain `Text` over react-native-web; no Svg, no measurement. Identical on iOS, Android, and web.

### 3.8 Web + native parity statement

Every component in this spec is RN primitives (`View`/`Text`/`Pressable`) + existing design-system components (`GlassCard`, `SectionLabel`, `Text`, `Button`), all already running on react-native-web — behavior and copy are identical on iOS, Android, and web. The celebration path's web behavior is the existing CelebrationHost contract (Skia when loaded, Reanimated fallback — `src/celebration/types.ts` lines 60–79); the legacy `Confetti` fallback is already web-proven on `dayComplete`. State reads (`totalXP`, `streaks`, `stats`) come from Zustand + the synchronous localStorage shim on web — no async divergence.

The Playwright surface is the verification target. A new `e2e/cold-start.spec.ts`: belongs to the **`chromium`** project (it seeds its own localStorage via `seedAuthedUser` from `e2e/helpers.ts` and needs no Supabase session — the exact pattern of `e2e/routine-completion-modules.spec.ts`); sets its viewport explicitly with `test.use({ viewport: { width: 390, height: 844 } })` at the top of the file (the chromium project's Desktop Chrome default is not 390×844 — `playwright.config.ts` line 77 — so the file pins it); covers AC-1–7 and AC-12.

---

## 4. Dilution traps

1. **The stat row ships next to the FirstWinCard "for context".** Counter-rule: the two are mutually exclusive on a single `isColdStart` boolean; AC-1 fails any build where a `+0` string and the `first-win-card` testID coexist.
2. **Starter strings get demoted to `c.textMuted` "to keep them quiet".** Counter-rule: starter strings render only through `StarterLine`, whose color is hard-bound with no color prop; AC-8's unit test asserts the rendered style and that the file contains no `textMuted` reference.
3. **Day-1 minimal mode silently grows sections back** ("the badge grid is harmless", "the journey looks nice empty"). Counter-rule: AC-2 counts top-level sections by testID — exactly three while `totalXP === 0`, including the legacy WEEKLY QUEST suppression (§3.2 item 3).
4. **`firstWin` gets downgraded to `standard` "so it doesn't feel excessive".** Counter-rule: the classifier is the single choke point and gets a unit test asserting `classifyTier({ kind: 'firstWin' }) === 'epic'` (AC-4); the manifesto principle is *Celebrate Loud* — the founder already signed it.
5. **The day-1 quest clamp becomes "3–5 is fine on day 1 too" because threading `isFirstDay` is fiddly.** Counter-rule: deterministic seed test in `src/gamification/__tests__` asserting `selectDailyQuests({ …, isFirstDay: true }, seed)` returns length 3 with slot 1 = `t_blocks_small`, target 1, xp 10 (AC-3).
6. **The Profile em-dash regresses to `0` in a later `formatDuration` refactor.** Counter-rule: AC-6's literal string assertions live in `e2e/cold-start.spec.ts`, which runs on every PR via the chromium project.
7. **`RadarMeaningCaption` gets an extra mount condition** (e.g. "only during onboarding") and most fresh users never see it. Counter-rule: the visibility condition is exactly "all six scores equal `DOMAIN_SCORE_FLOOR`" — any added clause is a spec violation reviewable by diff; AC-12 asserts both sides.
8. **Copy drift** — a starter string gets "improved" inline during implementation or a later PR. Counter-rule: strings exist only in `src/constants/starterCopy.ts`; AC-8 greps the repo and fails if any `STARTER_COPY` value appears as a literal anywhere else; the compassion-rule test fails any guilt-framed rewrite.
9. **The `onboarding_v2` dependency gets "discovered" mid-build and the firstWin beat moves outside the stamp guard, losing once-per-account.** Counter-rule: §3.3 names the guard as the once-enforcer; AC-4's second-block assertion fails any relocation that loses the stamp check.
10. **One zero-surface ships ungated** (e.g. Health's starter line renders even with `cold_start_v1=false`). Counter-rule: AC-9 runs the full surface sweep with the flag off and requires the existing snapshots/suites to pass byte-identical.

---

## 5. Acceptance criteria (binary)

1. Fresh account (`totalXP === 0`), Rewards, `e2e/cold-start.spec.ts` (chromium, 390×844): the strings `+0`, `0🔥`, `Best: 0`, `0 / 300 XP`, and `No streak shields banked` appear nowhere in the DOM; testID `first-win-card` is present; testID `first-win-cta`'s `boundingBox()` satisfies `y + height ≤ 844` without any scroll action.
2. Same state: the Rewards scroll contains exactly the three top-level testIDs `rewards-hero`, `first-win-card`, `rewards-quests-section`, and zero of: `rewards-xp-sparkline`, the LIFE BALANCE SectionLabel text, the BADGES SectionLabel text, the STREAKS SectionLabel text, the WEEKLY QUEST SectionLabel text.
3. Unit (`src/gamification/__tests__`): `selectDailyQuests({ primaryDomains: [], liveStreakKeys: [], isFirstDay: true }, 'u1:2026-06-10')` returns exactly 3 drafts; draft[0] equals `{ templateId: 't_blocks_small', target: 1, xp: 10, title: 'Complete your first routine block', metricKey: 'blocks_completed', module: 'goal' }`; no other draft has `metricKey === 'blocks_completed'`; with `isFirstDay: false` and the same seed the result is byte-identical to the pre-change output.
4. Unit: `classifyTier({ kind: 'firstWin' }) === 'epic'`; `resolvePreset({ kind: 'firstWin', tier: 'epic' }).renderer === 'confettiCannon'`; `sfxFor`-via-store plays `fanfare` for firstWin. Integration: completing the first-ever routine block with `celebrationEngine=true` enqueues exactly one celebration event of kind `firstWin`; completing a second block enqueues zero `firstWin` events (stamp guard).
5. e2e with `contextOptions: { reducedMotion: 'reduce' }`: in the 2,500ms after the first block completion, zero new `<canvas>` elements attach to the DOM and the block's `routine-block-<id>-completed` testID is visible. e2e with seeded gamification pref `'off'`: same zero-canvas assertion, no legacy-Confetti node, and `FirstWinCard` renders the exact body string `That's the whole job for day one. Tomorrow's plan builds on it.`
6. Fresh account, Profile: the strings `0 min` and `No activity tracked yet` appear nowhere; the string `Your stats begin with your first completed block on Today.` appears exactly once; the Today/This-week segmented control is absent. After one completed block (totalXP 10, totalMinutes 0): the stats row renders, the active-minutes slot shows the literal `—` (U+2014) and not `0 min`.
7. Fresh account: Explore tab contains `Save a spark to start counting.` and not `0 min`; Health STREAKS card contains `Streaks start with your first workout or logged meal.` and no `0` numeral inside the card; Today header contains `Your first block fills this bar.` and not `0/300 XP`; Today shows the radar caption (string prefix `Your life in six directions`) while all six scores equal `DOMAIN_SCORE_FLOOR`; the `boundingBox().y` of testID `today-hero-radar` differs by ≤1px from `RADAR_Y_BASELINE`, a constant in `cold-start.spec.ts` measured once on the pre-change build with the same seed and viewport and committed with the test.
8. Unit, `src/constants/__tests__/starterCopy.test.ts` + `src/components/shared/__tests__/StarterLine.test.tsx`: every `STARTER_COPY` value passes the compassion rules in §3.1 (no `yet`/`still`/`only`/`haven't`/`don't`/leading `No `/standalone `0`/leading digit, ≤120 chars); `StarterLine`'s rendered style resolves to the theme's `textSecondary` value and its source contains no `textMuted` token; `FirstWinCard.tsx` contains zero occurrences of `withRepeat`; a repo grep finds each `STARTER_COPY` string literal in exactly one file (`starterCopy.ts`).
9. `cold_start_v1=false` (Worker kill switch): Rewards, Profile, Explore tab, Health and Today render the current shipped layout — the `chromium`, `authenticated`, and `visual` (local, committed baselines unmodified) suites pass with zero snapshot updates.
10. AC-1, 2, 5, 6, 7, 12 all live in `e2e/cold-start.spec.ts`, chromium project, `test.use({ viewport: { width: 390, height: 844 } })`, and pass against the web build.
11. Unit: `useFlagStore.persist.getOptions().name === 'lifeos_flags_v4'`, and `FALLBACK_FLAGS.cold_start_v1 === true`.
12. e2e: seeded `domainScores` of all-15 → radar caption visible; seeded `goals: 16` with the other five at 15 → radar caption absent from the DOM.

---

## 6. Effort estimates

| Piece | Files | Size |
|---|---|---|
| F0 — `STARTER_COPY` constants + `StarterLine` + compassion-rule tests | `src/constants/starterCopy.ts` (new), `src/components/shared/StarterLine.tsx` (new), co-located `__tests__` | **S** |
| F1 — `FirstWinCard` + Rewards day-1 minimal mode + stat-row thresholds + section testIDs | `src/components/gamification/FirstWinCard.tsx` (new), `app/(tabs)/rewards.tsx` | **M** |
| F2 — `firstWin` celebration kind + Today wiring + gamification-off/reduce-motion gates | `src/celebration/{types,classify,presets,useCelebrationStore}.ts`, `app/(tabs)/index.tsx` | **S** |
| F3 — Day-1 quest clamp + pinned first quest (`source: 'pinned'`) + AI-pass exclusion | `src/gamification/questEngine.ts`, `src/hooks/useDailyQuests.ts`, `src/db/queries/quests.ts` | **S** |
| F4 — Profile starter line + em-dash rule + control gating | `app/(tabs)/profile.tsx` | **S** |
| F5 — `StreakRow` / `FreezeBank` / `StatBox starter` variants | `src/components/gamification/StreakRow.tsx`, `FreezeBank.tsx`, `app/(tabs)/rewards.tsx` | **S** |
| F6 — Explore-tab / Health / Today-XP string swaps + `RadarMeaningCaption` + `DOMAIN_SCORE_FLOOR` export + `today-hero-radar` testID | `app/(tabs)/explore.tsx`, `app/(tabs)/health.tsx`, `app/(tabs)/index.tsx`, `src/components/shared/RadarMeaningCaption.tsx` (new), `src/store/useGameStore.ts` | **S–M** |
| F7 — `cold_start_v1` flag + persist-key bump to `lifeos_flags_v4` | `src/store/useFlagStore.ts` | **S** |
| F8 — Unit tests (classify, presets, questEngine, flag-store key) + `e2e/cold-start.spec.ts` incl. `RADAR_Y_BASELINE` capture | `src/**/__tests__`, `e2e/cold-start.spec.ts` (new) | **M** |

Total: one focused week for one engineer. Order: F0 → F7 → F1 → F2 → F3 (the arc is testable end-to-end once F3 lands); F4–F6 parallelizable after F0.

---

## Dilution audit log

1. **§1 wrong stat quoted** — "L1 → L2 · 0/100 XP" was false (`xpForLevel(2) = 300`); corrected to the two actual text nodes, micro `L1 → L2` + caption `0/300 XP`, with line numbers — and added `0 / 300 XP` to AC-1/AC-7's banned-string lists so the real string is hunted.
2. **§1 wrong line ranges** — first-block stamp corrected 296–309 → 295–309; `dayComplete` fallback corrected 424–432 → 429–433; Profile card pinned to 262–340; Explore to 598–604; Health to 398–416; all re-verified on disk.
3. **Hidden flag dependency** — the stamp guard only runs under `onboarding_v2`; the original spec never said so. Surfaced in §1/§3.0/§3.3, decided (firstWin intentionally rides the guard; onboarding_v2 is default-on), and protected by trap #9.
4. **Token error** — "`borderRadius: radii.card` (20)" was wrong (`radii.card = 22`); fixed by not overriding GlassCard's own radius at all and citing the real token value.
5. **Tokens-only violation** — `maxWidth: 280` was a bare magic number; replaced with a required `maxWidth` prop fed by the radar's own `340` size constant (existing geometry-prop convention, no new literal).
6. **Magic floor number** — "equals the install floor (15)" now backed by a new exported `DOMAIN_SCORE_FLOOR = 15` in `useGameStore.ts`, replacing the raw 15s it already verified.
7. **Wrong style reference** — "`radarWrap` at line 1130 centers children" pointed at an unused style; the radar mounts in `heroWrap` (lines 1131–1137); fixed.
8. **Impossible quest mechanics** — "target clamped to 1" conflicts with `t_blocks_small`'s `[2,5]` range; replaced with direct draft construction bypassing `targetFor`, leaving the template untouched for normal days.
9. **Vague AI-pass skip** — "filter it from drafts" became a committed mechanism: widen quest `source` to `'pinned'` so the existing line-94 `source === 'template'` filter excludes it with zero new code.
10. **False XP economics** — "user claims → 25–40 XP → standard radial burst" was wrong for the pinned quest (xp = 10 → micro tier); corrected to exactly +10 XP / chip-only, and the beat hierarchy re-stated as deliberate; "~7:00 totalXP 10–50" pinned to exactly 10/20.
11. **Hedged reduce-motion claim** — "Reanimated entering animations already collapse via the app's motion scale conventions" was an unverified assumption (existing cards use unconditional `entering`); replaced with the honest committed pattern + a binary zero-`withRepeat` and zero-canvas assertion (AC-5, AC-8).
12. **Vague mode-exit** — "the next focus/load simply renders the full screen" replaced with the actual mechanism: `totalXP` is a subscribed Zustand selector, exit is same-render, no transition animation added.
13. **Legacy WEEKLY QUEST hole** — minimal mode's "exactly three sections" silently broke when `quests_v2` is off (legacy path renders two quest sections); decided: WEEKLY QUEST does not mount while `isColdStart`, and AC-2 asserts its absence.
14. **Copy-drift vector** — strings were scattered across components; centralized into `STARTER_COPY` (single file) + `StarterLine` (color hard-bound, no color prop), making trap #2 structurally impossible; AC-8 greps for leakage.
15. **Compassion copy rules missing** — constraint existed only by vibe; now explicit, enumerated (`yet/still/only/haven't/don't/No /standalone 0/leading digit`), and machine-checked in `starterCopy.test.ts`.
16. **FreezeBank starter color gap** — current sub-line is `textMuted`; the zero-state branch now explicitly switches to `textSecondary`, nonzero branches untouched.
17. **StreakRow starter padding invention** — "padding: spacing.md" would have invented a new value (existing card uses its own shell); replaced with "reuse `styles.card` unchanged".
18. **StatBox starter rendering unpinned** — `starts today` in caption style had no mechanism; added the `starter?: boolean` prop with exact variant/color behavior.
19. **Self-contradictory Health rule** — "mixed rendering allowed (… is wrong …)" rewritten as three exhaustive, mutually exclusive states.
20. **Today-header replacement under-specified** — pinned to the exact caption node (lines 589–591), `'full'` branch only, with `'minimal'`/`'off'` declared untouched.
21. **Playwright contradiction** — "chromium at 390×844" conflicts with the chromium project's Desktop Chrome viewport; resolved: chromium project + `test.use({ viewport })` + `seedAuthedUser` seeding pattern, citing `routine-completion-modules.spec.ts` as the template.
22. **Unverifiable radar-position AC** — "unchanged from the pre-change build" had no measurement; now `today-hero-radar` testID + `boundingBox().y` vs committed `RADAR_Y_BASELINE` constant, ±1px.
23. **Unverifiable AC-8** — "a grep of style objects" replaced with three named unit-test files and exact assertions (style resolution, no `textMuted` token, single-file string ownership, no `withRepeat`).
24. **AC-2 made countable** — "three top-level sections" now three named testIDs plus five named absent markers.
25. **AC-9 made concrete** — "existing e2e snapshots" named: chromium + authenticated suites and the `visual` project's committed baselines, zero updates allowed.
26. **ACs added** — AC-11 (persist key v4 + fallback true) and AC-12 (radar caption present/absent on seeded scores), bringing the binary set to 12.
27. **Wrong motion line number** — MOTION_BUDGET.hero is line 23, not 26; fixed; celebrationFall (line 39) and reward choreography (lines 35–37) verified.
28. **sfxFor change pinned** — "joins the fanfare branch" replaced with the exact one-line expression.
29. **Gamification-off gate pinned** — "skipped entirely" replaced with the exact call-site condition `usePreferencesStore.getState().gamification !== 'off'` wrapped around the `celebrate`/`Confetti` branch.
30. **Em-dash pinned** — `—` specified as U+2014 in the `statValue` style, AC-6 asserts the literal and the `0 min` absence post-first-block.
31. **New dilution traps added** — #8 copy drift, #9 guard relocation, #10 ungated surface; effort table gained F0 and the `quests.ts` file in F3 so no work item is invisible.
32. **Banned-word sweep (§3–6)** — zero instances of "consider", "could", "maybe", "potentially", "we might", or hedge-verb "explore" remain; the token "Explore" appears only as the tab's proper name and its on-disk file path `app/(tabs)/explore.tsx`, which are identifiers, not hedges.
33. **Constraint check** — hex radar placement: untouched and asserted (AC-7); tokens-only: violations found and fixed (items 4–6); compassion copy: codified (item 15); web+native parity: §3.8 strengthened with explicit three-platform statement; flag gating: every behavior names its flags exhaustively in §3.0.
