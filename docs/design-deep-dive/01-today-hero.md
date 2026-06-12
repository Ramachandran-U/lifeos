# Cluster 1: Today first-viewport recomposition

> **Ratified amendments (founder, 2026-06-10 — cross-spec resolutions, see 00-INDEX.md):**
> R1: NextMoveHero backgrounds read `c[\`${module}Dim\`]` (the `*Light`→`*Dim` rename in 03 supersedes every `*Light` reference here).
> R2: the voice button's string-concat tints (`c.primary + '22'`/`'55'`) are replaced by a `primaryDim` fill + `border` hairline — no `+ 'XX'` construction ships.
> R7: with `today_answer_first_v1` on, this spec's deletion of the header XP bar (Acceptance #12) governs; 02's caption applies only while the flag is off.
> R8: `TodayHeader.tsx` and `NextMoveHero.tsx` enter Guard D's allowlist via the founder-approved `manifesto-change` batch (approved 2026-06-10, executed in Wave 3).
> R12: this spec's fallback-flip takes the next unused persist-key version at flip time (v5 if 02 already took v4).
> **Amendment (founder-flagged, 2026-06-13, W3 PR-B execution):**
> (a) §3.4.1: the hub subline reads the micro token via `style={textVariants.micro}` (not the `variant` prop) so `HexRadar.tsx` stays outside Guard D's allowlist; the resolution-8 batch remains exactly +2 (TodayHeader, NextMoveHero — FirstWinCard landed with PR-A).
> (b) Acceptance #4/#14 unit files are `.test.tsx` (the jest components-project discovery pattern excludes `.test.ts` under src/hooks/); content unchanged.
> (c) §3.3: the event-triggered InstallSheet instance is mounted only on Today; the Profile row mounts its own manual-open instance (a sheet cannot be opened cross-screen) — gates bypassed, outcomes recorded only on button press.
> (d) §3.5: the flag-on branch does not render the legacy "No routine yet" EmptyState — the hero's plan state is the screen's one answer; the legacy branch is unchanged.
> (e) §3.2: the keyed content swap ships entering-only — on react-native-web, a reanimated `exiting` clone lingers as a hidden DOM node, duplicating `next-move-primary` once per completion; entering-only reads as the same cross-fade.
> (f) Acceptance #3's e2e encoding is case-sensitive (`getByText('INSTALL LIFEOS', { exact: true })`) — Playwright's default match is case-insensitive and would self-trip on the spec-required Profile row label "Install LifeOS".
> (g) Acceptance #5's flag-on anchor is the Goals ModuleHeader, not a seeded daily-task title — flag-on, a parentless daily goal renders nowhere on Goals (its only surface was the card this flag removes).
> (h) e2e flag forcing: the boot `fetchFlags({ force: true })` overwrites seeded persisted flags when `EXPO_PUBLIC_AI_PROXY_URL` is empty — the spec both seeds `lifeos_flags_v4` and stubs `**/v1/config**`, and the served build must carry a non-empty proxy URL.
> (i) Standing product question for the founder (not blocking, flag is default-off): after the 3-decline permanent dismiss, the legacy hook nulls the install variant, which also hides the Profile row — spec-literal, but in tension with "permanent quiet path". Revisit at the flip call.
> **Amendment (founder ruling, 2026-06-14 — closes question i):** the Profile "Install LifeOS" row survives the permanent dismissal: `useAddToHomeScreen` gained `{ ignoreDismissed }`, passed only by the Profile row — the 3-decline/accept dismissal retires the AUTO offers (banner, event-triggered sheet) while the manual quiet path remains; already-installed still hides the row.
> **Fallback-flip executed (founder call, 2026-06-13):** `today_answer_first_v1` + `install_prompt_v2` flipped true in FALLBACK_FLAGS; persist key v4 → v5 per R12. §3.6's Worker-cohort dogfood stage was substituted by the direct flip — the founder IS the current cohort, and the Worker `flags` table (admin-seeded, 6 legacy rows) cannot gain rows without dashboard credentials; a `false` row inserted from the dashboard remains the kill switch, since overrides win over fallbacks. The 7-day −5%-block-completion watch runs through 2026-06-20 against the server-side telemetry store. The Goals-tab card JSX + its five styles were deleted per §3.2 (C1-5's second half now greps clean). Cold-start AC-7's Explore/Health/Today assertions were re-encoded per the activated resolutions 5/6/7; RADAR_Y_BASELINE=0 now governs the legacy branch only — the answer-first branch's radar contract is C1-11.

# TODAY SCREEN FIRST-VIEWPORT — Implementation-Grade Spec (HARDENED)
**Cluster:** Next Move on Today · broken greeting · install banner · first-2-seconds answer
**Repo:** `lifeos-w3` (all paths relative). Constraint honored throughout: **the hex radar does not move, shrink, or get demoted — it stays the opening hero of Today: the first content card in the scroll, at `size={340}`, fully visible in the first viewport (enforced by Acceptance #11). The only thing above it is 104px of screen chrome (`TodayHeader`), the same chrome class the cluster brief's option (a) already sanctioned; nothing card-like ever renders between the header and the radar (Acceptance #6).**

Naming note used throughout: **`AuroraText` means the `Text` component in `src/components/ui/Text.tsx`, imported as `import { Text as AuroraText } from '@/components/ui/Text'`** — the exact convention already used by `app/(tabs)/index.tsx` line 30. No new text component is created.

---

## 1. Current state

**What the screenshot shows (`tmp/audit-today.png`, 390-wide web):** Install banner occupies the top ~76px of the viewport. The radar fills the rest. "Good **morning**," is wrapped one-word-per-line in the bottom-right corner. **Zero actionable elements in the first viewport.** The answer to "what should I do next" — the app's entire pitch — is not on this screen at all.

**Why the greeting is broken** — `app/(tabs)/index.tsx`:
- The scroll renders `heroWrap` (radar) **first** (lines 524–545) and the header **second** (lines 548–599), so the greeting paints *below* the radar, at the bottom of the first viewport.
- The header row stacks `AvatarRing size={64}` + voice button (44×44) + feedback button (36×36) + optional `CompanionAvatar` (40) before `headerCenter` gets `flex: 1` (lines 549–576; styles `header`/`headerCenter` at lines 1106–1112). At 390px minus `spacing.xl` padding ×2, `headerCenter` is left ~100–130px wide. `<Heading>` is Nunito-Bold 24 (`src/components/ui/Typography.tsx` lines 9–20) — `{greeting}, {name}` wraps into a 4-character column. There is no `numberOfLines` anywhere on it (line 577).

**Where "Your Next Move" lives today** — `app/(tabs)/goals.tsx` lines 495–524: an inline `<View>` (not a component) styled at lines 765–775, fed by `dailyTasks[0]` (first active `level === 'daily'` goal, line 115), completed via `handleCompleteTask` (lines 211–219), with "Mark done"/"View" buttons at `minHeight: 36`. It exists only on the Goals tab.

**Install banner** — `src/components/shared/AddToHomeScreenPrompt.tsx` (label copy: `INSTALL LIFEOS`), mounted in `app/_layout.tsx` line 177 **above the navigator, in layout flow**, so it shoves the first viewport of *every* screen down ~76px until dismissed. Trigger: app open on supported web browser (`src/hooks/useAddToHomeScreen.ts`, variant resolver in `src/hooks/addToHomeScreen.ts`); dismissal: single permanent `localStorage` key `lifeos_a2hs_dismissed` (= `'1'`).

**Radar internals** — `src/components/gamification/HexRadar.tsx`: empty center (day-1 polygon collapses to a near-invisible dot at `0.02 * maxR`, line 53); spokes run through the center (lines 169–183); vertex icons idle at `opacity: 0.75` (line 240) and career is special-cased to `textPrimary` (line 228); a one-shot `pulseKey` dot-pulse mechanism **already exists** (lines 120–134) and is currently unused by Today (the `HexRadar` call at index.tsx lines 528–544 passes neither `pulseKey` nor `activeDomain`). The radar's score keys are `DomainKey` from `@/constants/gamification` = `'goals' | 'health' | 'finance' | 'career' | 'social' | 'polymath'` (distinct from the glyph key space in `@/components/ui/DomainGlyph`, which uses `'goal'` singular).

**Already-good machinery to reuse:** `MOTION_BUDGET` / `SPRING` / `EASING` / `useMotionScale` / `useSpringConfig` (`src/theme/motion.ts`), the completion pipeline `handleComplete` (index.tsx lines 282–338 — XP, streaks, celebration engine, telemetry), `CoachActionsCard`/`WhatNextCard` (the on-demand agent, distinct from the deterministic next move), and the sticky collapsed chip (lines 1004–1031, unchanged by this spec).

---

## 2. Options considered

**Q1 — where Next Move lives on Today:**

**(a) Compact bar pinned above the radar.** A 56px strip between header and radar holding "14:00 · Deep work → Done". Rejected: it stacks a third band above the hero, reads as a notification (banner blindness — the same pathology as the install banner), and a strip cannot hold a real headline or a 56px action without becoming the very card sludge the audit condemned.

**(b) The radar's empty hub hosts the next-action CTA.** The center is dead space, and putting the answer there is seductive. Rejected as the *primary* answer: the hub is ~94px across (inner ring at `0.33 × maxR`, maxR = 142.8 on a 340 radar) — room for ~12 characters per line, so real block titles ("Outline the mobile app launch doc") are unrepresentable, the tap target sits inside an SVG hit-testing thicket, and it converts the radar into a button wearing a chart as a costume. The hub is the right place for *state*, not for the *action* — that insight is kept (see §3.4).

**(c) Full hero card directly under the radar — first card in the scroll.** With the banner evicted and the header collapsed to one compact two-deck block, the math works: header ~104px + radar wrap ~352px + scroll gaps = ~488px, leaving ~276px of first viewport for a genuine hero with a 56px primary action. One hero per screen, answer-first, type-led, structurally colored by the next move's domain. **Committed: (c), with (b)'s hub repurposed as a passive state readout and the radar's existing `pulseKey` aimed at the next move's domain — the radar literally points at the answer below it.**

**Q3 — install banner:** (i) move it to the bottom as a persistent bar — rejected, still chrome on every screen; (ii) bury it as a Profile row only — rejected, zero discovery; (iii) **committed:** event-triggered bottom sheet at a peak moment (first block completion of a web session) + a permanent quiet Profile row.

---

## 3. The spec

Everything below ships behind two new **runtime flags** (see §3.6). Flag off = byte-identical current behavior: index.tsx branches once on a single `const answerFirst = useFlagStore((s) => s.isEnabled('today_answer_first_v1'))` boolean; the legacy JSX is preserved verbatim in the `false` branch.

### 3.1 `TodayHeader` — the greeting, fixed

**New file:** `src/components/shared/TodayHeader.tsx` (named export `TodayHeader`). Replaces index.tsx lines 548–599 in the flag-on branch. Renders **above** `heroWrap`. The radar stays the first *content* element; this header is chrome, per the cluster brief's own option (a) precedent. Container: `paddingTop: spacing.sm`, no horizontal padding of its own (inherits the scroll's `spacing.xl`). Root `testID="today-header"`.

**Two decks, total ~104px (Acceptance #11 enforces the resulting viewport budget):**

- **Deck 1 — utility row** (`height: 40`, `flexDirection: 'row'`, `alignItems: 'center'`, `gap: spacing.md`):
  `AvatarRing xp={totalXP} initials={initials || 'U'} size={36}` wrapped in a `Pressable` → `router.push('/(tabs)/profile')` · `<View style={{ flex: 1 }} />` spacer · `CompanionAvatar size={32}` (rendered only when `companion_v1` is enabled AND `gamification !== 'off'` — identical condition to index.tsx line 573) · voice mic button: `Pressable` 40×40, `borderRadius: 20`, `borderWidth: 1`, `backgroundColor: c.primary + '22'`, `borderColor: c.primary + '55'`, `Ionicons name="mic" size={18} color={c.primary}`, keeps `testID="voice-open"`, `accessibilityRole="button"`, `accessibilityLabel="Voice assistant"`.
  **The feedback bug button leaves the header.** It becomes the **last row of the utility stack** (§3.5 row 13): same `weekPlanBtn` style as "Log yesterday's progress", `Ionicons name="bug-outline" size={16} color={c.primary}`, label `<Body style={{ color: c.textPrimary, flex: 1 }}>Send feedback</Body>`, trailing `chevron-forward 16 c.textMuted`, `onPress={() => router.push('/feedback')}`, keeps `testID="feedback-open"`.
- **Deck 2 — greeting block** (full content width, `marginTop: spacing.sm`):
  - Greeting: `<AuroraText variant="h1" numberOfLines={1} testID="today-greeting">` — Nunito-Black 28/32 from `textVariants.h1` (`src/theme/typography.ts` lines 87–92), color `c.textPrimary` (the variant default; pass no `color`).
  - **Exact copy** (replaces the "Good morning" strings at index.tsx lines 370–375), produced by a pure exported function `formatGreeting(name: string, hour: number): string` in `TodayHeader.tsx`: `"Morning, {firstName}."` (hour < 12) · `"Afternoon, {firstName}."` (hour < 17) · `"Evening, {firstName}."` (else). `firstName = name.trim().split(/\s+/)[0] ?? ''`.
  - **No-name rule (binary):** if `firstName.length === 0 || firstName.length > 12`, render the greeting with no name and no comma: `"Morning."` / `"Afternoon."` / `"Evening."` — never ellipsize a human's name mid-word. `numberOfLines={1}` guarantees no wrap in every case.
  - Date line directly below (`marginTop: 2`): `<AuroraText variant="micro" muted>` `format(new Date(), 'EEEE · MMMM d').toUpperCase()` → `"WEDNESDAY · JUNE 10"` (existing string, index.tsx line 579).
- **The XP bar and `L4 → L5` labels are deleted from Today's header** (index.tsx lines 581–597): `TodayHeader.tsx` contains no `XpBar` import and no string `"XP"`; the `xpRow`/`xpLabelRow` styles and the `XpBar` import are removed from index.tsx in the same PR. Today rests quiet; XP feedback stays with the reward beats (`enqueueXPReward` flyaway) and the Rewards tab. This is principle 4, applied. (Acceptance #12.)

Entry motion: `FadeIn.duration(MOTION_BUDGET.reveal)`, no delay — the greeting is the first thing painted. Web/native parity: pure RN primitives (`View`, `Pressable`, `AuroraText`) + a reanimated entering animation — identical render tree on react-native-web and native.

### 3.2 `NextMoveHero` — the answer, extracted and moved

**New file:** `src/components/shared/NextMoveHero.tsx` (named export `NextMoveHero`, root `testID="next-move-hero"`).
**New file:** `src/hooks/useNextMove.ts` (named export `useNextMove`) + co-located `src/hooks/__tests__/useNextMove.test.ts`.
**Deleted in the same PR, gated by the same flag:** the inline card in `app/(tabs)/goals.tsx` lines 495–524 (rendered only when `!isEnabled('today_answer_first_v1')`) and, once fallbacks flip true (§3.6), the JSX plus styles `nextMoveCard` / `nextMoveHeader` / `nextMoveTitle` / `nextMoveActions` / `nextMoveBtn` (lines 765–775) are removed outright. **The card moves; it does not fork.** Goals' answer surface is Today. (Acceptance #5.)

**`useNextMove({ blocks, dailyTasks, now })` — deterministic, synchronous, zero AI** (`useNextMove.ts` imports nothing from `@/ai/`; Acceptance #14). Caller derivation in index.tsx: `blocks` is the existing state; `dailyTasks` is computed inside the existing `loadData` path as `getGoalsByUser(userId).filter((g) => g.level === 'daily' && g.status === 'active')` (synchronous on web per the localStorage shim; `getGoalsByUser` is already imported at index.tsx line 46) and stored in state so completion re-resolves the hero. Resolution order:
1. **`block`** — first block with `status === 'upcoming'` after sorting by `a.startTime.localeCompare(b.startTime)` (the exact sort at index.tsx line 975). `upNow = block.startTime <= format(now, 'HH:mm')` (string comparison; equality counts as up-now); else future.
2. **`task`** — else, `dailyTasks[0]` (the exact goals.tsx line 115 logic, lifted).
3. **`dayDone`** — else, if `blocks.length > 0 && blocks.every((b) => b.status !== 'upcoming')` is false but `completedCount === blocks.length` — concretely: `blocks.length > 0 && blocks.filter((b) => b.status === 'completed').length === blocks.length`.
4. **`plan`** — else (no blocks, no tasks).

Returns `{ kind, title, module, radarKey, startTime, endTime, upNow, extraCount }`. `radarKey` is the radar's `DomainKey` (`@/constants/gamification`): map `goal → 'goals'`; `health`/`finance`/`career`/`social`/`polymath` map to themselves; **non-domain modules (`rest`, `meal`, `work`) map to `undefined`** (no pulse, no active vertex).

**Layout (one card, four states):**
- Container: `borderRadius: radii.card` (22), `padding: spacing.lg` (24), `gap: spacing.sm`, `borderLeftWidth: 4`. **No full border** — the uniform bordered card dies here.
- Structural color: for the six canonical domains (`goal`, `health`, `finance`, `career`, `social`, `polymath`): `backgroundColor: c[\`${module}Light\`]`, `borderLeftColor: c[module]` (tokens verified in `src/theme/colors.ts`: `goalLight` … `polymathLight` exist in both palettes). Non-domain modules (`rest`/`meal`/`work`) and the `plan` state: `backgroundColor: c.surfaceAlt`, rail `c.primary`. `dayDone` state: `backgroundColor: c.surfaceAlt`, rail `c.success`. All values are token references; when the color cluster re-values `*Light` to Ink+Signal, this card inherits it for free. Zero hex literals in the file (Acceptance #10).
- Row 1 — eyebrow: `<AuroraText variant="micro" color={accent}>` where `accent = c[module]` for the six domains, `c.primary` for non-domain modules and `plan`, `c.success` for `dayDone` (the `micro` variant is already mono/caps/+1.6 tracking). Domain label map: `goal → GOALS`; every other module key uppercased verbatim (`HEALTH`, `CAREER`, `REST`, …). Exact strings:
  - future block → `NEXT · {startTime} · {LABEL}` e.g. `NEXT · 14:00 · CAREER`
  - up-now block → `UP NOW · {LABEL}` (never "overdue", "late", or "missed" — compassion rule; Acceptance #9)
  - task → `NEXT · GOALS`
  - plan → `DAY ONE`
  - dayDone → `ALL CLEAR · {completedCount}/{blocks.length}` e.g. `ALL CLEAR · 5/5`
- Row 2 — headline: `<AuroraText variant="h2" numberOfLines={2}>` (Nunito-ExtraBold 22/26), default `c.textPrimary`. Content: the block/task title **verbatim**; plan state: `"Let's build your first day."`; dayDone state: `"Every block done. Outstanding."`
- Row 3 — meta (rendered only when non-empty): `<AuroraText variant="caption" secondary>`:
  - block → duration from `startTime`/`endTime` ("HH:mm" each): `m = minutes(end) − minutes(start)`; `m < 60` → `"{m} min"`; `m % 60 === 0` → `"{m/60} h"`; else `"{h} h {m%60} min"`.
  - task → `"+{extraCount} more task{extraCount === 1 ? '' : 's'} today"` where `extraCount = dailyTasks.length − 1`; row omitted when `extraCount === 0` (same plural semantics as goals.tsx line 506).
  - plan → `"Three questions, one plan. Two minutes."` · dayDone → no meta row.
- Row 4 — actions (`flexDirection: 'row'`, `gap: spacing.sm`, `marginTop: spacing.xs`):
  - **Primary:** `minHeight: 56`, `borderRadius: radii.control` (14), `flex: 1`, `backgroundColor:` `c[module]` (six domains) / `c.primary` (non-domain block, plan) / `c.success` (dayDone), label `<AuroraText variant="bodyLg" color={c.inkOnColor}>`. Labels and handlers, exactly: block/task → `"Mark done"`; plan → `"Plan my day"` — calls `startOnboarding()` (index.tsx line 106) when `primaryDomains.length === 0`, else `void handlePlanWeek()`; dayDone → `"See your day"` — `setShowSummary(true)` (opens the existing `DailySummarySheet`). `testID="next-move-primary"`, `accessibilityRole="button"`.
  - **Secondary** (block/task states only): `minHeight: 56`, `borderRadius: radii.control`, `borderWidth: 1`, `borderColor: c.border`, transparent fill, label `bodyLg` in `c.textSecondary`, `testID="next-move-secondary"`: block → `"Show my plan"` — scrolls to the Today's-flow section: index.tsx holds `const scrollRef = useAnimatedRef<Animated.ScrollView>()` and a `blocksY` captured by `onLayout` on the `blocksSection` `<View>`; handler calls `scrollRef.current?.scrollTo({ x: 0, y: blocksY - spacing.md, animated: true })` (`scrollTo` is implemented by react-native-web) · task → `"Open in Goals"` — `router.push('/(tabs)/goals')`.
- **Completion path:** "Mark done" on a block calls the *existing* `handleComplete(blockId)` (index.tsx line 282) — XP, streaks, ambient sweep, celebration engine, telemetry all fire unchanged. On a task it calls `updateGoalStatus(id, 'completed')` + `completeGoalNode(userId, goal.goalType, goal.level)` + `track(EVENTS.goalCompleted, { goal_id, goal_type, level })` — the goals.tsx lines 211–219 pipeline minus `setCompletionToast` (that toast is Goals-screen state; **decision: no undo affordance on Today's task completion** — block completions keep their existing undo via the blocks list). After either completion, `loadData()` re-resolves the hook and the card cross-fades: content is keyed on `` `${kind}:${title}` `` in an `Animated.View` with `entering={FadeIn.duration(MOTION_BUDGET.reveal)}` `exiting={FadeOut.duration(MOTION_BUDGET.microFeedback)}`.
- Entry motion: `FadeInDown.delay(120).duration(MOTION_BUDGET.reveal)`; press feedback scales via `useSpringConfig('standard')`. All durations collapse under `useMotionScale() === 0` (reduce-motion), which the tokens already handle (Acceptance #9).
- Telemetry: add to `EVENTS` in `src/utils/telemetry.ts`: `nextMoveShown: 'next_move_shown'` and `nextMoveCompleted: 'next_move_completed'`. Fire `next_move_shown` (payload `{ kind, module }`) exactly once per `kind:title` change per mount; fire `next_move_completed` (same payload) on each primary press in block/task states. (Acceptance #13.)
- Web/native parity: pure RN primitives + reanimated entering animations — identical on react-native-web; the scroll-to uses `scrollTo({ y, animated: true })` which RNW implements.

### 3.3 Install prompt — evicted from the first viewport

- **`app/_layout.tsx` line 177:** wrap the legacy mount: `{!useFlagStore.getState ? null : !installV2 && <AddToHomeScreenPrompt />}` — concretely, read `const installV2 = useFlagStore((s) => s.isEnabled('install_prompt_v2'))` in `RootLayout` and render `<AddToHomeScreenPrompt />` **only when `!installV2`**. With the flag on, no screen renders top-of-flow install chrome, and `AddToHomeScreenPrompt` is mounted nowhere else (Acceptance #3; dilution trap #1).
- **New file:** `src/components/shared/InstallSheet.tsx` (named export `InstallSheet`, root `testID="install-sheet"`) — a bottom sheet using the exact `Modal visible transparent animationType="slide" onRequestClose` structure of `src/components/shared/DailySummarySheet.tsx` (line 68), with scrim/exit timings from `MOTION_BUDGET.scrimEnter`/`sheetExit`. Web-only by construction: returns `null` whenever `useAddToHomeScreen().variant === null` (the hook already returns null on native, when installed, and when unsupported). Mounted **only on Today** (`app/(tabs)/index.tsx`).
- **Exact trigger:** a session-scoped `useRef(false)` named `installOfferArmedRef` in index.tsx flips true on the first `handleComplete` call of the session; when it flips AND `Platform.OS === 'web'` AND `variant !== null` AND `shouldOfferInstall()` returns true, a `setTimeout` of **1780ms** (`MOTION_BUDGET.rewardRise + rewardHold + rewardExit` = 380+1100+300 — the sheet never collides with the XP beat) opens the sheet. The user just banked a win — that is the moment to ask for home-screen residency, not app-open.
- **Persistence** (extend `src/hooks/useAddToHomeScreen.ts` with exported `shouldOfferInstall(): boolean` and `recordInstallOffer(outcome: 'accepted' | 'declined'): void`; unit-tested in new `src/hooks/__tests__/useAddToHomeScreen.test.ts`):
  - `lifeos_a2hs_dismissed === '1'` → `shouldOfferInstall()` false (existing key, kept).
  - `lifeos_a2hs_shown_count` (integer-as-string) `>= 3` → false.
  - `lifeos_a2hs_last_shown` (epoch-ms-as-string) within the last `7 * 24 * 60 * 60 * 1000` ms → false.
  - `recordInstallOffer('declined')` (fired by both "Not now"/"Got it" and the ✕): increments `shown_count`, stamps `last_shown = String(Date.now())`; when the incremented count reaches 3, also sets `lifeos_a2hs_dismissed = '1'`. `recordInstallOffer('accepted')` (fired by "Install" tap and by the `appinstalled` event) sets `lifeos_a2hs_dismissed = '1'` — never auto-shown again.
- **Exact copy:** Title (`variant="h2"`): `"Take LifeOS full-screen."` Body (`variant="body"`): iOS → `"Tap Share, then 'Add to Home Screen' — LifeOS becomes a real app on your phone."` · Android with captured prompt (`canInstall === true`) → `"One tap. Full screen, faster launch, no browser bar."` · Android fallback → `"Open the ⋮ menu, then 'Install app'."` Buttons: Android-with-prompt shows primary `"Install"` (`testID="install-sheet-install"`, calls the hook's existing `install()`) + secondary `"Not now"` (`testID="install-sheet-later"`); Android fallback shows secondary `"Not now"` only; iOS shows a single secondary `"Got it"` (`testID="install-sheet-later"`) — the instructions are the action; `"Got it"` records `'declined'` for persistence purposes. Button styling: primary `minHeight: 56`, `borderRadius: radii.control`, `backgroundColor: c.primary`, label `bodyLg` in `c.inkOnColor`; secondary `minHeight: 56`, `borderWidth: 1`, `borderColor: c.border`, label `bodyLg` in `c.textSecondary`.
- **Permanent quiet path:** `app/(tabs)/profile.tsx` gains a row using the file's existing `Row` component (line 150): `icon="phone-portrait-outline"`, `label="Install LifeOS"`, inserted **directly above the existing "Send feedback" row** (line 536). Visible whenever `useAddToHomeScreen().variant !== null` AND `install_prompt_v2` is on; opens the same `InstallSheet` regardless of dismissal state (manual open bypasses `shouldOfferInstall()` and does not call `recordInstallOffer` unless a button is pressed).

### 3.4 The radar earns its position (without moving)

`src/components/gamification/HexRadar.tsx` changes — placement, size (340), and the scroll-collapse behavior in index.tsx (the `heroStyle`/`chipStyle` bodies at lines 482–492) are untouched (Acceptance #6):

1. **New `hub` prop:** `hub?: { topline: string; subline: string; onPress?: () => void }`. Rendered after the `<Svg>` as an absolutely-centered overlay: a wrapper `<View style={StyleSheet.absoluteFill} pointerEvents="box-none" alignItems="center" justifyContent="center">` containing a `<Pressable testID="radar-hub">` (`width: 120`, `alignItems: 'center'`, `gap: 2`, `hitSlop: 12`, `accessibilityRole="button"` when `onPress` is set, plain `View` semantics otherwise): topline `<AuroraText variant="h3" style={TABULAR_NUMS}>` in `c.textPrimary` (`TABULAR_NUMS` from `@/theme/typography`); subline `<AuroraText variant="micro" secondary>`. **Type only — no disc, no blur, no background fill of any kind** (dilution trap #9; Acceptance #7's snapshot shows no new shape nodes).
2. **Spokes clear the hub:** lines 169–183 — each spoke's inner endpoint moves from `(cx, cy)` to `pt(d.angleDeg, maxR * 0.18)`. Structural geometry change, not decoration. (Acceptance #8 pins the snapshot.)
3. **Hub content (computed in index.tsx, every state defined — an empty hub is a spec violation, dilution trap #5):**
   - `blocks.length === 0`: topline `DAY 1`, subline `PICK YOUR FIRST WIN` — `onPress` scrolls to `NextMoveHero` (same `scrollRef` mechanism as §3.2, y captured by `onLayout` on the hero's wrapper).
   - `blocks.length > 0 && completedCount < blocks.length`: topline `` `${completedCount}/${blocks.length}` `` (e.g. `2/5`), subline `BLOCKS DONE` — `onPress` scrolls to the Today's-flow section (`blocksY`).
   - `allComplete`: topline `ALL CLEAR`, subline `SEE YOUR DAY` — `onPress` = `setShowSummary(true)`.
4. **Vertex icons go full signal:** line 240 `opacity: isActive ? 1 : 0.75` → `opacity: 1` (the conditional is deleted); line 228 career special-case deleted → `iconColor = c[d.colorKey]` for all six. Color is meaning; it does not idle at 75%. (Acceptance #8; dilution trap #6.)
5. **The radar points at the answer:** in the flag-on branch, index.tsx passes `pulseKey={nextMove.radarKey}` and `activeDomain={nextMove.radarKey ?? null}` (the `radarKey` mapping defined in §3.2; `undefined` for non-domain modules means no pulse and no active vertex). The existing one-shot pulse (lines 124–134, `EASING.bounce`, `MOTION_BUDGET.reveal`) fires once per `pulseKey` change — a moment, not an idle glow; the mechanism's once-per-change guard (`prevPulseKey`) is untouched, so it respects principle 4 and reduce-motion via the existing motion plumbing (dilution trap #10).

Web/native parity: all changes are `react-native-svg` + RN primitives, identical on react-native-web; the hub overlay is plain `View`/`Pressable`/`AuroraText`.

### 3.5 Today's full vertical composition (flag on)

Scroll order in `app/(tabs)/index.tsx` flag-on branch (every section listed; render conditions identical to today unless a relocation is stated). This order is **normative** — any reordering is a failed review (dilution trap #3):

| # | Section | ~Height | Day-1 flat user | Week-2 active user |
|---|---|---|---|---|
| 1 | `TodayHeader` | 104 | visible | visible |
| 2 | Radar hero + hub (`heroWrap`) | 352 | visible — hub `DAY 1 / PICK YOUR FIRST WIN` | visible — hub `2/5 / BLOCKS DONE`, one-shot pulse on next-move domain |
| 3 | **`NextMoveHero`** | 150–214 | **visible — plan state, "Plan my day" fully on screen** | **visible — next block, "Mark done" fully on screen** |
| 4 | `DailyBriefing` | ~110 | partially below the fold | below the fold |
| 5 | Evening reflect / reflected card (existing `blocks.length > 0 && hours >= 18 && !hasReflectedToday` / `hasReflectedToday` conditions) | — | below fold | below fold |
| 6 | `StreakRecoveryCard` (conditional, unchanged) | — | — | below fold |
| 7 | Streak rail (`gamification === 'full'`, unchanged) | — | — | below fold |
| 8 | Quests (`gamification === 'full'`, unchanged) | — | — | below fold |
| 9 | `AdaptationCard` | — | — | below fold |
| 10 | Today's flow (blocks list + inline replan card; `blocksY` captured here) | — | — | below fold |
| 11 | `CoachActionsCard` / `WhatNextCard` (relocated from the pre-list position, lines 760–764 → here; it is the on-demand *agent*, the hero is the *answer*) | — | — | below fold |
| 12 | `LifeScoreHero` · `WeeklyBalanceCard` | — | — | below fold |
| 13 | Utility stack: Plan 7 days · 28-day report · Journey · Log yesterday · **Google Calendar card (relocated from above the block list, lines 900–941)** · **Send feedback (relocated from header, §3.1 — last row)** | — | — | below fold |
| 14 | Weekly insight · starter-day note | — | — | below fold |

First-viewport budget at 390×844 (tab bar ~80 → 764 usable): 104 + 16 (scroll gap) + 352 + 16 (gap) + 214 (hero max) = **702 ≤ 764**. Both personas get header + full radar + a fully tappable hero action with zero scroll (Acceptance #1, #11). The `allComplete` GlassCard (lines 671–688) is **deleted in the flag-on branch** — `NextMoveHero`'s `dayDone` state and the hub's `ALL CLEAR` replace it (one hero, not three).

### 3.6 Flags & rollout

Add to `FALLBACK_FLAGS` in `src/store/useFlagStore.ts` (runtime flags — Worker `/v1/config` is the kill switch, matching the Aurora Alive convention at lines 60–69):

```ts
// Answer-first Today: TodayHeader deck, NextMoveHero (moves off Goals),
// radar hub + full-signal vertices, composition reorder. Off = legacy Today.
today_answer_first_v1: false,
// Event-triggered InstallSheet + Profile row; off = legacy top-of-flow banner.
install_prompt_v2: false,
```

**Rollout:** merge with both `false` → flip on for the dogfood cohort via Worker `/v1/config` the same day → after 7 consecutive dogfood days in which the cohort's `routine_block_completed` events per active user (queried from the server-side telemetry store the admin portal reads) stay within −5% of the cohort's mean over the 7 days before the flip, flip both fallbacks to `true` and bump the persist key `lifeos_flags_v3` → `lifeos_flags_v4` (the file's own documented convention, lines 131–138). If the −5% floor is breached on any day, flip the flags off the same day and file the regression. `today_answer_first_v1` gates **both** the Today mount and the Goals-tab card removal in the same flag read — they flip together or not at all (dilution trap #2).

---

## 4. Dilution traps

1. **The banner gets "moved" but stays mounted in `_layout` as a bottom bar.** Counter-rule: with `install_prompt_v2` on, `AddToHomeScreenPrompt` must not mount anywhere; the only install UI is the event-triggered `InstallSheet` inside Today + the Profile row. Acceptance #3 enforces it.
2. **Goals keeps its Next Move card "temporarily, for safety."** Two heroes, zero answers. Counter-rule: the same flag condition that mounts `NextMoveHero` on Today hides the Goals card; at fallback-flip the inline JSX and its five styles are deleted. Acceptance #5.
3. **The hero slides below `DailyBriefing` "because the briefing is the AI-native surface."** Counter-rule: the order in §3.5 is normative; the briefing is commentary, the hero is the answer. Acceptance #1 makes the demotion fail CI.
4. **The greeting gets "fixed" by shrinking it to caption size in the old crowded row.** Counter-rule: the greeting is `variant="h1"` with `numberOfLines={1}` in a deck of its own whose only siblings are the 14px date line; the utility row above it contains nothing wider than 40px. Acceptance #2.
5. **The hub ships count-only, so a day-1 radar is dead-centered again.** Counter-rule: all three hub states (`DAY 1` / `n/N` / `ALL CLEAR`) have exact strings in §3.4; an empty-state hub is a spec violation. Acceptance #7.
6. **Vertex icons keep `0.75` opacity "to be gentle," buttons ship at 36px "to fit."** Counter-rule: icon opacity is the literal `1`; both hero buttons are `minHeight: 56`. Acceptance #8 + #1.
7. **The XP bar creeps back into `TodayHeader` "because users miss their level."** Counter-rule: `TodayHeader.tsx` contains no `XpBar` import and no `"XP"` string, ever; level feedback lives in `AvatarRing`'s existing ring fill and the Rewards tab. Acceptance #12.
8. **`useNextMove` grows an AI call "to make the pick smarter,"** adding latency, cost, and a sign-in dependency to the first viewport. Counter-rule: the hook is deterministic and imports nothing from `@/ai/`; the agent surface is `CoachActionsCard`/`WhatNextCard` at §3.5 row 11. Acceptance #14.
9. **The hub gains a disc, blur, or wash "for legibility."** Counter-rule: §3.4.1 is type-only; the snapshot in Acceptance #7 fails on any new background shape node.
10. **The install trigger drifts back to app-open, or the `shown_count` cap is dropped "to improve conversion."** Counter-rule: trigger = first `handleComplete` of a web session + 1780ms, caps = 3 shows / 7-day spacing / permanent dismiss, all unit-tested. Acceptance #4.

---

## 5. Acceptance criteria (binary)

1. **Hero action in first viewport (Playwright, 390×844, flags on):** for a seeded user with ≥1 upcoming block, `[data-testid="next-move-primary"]`'s bounding box satisfies `y ≥ 0 && y + height ≤ 764` with zero scroll, and its computed height ≥ 56. Same assertions for the day-1 persona (plan state, label text equals `"Plan my day"`).
2. **Greeting never wraps:** Playwright: bounding-box height of `[data-testid="today-greeting"]` ≤ 33px for seeded names `"Al"` and `"Maya Chen"`. Jest: `formatGreeting('Xxxxxxxxxxxxx Yyyy', 9)` (13-char first name, obviously fake) returns `"Morning."`; `formatGreeting('', 9)` returns `"Morning."`; `formatGreeting('Maya Chen', 14)` returns `"Afternoon, Maya."`.
3. **No first-viewport install chrome:** with `install_prompt_v2` on, full-page screenshots of the five tab routes (Today, Goals, Health, Finance, Profile) contain zero rendered matches for the text `INSTALL LIFEOS`; and `rg "AddToHomeScreenPrompt" app/ src/` shows exactly two mounts-or-imports: the component file itself and the `_layout.tsx` flag-off branch.
4. **Install trigger discipline (jest, new `src/hooks/__tests__/useAddToHomeScreen.test.ts`):** `shouldOfferInstall()` returns `false` when `lifeos_a2hs_dismissed === '1'`; `false` when `lifeos_a2hs_shown_count >= 3`; `false` when `Date.now() − Number(lifeos_a2hs_last_shown) < 604800000`; `true` otherwise. `recordInstallOffer('declined')` called three times sets `lifeos_a2hs_dismissed = '1'`. Playwright: `[data-testid="install-sheet"]` is absent on Today load and present after completing one block and waiting 2s.
5. **Goals tab, flags at shipped values:** Playwright text query for `YOUR NEXT MOVE` on the rendered Goals screen returns 0 matches; after fallback-flip, `rg "nextMoveCard" "app/(tabs)/goals.tsx"` returns 0 matches.
6. **Radar placement unchanged:** in the flag-on render branch, `heroWrap` is the immediate next sibling of `TodayHeader` with no other element between them; `HexRadar` receives `size={340}`; the PR diff contains zero changed lines inside the `heroStyle` and `chipStyle` `useAnimatedStyle` bodies (interpolation ranges `[0,140]`, `[0,220]`, `[120,200]` and their outputs are character-identical).
7. **Hub completeness (jest snapshot/unit):** with `blocks.length === 0` the hub renders exactly `DAY 1` and `PICK YOUR FIRST WIN`; with 2 of 5 complete, exactly `2/5` and `BLOCKS DONE`; with 5 of 5, exactly `ALL CLEAR` and `SEE YOUR DAY`; the hub subtree contains no `Circle`/`Rect`/`Path`/blur node — text and `Pressable`/`View` only.
8. **Full-signal vertices + spoke inset:** `rg "0\.75" src/components/gamification/HexRadar.tsx` returns 0 matches; `rg "career" src/components/gamification/HexRadar.tsx` returns 0 matches; jest snapshot asserts every spoke's inner endpoint equals `pt(d.angleDeg, maxR * 0.18)` (for size 340: inset radius 25.704).
9. **Compassion + prefs:** jest renders `NextMoveHero` in all four kinds (including up-now) and `TodayHeader` at each `gamification` setting (`full`/`minimal`/`off`): rendered output contains none of the strings `overdue`, `late`, `missed`, `streak`, `XP`. With motion scale 0 (reduce-motion harness), hero entry, cross-fade, and pulse all complete in ≤1 frame.
10. **Flag-off is identical + tokens only:** with both flags false, `e2e/visual-regression.spec.ts` passes with zero modified files under `e2e/visual-regression.spec.ts-snapshots/` in the PR; `rg "#[0-9A-Fa-f]{3,8}" src/components/shared/TodayHeader.tsx src/components/shared/NextMoveHero.tsx src/components/shared/InstallSheet.tsx src/hooks/useNextMove.ts` returns 0 matches (comments included — the rule is greppable or it is nothing).
11. **Radar fully in first viewport (Playwright, flags on, both personas):** `heroWrap`'s bounding box satisfies `y ≥ 0 && y + height ≤ 764` with zero scroll — the header above it never pushes the hero out.
12. **Header hygiene:** `rg "XpBar" src/components/shared/TodayHeader.tsx` returns 0 matches; Playwright: `[data-testid="voice-open"]` lies inside `[data-testid="today-header"]`'s bounding box, and `[data-testid="feedback-open"]`'s y-coordinate is greater than the "Today's flow" section header's y-coordinate.
13. **Telemetry (jest, mocked `track`):** mounting `NextMoveHero` with a resolved move fires `track('next_move_shown', { kind, module })` exactly once; re-render with unchanged `kind:title` fires nothing; one primary press in block state fires `track('next_move_completed', …)` exactly once; `src/utils/telemetry.ts` contains the literals `'next_move_shown'` and `'next_move_completed'`.
14. **Hook purity & coverage:** `rg "@/ai" src/hooks/useNextMove.ts` returns 0 matches; `useNextMove.test.ts` covers all four kinds, the two-upcoming-blocks tie-break (earlier `startTime` wins), and the up-now boundary (`startTime === now` → `upNow === true`).

---

## 6. Effort

| Piece | Size |
|---|---|
| `TodayHeader` extraction + `formatGreeting` + XP-bar removal + feedback relocation | **S** |
| `useNextMove` hook + unit tests (Acceptance #14) | **S** |
| `NextMoveHero` component + Today mount + Goals-card flag-gate/deletion + telemetry events | **M** |
| `HexRadar` hub prop + spoke inset + full-signal icons + pulse/active wiring + snapshots | **M** |
| `InstallSheet` + trigger + persistence extension + tests + `_layout` gating + Profile row | **M** |
| Composition reorder (calendar card, coach card, allComplete-card deletion) + flags + persist-key bump | **S** |
| Playwright spec `e2e/today-answer-first.spec.ts` (criteria 1–5, 7, 11–12) | **S** |

**Total: ~2 engineer-weeks including the dogfood week.** Key files: `app/(tabs)/index.tsx`, `app/(tabs)/goals.tsx`, `app/(tabs)/profile.tsx`, `app/_layout.tsx`, `src/components/gamification/HexRadar.tsx`, `src/store/useFlagStore.ts`, `src/hooks/useAddToHomeScreen.ts`, `src/utils/telemetry.ts`, new `src/components/shared/{TodayHeader,NextMoveHero,InstallSheet}.tsx`, new `src/hooks/useNextMove.ts`.

---

## Dilution audit log

1. **`AuroraText` was an undefined name** (no such component exists; the real component is `Text` in `src/components/ui/Text.tsx`, aliased at import) — pinned the alias convention in the preamble so nobody scaffolds a new component.
2. **Hex-radar constraint was self-undermining** ("does not move" while adding a header above it) — restated the constraint precisely (first content card, size 340, fully in first viewport, nothing card-like above it) and added binary enforcement (new Acceptance #11).
3. **`useNextMove(userId, today, blocks, dailyTasks)` left `dailyTasks` sourcing undefined on Today** — pinned the exact `getGoalsByUser(userId).filter(g => g.level === 'daily' && g.status === 'active')` derivation inside `loadData` (import already exists, index.tsx line 46).
4. **`upNow` comparison was unimplementable two ways** — pinned to `'HH:mm'` string comparison with equality counting as up-now, plus a boundary unit test (Acceptance #14).
5. **`dayDone`'s `allComplete` was undefined in the hook** — pinned to the exact `completed === blocks.length` predicate.
6. **"45 min" meta had no formula** — committed the minutes/hours formatting rules including the `h`/`h+min` cases.
7. **`ALL CLEAR · 5/5` read as a hardcoded string** — made it dynamic `{completedCount}/{blocks.length}`.
8. **"rest pass through" in the domain map read as the `rest` module passing through** — rewrote: `goal → 'goals'`, five domains map to themselves, `rest`/`meal`/`work` → `undefined` (no pulse/active vertex); pinned `DomainKey` to `@/constants/gamification` (the radar's key space, verified distinct from the `DomainGlyph` key space).
9. **Eyebrow label/color for non-domain block modules was unspecified** — committed: label = module key uppercased (`goal → GOALS`), accent `c.primary` for non-domain.
10. **Plan-state primary's routing condition ("when `onboardingStage` incomplete") was unverifiable** — committed to `primaryDomains.length === 0 → startOnboarding()` (verified `startOnboarding` at index.tsx line 106) else `handlePlanWeek()`.
11. **Task completion silently dropped Goals' undo toast with no decision** — committed: no undo affordance for task completion on Today; named the omitted call (`setCompletionToast`) so the diff is reviewable.
12. **Cross-fade behavior was a vibe** — pinned content keying (`${kind}:${title}`), entering/exiting animations and budgets.
13. **"Show my plan" scroll was hand-waved** — pinned `useAnimatedRef` + `onLayout`-captured `blocksY` + exact `scrollTo` call.
14. **Secondary button had no testID** — added `next-move-secondary`; also added `today-header`, `next-move-hero`, `radar-hub`, `install-sheet`, `install-sheet-install`, `install-sheet-later`.
15. **"Reuse the standard sheet pattern" was an escape hatch** (no standard sheet component exists in `src/components/ui/`) — pinned to the verified `Modal transparent animationType="slide"` structure of `DailySummarySheet.tsx` line 68.
16. **InstallSheet trigger timing would collide with the XP reward beat** — committed a 1780ms delay derived from `MOTION_BUDGET.rewardRise + rewardHold + rewardExit`; renamed the session ref `installOfferArmedRef` (the natural name contained a banned word).
17. **Persistence keys had no value formats** — pinned `shown_count` integer-as-string, `last_shown` epoch-ms-as-string, 7 days = 604800000ms, and the accepted/declined outcomes per button including the `appinstalled` event.
18. **iOS sheet had instructions but no button** — committed a single `"Got it"` secondary that records a declined outcome.
19. **Profile row placement was unanchored** — pinned to the existing `Row` component (profile.tsx line 150) inserted directly above "Send feedback" (line 536), with the flag + variant visibility condition and the manual-open-bypasses-gates rule.
20. **Hub overlay geometry was underspecified** ("absolutely-centered") — pinned the `StyleSheet.absoluteFill` + `pointerEvents="box-none"` wrapper and the no-background-shape rule, enforced in Acceptance #7.
21. **Voice button conflicting sizes (44 current vs 40 spec) had no styling detail** — pinned exact dimensions, radius, token-derived colors, icon size, and preserved testID/a11y attrs.
22. **`AvatarRing` props were omitted** (component requires `xp` and `initials`, verified) — pinned `xp={totalXP} initials={initials || 'U'} size={36}`.
23. **Long-name rule ignored empty names** — extended to `firstName.length === 0`, and extracted `formatGreeting(name, hour)` as a pure exported function so Acceptance #2 is unit-testable.
24. **XP-bar deletion didn't say what happens to the orphaned code** — committed removal of `xpRow`/`xpLabelRow` styles and the `XpBar` import from index.tsx in the same PR; added Acceptance #12 and dilution trap #7 (XP bar creep-back).
25. **First-viewport math ignored scroll gaps** — recomputed with the scroll's `gap: spacing.md`: 104 + 16 + 352 + 16 + 214 = 702 ≤ 764; corrected header estimate 102 → 104.
26. **Flag-off identity criterion referenced a nonexistent "pre-change snapshot"** (no Today jest snapshot exists; verified `app/(tabs)/__tests__` absent) — rewrote to the verified, existing `e2e/visual-regression.spec.ts` + zero-modified-snapshot-files check, which also catches the Goals card flag-off regression.
27. **"Byte-identical interpolation ranges (lines 482–492)" would break when line numbers shift** — rewrote as zero changed diff lines inside the two named `useAnimatedStyle` bodies with the literal ranges spelled out.
28. **Acceptance #2 used the founder's real name as test data** (violates the repo's no-real-PII-in-mocks rule) — replaced with obviously fake names.
29. **Acceptance #3's "no INSTALL text in top 760px" was fuzzy** — pinned to the verified literal banner copy `INSTALL LIFEOS`, zero matches full-page, plus a greppable single-mount rule for `AddToHomeScreenPrompt`.
30. **Acceptance #9 only tested `gamification === 'off'`** — extended to all three settings and all four hero kinds; compassion strings list kept and enforced.
31. **Acceptance #10's hex-grep allowed "matches inside comments"** — escape hatch removed: zero matches anywhere in the four new files, comments included.
32. **Rollout's "no regression in `routineBlockCompleted` rate" had no threshold, window, or source** — committed −5% floor vs the pre-flip 7-day mean, per-day breach response, and the server-side telemetry store as the source; pinned the persist-key bump `lifeos_flags_v3 → lifeos_flags_v4` (verified the convention comment at useFlagStore.ts lines 131–138).
33. **Flag-off "byte-identical" claim had no mechanism** — committed the single `answerFirst` boolean branch with legacy JSX preserved verbatim.
34. **Telemetry events lacked literal snake_case strings and fire-exactly-once semantics** — pinned `'next_move_shown'`/`'next_move_completed'` (matching the verified `EVENTS` convention) and once-per-`kind:title` rules; added Acceptance #13.
35. **Missing dilution traps** — added #7 (XP bar creep-back), #8 (AI call creep into `useNextMove`, with Acceptance #14 purity grep), #9 (hub gains a disc/blur), #10 (install trigger drifts to app-open / caps dropped).
36. **Banned-word sweep of §3–§6** — original contained zero instances of "consider/could/maybe/explore/potentially/we might"; sweep re-run on the hardened text (the polymath eyebrow label was set to `POLYMATH`, not the tab's display name, to keep §3 clean); §2's "Options considered" heading is outside the banned range and retained.
37. **Verified every cited path/line/token against the repo** — `tmp/audit-today.png`, index.tsx lines (524–545, 548–599, 282–338, 370–375, 482–492, 671–688, 760–764, 900–941, 975, 1004–1031, 1106–1112), goals.tsx (115, 211–219, 495–524, 765–775), `_layout.tsx` 177, HexRadar lines (53, 120–134, 169–183, 228, 240), `radii.card`=22/`radii.control`=14, `textVariants.h1` 28/32 at typography.ts 87–92, tokens `inkOnColor`/`surfaceAlt`/`*Light`/`success`, `MOTION_BUDGET`/`SPRING`/`EASING`/`useSpringConfig`, `lifeos_a2hs_dismissed`, `lifeos_flags_v3`, `GamificationVisibility` values — all correct; the one wrong name found (`AuroraText` as a component) is fixed in item 1.
