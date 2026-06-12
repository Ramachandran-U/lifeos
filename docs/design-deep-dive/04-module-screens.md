# Cluster 4: One hero per screen — module tabs de-sludge

> **Ratified amendments (founder, 2026-06-10 — cross-spec resolutions, see 00-INDEX.md):**
> R3: progress fills are solid domain hue on `c.track` — this spec's `DOMAIN_GRADIENTS.social`/`career` references are superseded by 03's deletion.
> R4: AC15's light-mode hero-numeral hex (`#140828`) is superseded — numerals render in `c.{domain}Text` in both modes per 03 §A.5.
> R5: this spec's Explore zero-state rule governs (02's `THIS WEEK` StarterLine treatment is superseded on this tab).
> R6: this spec's Health streaks zero-suppression governs on the Health tab (02's rule survives flag-off legacy only).
> R9: the 4px domain rail on heroes is legal only on a screen's single hero, where the hue also carries ink or the CTA.
> R11: this spec's ban on `—` placeholder vitals wins — the Health ModuleHeader stat slot is omitted until a real BMI exists.
> **Amendment (founder-flagged, 2026-06-13, W4 foundation execution):**
> (a) §3.0.1's `*.legacy.tsx` siblings would become expo-router ROUTES (every file under `app/` is a route; Metro excludes only `__tests__/`). The legacy trees live at `src/screens/legacy/XScreen.legacy.tsx` (named exports `XScreenLegacy`); the route files are thin default-export wrappers. Guard A/D/motion allowlist entries followed the extraction 1:1 — renames, not growth.
> (b) §3.0.3 names error rendering but no prop: `error?: string` added to `ConnectRowProps` (Caption in `c.error` under the row). ConnectRow is also barrel-exported, and its icon renders in `accent` (spec committed name+size only).
> (c) jest wiring (required for the mandated test paths to execute): the node project's `testPathIgnorePatterns` `/app/` entry now exempts `app/(tabs)/__tests__/`, and the components project's `testMatch` gained `src/screens/**/*.test.tsx` — without these, hierarchyGuards and the legacy snapshots are silently undiscovered.
> (d) hierarchyGuards' §3.0.7 file list is seeded with 13 of 14 files — `UpcomingBirthdaysCard.tsx` still carries its emoji until the Social PR's re-skin lands (append-as-you-sweep, documented in the test header); Finance's hero is inline so `app/(tabs)/finance.tsx` stands in for it in HERO_FILES; hero files arm via existsSync as each screen PR creates them.
> (e) The spec's SectionTitle comment literal (`never "SKILL GAPS"`) would trip Guard D in a non-allowlisted file — reworded without the caps literal.
> **Amendment (founder-flagged, 2026-06-13, W4 batch A — Health + Explore):**
> (f) §3.0.7 swaps are unconditional in the shared components (the sanctioned "lands with its screen's PR" mechanism); the ExploreScreenLegacy AC12 snapshot was re-recorded in the same PR — a pure 66-line deletion (ConstellationView's empty-placeholder Card). Legacy files themselves untouched.
> (g) `YouTubeImportCard` gained `presentation?: 'card' | 'row'` (default `'card'` — legacy byte-identical); `'row'` renders the §3.0.3 ConnectRow and keeps the state machine + review modal as the press flow.
> (h) ChasingNowCard's row re-skin renders question + `Pull →` only; the per-thread dismiss died with the Card (`onDismiss` stays optional for legacy compat).
> (i) The connected Fit row's press target is Sync, leaving no home for "Disconnect" — not surfaced in the flag-on Health tree (legacy keeps it). Filed as PARKED_ITEMS 13.2; must land before flag graduation.
> (j) DiscoverGrid + interest-suggestions fetch are legacy-only; the recomposed Explore cast is exactly §3.2 items 1–9.
> (k) The Energy row's `Log` action expands an inline 1–5 numeral pill picker (the emoji scale is banned by §3.0.5; the spec named the action, not the input).
> **Amendment (founder-flagged, 2026-06-13, W4 batch B — Career + Social):**
> (l) CareerStrategyView's six §3.0.7 labels were swept in this PR (W2 had only recolored them); Guard D entry shrank. The dynamic `PHASE {n}` / slot / priority caps and `12-WEEK EXECUTION PLAN` sit OUTSIDE the committed kill table and were left byte-exact — `12-WEEK EXECUTION PLAN` now shouts directly under the sentence-case `12-week plan` SectionTitle and needs a dossier ruling before graduation.
> (m) `ReconnectHero` gained `onAdd` (the empty-state CTA had no committed handler); `onSnooze` is optional — the `useHeroSnoozeStore.snooze('social')` call lives inside the hero, the screen reacts via subscription.
> (n) The legacy caps eyebrows did not move into `CareerSetupSheet` (Guard D bans caps in new files; allowlist may not grow): sentence-case segment headlines carry the hierarchy; the analyse button gained `loading`/`Analysing…` (the legacy screen-level loading block has no home in the sheet).
> (o) SavePathModal's raw `duration(250)` snapped to `TIMING.normal` per the motion ratchet's ±20% rule.
> (p) R9 scope call: the social in-cadence quiet line renders WITHOUT the 4px rail (no ink/CTA in the hue there); the rail lives on the overdue state; CareerPathHero carries it in all three states (each carries career ink or a CTA).
> (q) Spec-silent position calls: `Edit path` = the `Skill gaps` SectionTitle trailing action; the career hero re-enters keyed by data state; the social FAB gained a11y role/label. Copy nits kept byte-exact and flagged: `1 days ago` / `1 people in your orbit` at n=1.
> **Amendment (founder-flagged, 2026-06-13, W4 batch C — Finance + wave e2e):**
> (r) Finance's hero states live in `FinanceHero.tsx` (the route file keeps the `finance-hero` slot): route files are render-testable in neither jest project, and the AC8/AC13/R4 unit halves bind to the component. Connected-with-zero-transactions renders a first-value line, never ₹0, no rail (R9).
> (s) `connect-row-gmail`'s press target is a minimal Modal (`Sync now` / `Disconnect Gmail`) — §3.0.3's "Disconnect lives one level in" realised; supersedes the amendment-(i) parking precedent for Gmail since legacy already shipped disconnect. (Fit's disconnect remains parked as 13.2.)
> (t) finance.tsx V1 carries no `<Label>` at all (hierarchyGuards is file-scoped): inner-tab labels re-set as Body, setup field labels sentence-cased, CategoryPickerModal's `RECATEGORISE` → `Recategorise`, the Transactions connect Card → shared EmptyState. WeeklyInsightCard's decorative icon bubble died with its eyebrow.
> (u) §3.5 item 6's "SubscriptionsBillsCard internals unchanged" presumed W2 had swept its caps — false on trunk; all four finance child cards were swept here (Guard D −3; MilestoneTracker's single-word caps never matched the guard pattern but died anyway).
> (v) AC14's settle set gains "curated spark" as the strictly-better outcome — `generateDailySpark` never rejects (curated fallback by design), so the proxy-500 path settles to a curated SparkHeroCard, not Frontier/EmptyState/empty. Explore's empty-state CTA is therefore e2e-unreachable; its AC2 row is asserted as the de-facto first-run action (`Pull thread`) plus the unit-covered EmptyState.
> (w) AC2 seeded-state e2e gaps, unit-covered instead and documented in-spec: Career state C (needs an in-memory AI analysis; owned by career-strategy.spec.ts), Finance mix bar (transactions live in Dexie, beyond the localStorage seed helpers), AC9 day-advance (wall clock).
> **AC5 rulings (founder, 2026-06-13 — both flagged conflicts KILLED, W4 follow-ups PR):**
> (x) `formatDueLabel`'s past-due branch returns `Past due` (was `Overdue`) — the one data-driven path that could render the AC5-banned literal is closed; AC5 now holds unconditionally on Finance.
> (y) `12-WEEK EXECUTION PLAN` → sentence-case `12-week execution plan` (Body/bodyMedium in `c.careerText`), joining the §3.0.7 sweep it sat outside of. The dynamic `PHASE {n}: {NAME}` label stays (data-driven phase identity, ruled out of scope).
> (aa) **Copy ruling, 2026-06-14:** the n=1 plural nits flagged in (q) are fixed — `1 day ago` / `1 month ago` / `1 person in your orbit` (ReconnectHero) and `across 1 interest` (WeekStatLine); the spec's string templates are amended to singularize at n=1.
> (z) The Fit ConnectRow's press target is now `FitActionsSheet` (`Sync now` / `Disconnect Google Fit`), the Gmail-sheet pattern — amendment (i)'s parking is resolved; PARKED_ITEMS 13.2 un-parked. Legacy-deletion ownership (trap 1) ratified: the flag-flipping session records the 100% date, deletion executes after 14 consecutive days.

All paths, line numbers, tokens, and store APIs are now verified against the repo. Three load-bearing discoveries: the repo has **no ESLint config** (the spec's ESLint enforcement is unenforceable as written), `usePreferencesStore` **does not persist on native** (the snooze decision was broken), and a dozen child-card CAPS eyebrows survive the spec's sweep. Producing the hardened spec.

# Module Screen Hierarchy — Implementation-Grade Spec (HARDENED)

**Cluster:** Health / Explore / Career / Social / Finance tab screens — card sludge, value-before-form, import-prompt collapse, one-hero rule, LABEL-CAPS replacement.
**Repo:** `c:\personal\Project X\lifeos-w3` (all paths below relative to it).
**Manifesto basis:** Answer First, Celebrate Loud, Rest Quiet — principles 1, 2, 3, 5.
**Out of scope, by constraint:** `app/(tabs)/index.tsx` (Today) is not touched by this cluster. The `HexRadar` hero at `app/(tabs)/index.tsx:522–530` keeps its exact position, props, and chrome. Any PR in this cluster that diffs `index.tsx` is rejected at review.

---

## 1. Current state

What the code and the audit screenshots (`tmp/audit-health.png`, `tmp/audit-explore.png`, `tmp/audit-career.png`, `tmp/audit-social.png`, `tmp/audit-finance.png`) actually show:

**Health** (`app/(tabs)/health.tsx`): the screen opens on `VitalsCard` (lines 376–386) — for a new user that is a data table of em-dashes ("BMI — Weight — Height —"). Below it: `HealthSummaryCard` (388–390), a streaks Card showing **two zeros with emoji** (lines 398–416, `'💪'`/`'🥗'` at 406–407), `RecoveryCard` (418–422), `WaterCard` (424–434), `EnergyCard` (436–438), a full Google Fit promo Card (lines 440–481), then two collapsible section headers that are themselves Cards with `SectionLabel` CAPS ("CALORIE TRACKING" at 496, "BLOOD REPORTS" at 586, spanning lines 488–598). Nine sibling bordered cards; no hero; the screenshot's first viewport is em-dashes plus zeros.

**Explore** (`app/(tabs)/explore.tsx`): render order is ChasingNow → SparkHero → Expeditions → Constellation → "THIS WEEK / 0 min" summary Card (lines 598–604) → CrossDiscipline → Frontier/Discover → `YouTubeImportCard` full promo Card (lines 647–652) → maps → interests. The screenshot's first viewport for a new user: an empty constellation placeholder, **"0 min across 0 interests"**, and a red YouTube promo card. The actual hero material (`SparkHeroCard`, `src/components/modules/polymath/SparkHeroCard.tsx`) is gated behind the compile flag `domainNudges` (`isEnabled('domainNudges')` at explore.tsx:228), which defaults **false** in `DEFAULT_FLAGS` (`src/config/flags.ts:49`) — so most users never see it.

**Career** (`app/(tabs)/career.tsx`): for a user without an analysis, the entire screen is a form — `renderSetup()` (lines 288–393) renders "NEW CAREER PATH" CAPS label (line 291), two text inputs, timeline pills, and a skills input, before any value has been shown. The screenshot confirms: the first viewport is an empty questionnaire. A second inline form ("ELITE STRATEGIST", lines 455–523) appears in the results view. The save-path modal (lines 617–661) also holds a `TextInput`.

**Social** (`app/(tabs)/social.tsx`): opens on `SocialScoreCard` (a score/100 visualization, lines 104–108), then `UpcomingBirthdaysCard` (110–113, with a literal `'🎂'` at `src/components/modules/social/UpcomingBirthdaysCard.tsx:43`), then the full-width `ContactsImportCard` Google Contacts promo (lines 115–121, with `'🎂'` again at `ContactsImportCard.tsx:248`) — pushing the one actionable thing (the most-overdue contact) below the fold at 390×844. The CAPS section header "Overdue" renders via `SectionLabel` at line 125; tier headers at line 144.

**Finance** (`app/(tabs)/finance.tsx`): the disconnected Overview state (lines 681–696) is the **keeper** — icon bubble + plain-language trust copy ("Only transaction emails are scanned — nothing is uploaded.") + one Button3D. But once connected, the first card is sync plumbing ("GMAIL CONNECTED / Last synced…", lines 701–734) above the actual answer ("THIS MONTH SO FAR" spend, lines 737–777), and every section is a CAPS-labelled Card ("SPENDING MIX" 783, "TOP CATEGORIES" 816/831, Goals tab: "TRUE SAVINGS RATE — THIS MONTH" 1133, "STRATEGY" 1148, "WEEKLY TIPS" 1171).

**Shared primitives:** `EmptyState` (`src/components/ui/EmptyState.tsx`) exists and is good (icon / title / caption / accent / cta props) but has no trust-copy slot. `SectionLabel` (`src/components/ui/SectionLabel.tsx`) renders `variant="micro"` — JetBrains Mono stack 10.5px, uppercase, letterSpacing 1.6 (`textVariants.micro`, `src/theme/typography.ts:118–124`) — and is used as the section-header pattern app-wide: the LABEL-CAPS offender. Beyond the screens, **fourteen child components rendered by these five screens carry their own literal-CAPS eyebrows** (full kill table in §3.0.7) — killing only the screen-level headers would leave CAPS in the first viewport. Import prompts are three independently hand-rolled full-width Cards (`YouTubeImportCard`, `ContactsImportCard`, the Fit card in health.tsx:440–481, the Gmail sync card in finance.tsx:701–734). `motion.ts` already carries the full vocabulary needed (`MOTION_BUDGET.hero` 520, `SPRING.soft`, `sheetExit` 520, `shimmer` 900ms half-cycle = 1.8s full sweep, `useStaggerDelay`). **The repo has no ESLint config and no `lint` script** — every "lint rule" enforcement in this spec is therefore specified as a Jest source-guard test instead (precedent: `src/db/queries/__tests__/syncReadContract.test.ts`).

---

## 2. Options considered

**A. Restyle in place.** Keep every screen's current component order; recolor, de-border, and retype the existing cards; shrink the import promos. Lowest risk, zero data-flow changes. Rejected: it is the definition of dilution — the audit's core finding is *order and weight*, not paint. Health would still open on em-dashes, Career would still open on a form.

**B. Single shared `ModuleScreen` scaffold.** Build one layout component (hero slot / supporting slot / connections slot) and rewrite all five screens as configurations of it. Maximum consistency and the one-hero rule becomes structurally unbreakable. Rejected: the five screens have genuinely different data shapes (Finance's inner tab bar, Health's collapsibles, Career's two-phase setup/results) — a generic scaffold either grows escape hatches (and dies) or forces fake uniformity. Also a far larger blast radius against five live screens.

**C. Per-screen recomposition on shared primitives.** Three small shared primitives (`SectionTitle`, `ConnectRow`, `EmptyState.trustNote`) plus one explicit hero component per screen; each screen is recomposed by hand under a single runtime flag, with a written layout contract ("index 0 after the header is the hero"). This keeps each screen honest about its own answer while making the import-collapse and LABEL-CAPS kill mechanically consistent.

**Committed: Option C.**

---

## 3. The spec

### 3.0 Shared foundation (build first)

#### 3.0.1 Flag

Add to `FALLBACK_FLAGS` in `src/store/useFlagStore.ts` (after `progress_map_v1`, line 69):

```ts
// Module-screen hierarchy v1: hero-first recomposition of Health / Explore /
// Career / Social / Finance tabs + ConnectRow collapse + SectionTitle swap.
// Default OFF; cohort rollout from the Worker /v1/config; kill switch = flip off.
module_hierarchy_v1: false,
```

Default-false addition → **no** persist-key bump (`lifeos_flags_v3` stays at useFlagStore.ts:138). This is safe because `isEnabled` is `Boolean(get().flags[key])` (useFlagStore.ts:127): a persisted `flags` object that predates the key returns `undefined` → `false`, identical to the fallback; the next `/v1/config` fetch re-merges `{ ...FALLBACK_FLAGS, ...json.flags }`.

Each of the five screens branches exactly once, as the first hook-derived value in the component body: `const hierarchyV1 = useFlagStore((s) => s.isEnabled('module_hierarchy_v1'));`, and the screen body is `if (!hierarchyV1) return <HealthScreenLegacy …/>;` (one line; legacy extraction per Dilution trap 1). The legacy render path is preserved **byte-identical** in `*.legacy.tsx` siblings while the flag is off.

Rollout: internal dogfood cohort → 10% → 100%, driven from the Worker `/v1/config`. The e2e suite forces the flag on with the existing route-interception pattern from `e2e/sync-cross-device.spec.ts:54–62`:

```ts
await ctx.route('**/v1/config**', (route) => route.fulfill({
  status: 200, contentType: 'application/json',
  body: JSON.stringify({ flags: { module_hierarchy_v1: true }, fetched_at: new Date().toISOString() }),
}));
```

**testID contract (foundation, non-optional):** every hero slot's root `View` carries `testID="{screen}-hero"` (`health-hero`, `explore-hero`, `career-hero`, `social-hero`, `finance-hero`); every `ConnectRow` carries `testID="connect-row-{provider}"` (`connect-row-youtube`, `connect-row-contacts`, `connect-row-fit`, `connect-row-gmail`). e2e assertions in §5 bind to these IDs.

#### 3.0.2 LABEL-CAPS replacement: `SectionTitle`

**Decision:** section headers app-wide are sentence-case headlines, not mono caps. The `micro` variant survives **only** as data metadata inside a hero or row (timestamps, XP deltas, tabular figures) — never as a header above a section.

New file `src/components/ui/SectionTitle.tsx`:

```tsx
interface SectionTitleProps {
  children: string;          // sentence case — "Skill gaps", never "SKILL GAPS"
  count?: number;            // trailing count, e.g. "Saved paths · 3"; omitted = no count rendered
  trailing?: ReactNode;      // action slot (e.g. "Add" pill, chevron); omitted = title-only row
}
```

- Text: `<Text variant="h3">` — `Nunito-ExtraBold 18/22` from `textVariants.h3` in `src/theme/typography.ts:98–102`, color `c.textPrimary`.
- Count: appended as ` · {count}` in `c.textMuted`, same variant.
- Layout: `flexDirection:'row'`, `justifyContent:'space-between'`, `alignItems:'center'`, `marginTop: spacing.lg` (24), `marginBottom: spacing.xs` (4). No background. No border. No Card.
- Export from `src/components/ui/index.ts` (the barrel at `src/components/ui/index.ts:1–23`).

Every `SectionLabel`-as-header and literal-CAPS `Label` on the five screens is replaced (exact list per screen below; child-component sweep in §3.0.7). **Enforcement** (the repo has no ESLint): new guard test `app/(tabs)/__tests__/hierarchyGuards.test.ts` reads the five screen files (`health|explore|career|social|finance`.tsx, excluding `*.legacy.tsx`) with `fs.readFileSync` and fails on any match of `/SectionLabel/` or `/<Label[ >]/`. Today/Rewards are other clusters' files and are not read by this guard.

#### 3.0.3 Import/connect collapse: `ConnectRow`

**The rule:** a connect/import prompt never renders above user content, and never renders as a Card. Two patterns only:

1. **True empty state** (the screen has zero user content AND the connection is the primary on-ramp): the Finance keeper pattern — `EmptyState` with icon, headline, trust copy, one CTA. This is the *content* of the screen, so it sits in the hero slot.
2. **Compact connect row** (the screen has any user content, OR the connection is a secondary on-ramp): a single plain row at the **bottom** of the screen, under a `SectionTitle` reading `Connections`.

New file `src/components/ui/ConnectRow.tsx`:

```tsx
interface ConnectRowProps {
  icon: keyof typeof Ionicons.glyphMap;  // Ionicons name at size 18 — committed per row below
  title: string;            // "Connect YouTube"
  caption: string;          // one line, value + trust: "Turns subscriptions into interests · read-only"
  actionLabel: string;      // "Connect" | "Import" | "Sync now"
  accent: string;           // domain color token, e.g. c.polymath
  onPress: () => void;
  testID: string;           // "connect-row-{provider}" — required, not optional
  status?: string;          // connected meta, replaces caption: "Synced 2h ago · 14 new"
  loading?: boolean;        // swaps actionLabel for LoadingDots
}
```

- Layout: full-width pressable row (`PressableScale`), `minHeight: 56`, `paddingVertical: spacing.sm`, hairline top border (`borderTopWidth: StyleSheet.hairlineWidth`, `borderTopColor: c.border`). **No** card background, **no** corner radius, **no** left accent border. **No `style` prop** — the component owns its chrome (Dilution trap 3).
- Columns: icon (fixed 28 box) · flex column [title as `Body` with `fontFamily: fonts.bodyMedium` / `c.textPrimary`; caption or status as `Caption` / `c.textMuted`, `numberOfLines={1}`] · `actionLabel` as `Label` in `accent`, full saturation (manifesto 3: color is meaning — the accent appears at 100%, never `+ '20'` tints).
- Press → runs `onPress` (starts OAuth, or opens the existing review modal/sheet, which are kept as-is: `ContactsImportCard`'s review Modal and `YouTubeImportCard`'s review Modal remain the press targets).
- Error text renders as a `Caption` in `c.error` directly under the row.
- Web/native parity: the component is platform-neutral; platform gating stays where it lives today — callers for web-only integrations early-return `null` off-web exactly as `YouTubeImportCard.tsx:42` and `ContactsImportCard.tsx:51` do now.

**Refactor, not duplicate:** `YouTubeImportCard` and `ContactsImportCard` keep their state machines and review modals but their idle/connected render becomes `<ConnectRow …/>`; the promo-card JSX (CAPS header `IMPORT FROM YOUTUBE` at YouTubeImportCard.tsx:102, `IMPORT FROM GOOGLE CONTACTS` at ContactsImportCard.tsx:117, multi-line pitch, tinted button) is deleted. The health.tsx Fit card (440–481) and finance.tsx sync card (701–734) are replaced inline.

**Exact ConnectRow copy + icon table (committed — no icon choice left to the implementer):**

| Screen / provider | icon | title | caption or status | actionLabel |
|---|---|---|---|---|
| Explore / YouTube (disconnected) | `logo-youtube` | `Connect YouTube` | `Turns subscriptions into interests · read-only` | `Connect` |
| Explore / YouTube (connected) | `logo-youtube` | `Import from YouTube` | `You choose what gets added` | `Import` |
| Social / Contacts (disconnected) | `person-add-outline` | `Connect Google Contacts` | `Names and birthdays stay on this device` | `Connect` |
| Social / Contacts (connected) | `person-add-outline` | `Import contacts` | `You choose who gets added` | `Import` |
| Health / Google Fit (disconnected) | `fitness` | `Connect Google Fit` | `Steps, sleep, heart rate and weight — synced automatically` | `Connect` |
| Health / Google Fit (connected) | `fitness` | `Google Fit` | status: `Synced 14d · {totalSteps.toLocaleString()} steps` (window is fixed at 14 by `syncFitDailyData(clientId, 14)`, health.tsx:182) | `Sync` |
| Finance / Gmail (connected, Overview bottom) | `mail-outline` | `Gmail` | status: `Synced {formatRelative(lastSyncedAt)} · {ingestedCount} new`, appending ` · {skippedCount} skipped` only when `skippedCount > 0` | `Sync now` |

"Disconnect" lives one level in (inside the press target's sheet/modal), not on the row.

#### 3.0.4 `EmptyState` generalization (the Finance keeper)

Modify `src/components/ui/EmptyState.tsx`: add one prop.

```ts
trustNote?: string;   // privacy/trust clause rendered above the CTA
```

Rendered as a row: `Ionicons name="lock-closed-outline" size={14} color={c.textMuted}` + `Caption` in `c.textMuted`, `textAlign:'center'`, `marginTop: spacing.xs`. Everything else (icon bubble, `Heading` title, caption, CTA Button — EmptyState.tsx:26–40) unchanged. This is the single true-empty pattern for all five screens.

#### 3.0.5 Zero-suppression rule (applies to all five screens)

A stat whose value is 0 never renders as a surface. No "0 min", no "0-day streak", no "—" vitals table. At zero, the slot either disappears or is replaced by the action that produces the first non-zero value. The rule is enforced in component logic as `if (n <= 0) return null;` with a unit test per surface (§5 AC8). Emoji never appear adjacent to numerals or inside this cluster's rendered output: `'💪'`/`'🥗'` (health.tsx:406–407), `'🎂'` (ContactsImportCard.tsx:248 **and** UpcomingBirthdaysCard.tsx:43) are deleted and replaced by `Ionicons name="gift-outline" size={16} color={c.social}` where a glyph is still needed.

#### 3.0.6 Motion + preference contract (all heroes and rows)

- Hero: `Animated.View entering={FadeInDown.duration(MOTION_BUDGET.hero)}` (520ms) — once per focus, the only `hero`-budget entry on the screen.
- Supporting rows: `FadeIn.delay(stagger(i, MOTION_BUDGET.staggerTight)).duration(MOTION_BUDGET.reveal)` using `useStaggerDelay()` from `src/theme/motion.ts:177–183` (caps the index at 5 — max 6 distinct delays; returns 0 under reduce-motion).
- Sheets (CareerSetupSheet): enter `SPRING.soft`, scrim `MOTION_BUDGET.scrimEnter` 480; exit `MOTION_BUDGET.sheetExit` 520 / `scrimExit` 460.
- Reduce-motion: all durations route through `useMotionScale()`/`useStaggerDelay()` — scale 0 lands in one frame. No new idle/ambient loops anywhere in this cluster (manifesto 4: rest quiet).
- `usePreferencesStore.gamification === 'off'`: streak rows and XP-adjacent copy render `null`.
- Haptics: hero CTA press = `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)`; row press = `Haptics.selectionAsync()` — native only, web no-op (existing pattern, e.g. SparkHeroCard.tsx:29).

**Theme-contrast rule (new — kills the "put the card back for light mode" escape):** hero display numerals render in the domain token (`c.health`, `c.career`, `c.social`, `c.finance`, `c.polymath`) on the **dark** theme and in `c.textPrimary` on the **light** theme (the Aurora domain hues are calibrated for dark backgrounds — `src/theme/colors.ts:16–29` — and fail large-text contrast on `#F7F4FC`). The 4px structural left border and all CTA fills use the domain token in **both** themes. Selected via `useThemeStore` mode, same source `useColors()` reads. No card chrome is ever the fix for light-mode contrast.

#### 3.0.7 Child-card CAPS kill table (new — closes the "screens are clean, cards aren't" hole)

Every literal-CAPS eyebrow that renders **on the five screens' scroll content** dies in this cluster, in the same PR as the screen that renders it. Sheet/modal interiors (AddFoodSheet, AddGoalSheet, review modals, CategoryPickerModal) are a separate cluster and are exempt **only** while closed — §5 AC5 tests the scroll content with all sheets closed.

| File:line | Current | Committed replacement |
|---|---|---|
| `polymath/ExpeditionProgressRow.tsx:23` | `ACTIVE EXPEDITIONS` | internal Label deleted; screen renders `SectionTitle` `Expeditions` above the row |
| `polymath/ChasingNowCard.tsx:40` | `CHASING NOW` | dies in the row re-skin (§3.2 item 3) |
| `polymath/FrontierCard.tsx:35` | `THE FRONTIER` | `Body` `fontFamily: fonts.bodyMedium` color `c.polymath`: `The frontier` |
| `polymath/CrossDisciplineCard.tsx:25` | `CROSS-DISCIPLINE` | same treatment: `Cross-discipline` |
| `polymath/ConstellationView.tsx:42` | `YOUR CONSTELLATION` | `SectionTitle` `Constellation`; the nodes/synapses/depth stats keep mono numerals as a `Caption` line under the title |
| `health/MealSuggestionsCard.tsx:101` | `MEAL IDEAS` | `SectionTitle` `Meal ideas` |
| `health/BloodReportCard.tsx:26` | `BLOOD REPORT` | `SectionTitle` `Latest report` |
| `health/FitDashboard.tsx:107` | `TODAY` | `Caption` `Today` in `c.textMuted` |
| `career/CareerStrategyView.tsx:39,45,52,104,143,186` | `REALITY CHECK` / `MINIMUM VIABLE SUCCESS` / `SKILL GAPS` / `DAILY PLAN TEMPLATE` / `WEEKLY OUTPUT` / `FAILURE POINTS` | sentence case as `Body` `fonts.bodyMedium`, keeping each label's current color (`c.error` / `c.career` / `c.warning`) |
| `finance/SubscriptionsBillsCard.tsx:70,98,105` | `SUBSCRIPTIONS & BILLS` / `SUBSCRIPTIONS` / `UPCOMING BILLS` | `SectionTitle` `Subscriptions & bills`; inner labels → `Caption` `Subscriptions` / `Upcoming bills` (this overrides §3.5's "unchanged internally" for the three labels only) |
| `finance/FinanceGoalCard.tsx:52` | `YOUR GOAL` | deleted — the goal-type title below it carries the meaning |
| `finance/MilestoneTracker.tsx:34` | `MILESTONES` | `SectionTitle` `Milestones` |
| `finance/WeeklyInsightCard.tsx:23` | `WEEKLY INSIGHT` | `SectionTitle` `Weekly insight` |
| `social/UpcomingBirthdaysCard.tsx:39` | `UPCOMING BIRTHDAYS` | dies in the `Coming up` re-skin (§3.4 item 2) |

`RecoveryCard` / `WaterCard` / `EnergyCard` / `HealthSummaryCard` / `VitalsCard` CAPS labels die with the row conversions in §3.1 and need no per-label entry.

---

### 3.1 Health — `app/(tabs)/health.tsx`

**THE hero — new component `HealthPulseHero`, `src/components/modules/health/HealthPulseHero.tsx`, slot `testID="health-hero"`.**

The screenshot-able element is the day's energy budget in display type on health green — not a vitals table.

Props: `{ kcalLeft: number | null; kcalEaten: number; kcalTarget: number; proteinLeftG: number | null; readiness: { score: number; hasData: boolean; band: 'low' | 'moderate' | 'high' }; hasBaseline: boolean; onLogMeal: () => void; onAddVitals: () => void }`.

**Populated** (`hasBaseline` true — `heightCm != null && trend.latest != null`, both already computed at health.tsx:223–232):
- Line 1: kcal remaining as `<Text variant="display">` (Nunito-Black 38/40) + `TABULAR_NUMS`, color per §3.0.6 theme-contrast rule (domain token dark / `c.textPrimary` light), e.g. `1,420` (`toLocaleString()`).
- Line 2: `<Text variant="h3">` `kcal left today` in `c.textPrimary`.
- Line 3: `Caption` in `c.textSecondary`: `Protein {p} g to go · {eaten} kcal eaten`, appending ` · Readiness {score}` only when `readiness.hasData`.
- **Over-target state** (`kcalLeft <= 0`, compassion rule — no red, no deficit math): Line 1 = `{kcalEaten.toLocaleString()}`, Line 2 = `kcal logged today`, Line 3 = `Target {target} reached · Protein {p} g to go`.
- CTA: `Button3D` full width, title `Log a meal` → `openAddFood(mealByTimeOfDay)` where mealByTimeOfDay = breakfast before 11:00, lunch before 16:00, dinner before 21:00, else snack (local device time, boundaries exclusive).
- No card chrome: the hero is type on the screen background with a 4px `c.health` left border (structural color, matches the existing module-card 4px convention), `paddingLeft: spacing.md`.

**Empty** (`hasBaseline` false): the hero slot renders
- `<Text variant="h1">` `Start with a baseline.`
- `Body` in `c.textSecondary`: `Height and weight unlock BMI, calorie targets, and recovery-aware planning. They stay on this device.`
- `Button3D` title `Add height & weight` → `setShowEditVitals(true)`.

**Supporting cast, in order (all plain rows, hairline-separated, no Cards):**
1. `SectionTitle` `Today` → rows: **Water** (current `WaterCard` logic re-laid as a row: `Body` `Water` + `{ml} / {goal} ml` mono numerals + `+ glass` action in `c.health`; renders even at 0 ml — the action produces the first value). **Energy** (row `Body` `Energy`; right side = `{n} / 5` mono when logged today, else the action `Log` in `c.health` — no numeral at null). **Readiness** (only when `recovery.hasData`: `Readiness · {score}` + the band word from `recoveryBandLabel(band)` in `src/utils/recovery.ts:47–49` — exactly `Take it easy` / `Balanced` / `Primed`). **Streak rows**: `Food log streak · {n} days` only when `n > 0` AND `gamification !== 'off'`; same for `Workout streak`. Zeros render nothing.
2. `SectionTitle` `Calories` pressable row (replaces the Card header at lines 488–509): title + trailing `Caption` `{eaten} / {target} kcal` + chevron, `minHeight: 56`. Expanded body keeps `CalorieRing`, meals (meal Cards at lines 533–562 become group rows: meal name as `Body`/`fonts.bodyMedium` + add icon, entries as existing `FoodEntryRow`s, hairline between groups), `MealSuggestionsCard` with its §3.0.7 header swap.
3. `SectionTitle` `Blood reports` pressable row (same treatment as Calories; replaces lines 578–598). Body unchanged except `BloodReportCard`'s §3.0.7 header swap.
4. `WeightChart` renders inside the Calories expanded body, after the ring (it is a trend, not an answer — demoted from position 3).
5. `VitalsCard` + `HealthSummaryCard` are **removed from the top** and replaced by a single `Vitals` row under `Today`: `BMI {x} · {w} kg · {h} cm` + `Edit` action in `c.health` (→ `EditVitalsSheet`). When baseline is absent this row does not render (the hero owns that job).
6. `SectionTitle` `Connections` → `ConnectRow` Google Fit (`testID="connect-row-fit"`, copy table §3.0.3). `FitDashboard` renders directly under the row when connected and synced.

**First viewport at 390×844** (content window ≈ 717pt after safe areas + tab bar):
- Empty: ModuleHeader (72) + empty hero (~190 incl. CTA) + `Today` title (52) + Water row (56) + Energy row (56) + `Calories` row (56) ≈ 482. The baseline CTA is fully visible by y≈310 — it survives even with a 56pt banner above.
- Populated: ModuleHeader (72) + hero (~200) + `Today` (52) + 3 rows (168) + `Calories` header row (56) ≈ 548. The `Log a meal` CTA is fully visible by y≈330.

**Web parity:** all changes are layout/typography; `expo-haptics` calls stay native-gated; Fit OAuth flow already works on web. No Skia, no native-only APIs. Identical render tree web and native.

---

### 3.2 Explore — `app/(tabs)/explore.tsx`

**THE hero — slot wrapper `View testID="explore-hero"` (always mounted, even when the chain resolves empty), containing `SparkHeroCard` (existing, elevated + restyled in place at `src/components/modules/polymath/SparkHeroCard.tsx`).**

The spark is the only AI-native daily surface in the app's curiosity engine; it becomes position 1, always.

Restyle:
- Delete the `Label` CAPS eyebrow `TODAY'S SPARK` (SparkHeroCard.tsx:37) and the `PULL THE THREAD` CAPS inner label (SparkHeroCard.tsx:42).
- Title becomes `<Text variant="h1">` (Nunito-Black 28/32). Body stays `Body` at `fontSizes.md`.
- The `threadStarter` renders as a quote block: 2px `c.polymath` left border, `paddingLeft: spacing.sm`, `Body` in `c.textPrimary` — no inner box, no caps.
- Card chrome drops to: 4px `c.polymath` left border on screen background (same structural treatment as HealthPulseHero); the `Card` wrapper is removed.
- Action row keeps its four actions (Save / Pull thread / Expedition / Skip); `Pull thread` becomes the visually primary action: filled `c.polymath` pill with `c.inkOnColor` text (`colors.ts:43`); the other three stay outlined.

Gating change: the spark load/generation condition at explore.tsx:228 changes from `isEnabled('domainNudges')` to `isEnabled('domainNudges') || hierarchyV1` (compile flag from `@/config/flags` OR the runtime flag read in §3.0.1) so the hero exists for the rollout cohort.

**Hero fallback chain (committed, no "when available"):** the `explore-hero` wrapper resolves, in order: (1) `SparkHeroCard` when `todaySpark != null`; (2) `Skeleton` of fixed height 96 while generation is pending, animated per `MOTION_BUDGET.shimmer` (900ms half-cycle), with generation wrapped in `Promise.race` against a **10,000ms** timeout — on timeout or rejection the slot re-resolves down the chain; (3) `FrontierCard` when `frontierEnabled && frontier != null`; (4) `EmptyState` (below) when `interests.length === 0`; (5) empty wrapper (height 0) — the supporting cast then starts at `ExpeditionProgressRow`. No skeleton-forever states.

**Empty state** (zero interests, no spark): hero slot = `EmptyState`:
- icon `compass-outline`, accent `c.polymath`
- title `Follow one spark.`
- caption `Add an interest — a skill, a hobby, a question — and Explore maps where your curiosity goes.`
- cta `{ label: 'Add an interest', onPress: () => setShowAdd(true) }`

**Supporting cast, in order:**
1. Hero (chain above).
2. `SectionTitle` `Expeditions` + `ExpeditionProgressRow` (internal CAPS label deleted per §3.0.7) — both render only when `expeditionData.length > 0`.
3. Chasing-now threads: `ChasingNowCard` re-skinned to plain rows — question as `Body`/`fonts.bodyMedium`, `Pull →` action in `c.polymath`; renders under `SectionTitle` `Chasing now` only when threads exist.
4. Week stat **line** replacing the "THIS WEEK / 0 min" Card (delete explore.tsx:598–604): a single `Body` row, `This week: {n} min across {k} interests` with `TABULAR_NUMS`, color `c.textSecondary` — renders **only when `totalMinutesWeek > 0`** (zero-suppression).
5. `FrontierCard` / `CrossDisciplineCard` (one or the other per existing flag logic, §3.0.7 eyebrow swaps applied), demoted below the stat line. When FrontierCard occupied the hero slot via the fallback chain it does not render twice.
6. `ConstellationView`: renders only when `constellationInput` carries ≥ 3 nodes (interests + saved sparks + expeditions); below that threshold it returns `null` — the current empty-placeholder Card (ConstellationView.tsx:28–37) is deleted. The constellation has no placement protection and earns its slot by content. (The founder's placement-freeze applies to the hex radar on Today only — see the out-of-scope statement at the top of this spec.)
7. `SectionTitle` `Your maps` + existing map rows (already rows; the `YOUR MAPS` `Label` at explore.tsx:658 is the deleted header).
8. `SectionTitle` `Your interests` with `trailing` = existing Add pill (explore.tsx:713–719) → `InterestCard` list.
9. `SectionTitle` `Connections` → `ConnectRow` YouTube (`testID="connect-row-youtube"`, copy table §3.0.3). `YouTubeImportCard`'s promo Card render is deleted; its review modal is kept as the press flow.

**First viewport at 390×844:**
- Populated: ModuleHeader (72) + SparkHero (~280 incl. actions) + Expeditions title + row (~136) ≈ 488. The spark's `Pull thread` action is fully visible by y≈300.
- Empty: ModuleHeader (72) + EmptyState (~300 incl. CTA) + `Connections` title + YouTube ConnectRow (~108) ≈ 480. `Add an interest` CTA fully visible by y≈330; the YouTube row is visible but **below** the primary CTA — import is the secondary on-ramp.

**Web parity:** YouTube row is web-only (existing gate at YouTubeImportCard.tsx:42). Everything else is RN-web-safe; the constellation and map silhouettes already render via `react-native-svg`, which works on web. Identical render tree web and native apart from the gated row.

---

### 3.3 Career — `app/(tabs)/career.tsx` (value before form)

**THE hero — new component `CareerPathHero`, `src/components/modules/career/CareerPathHero.tsx`, slot `testID="career-hero"`.**

The questionnaire leaves the screen body entirely and moves into a sheet. The screen leads with value in all three data states:

**State A — zero career data (no analysis, no saved paths):**
- `<Text variant="h1">` `Your next role has a route.`
- `Body` in `c.textSecondary`: `Name the destination. LifeOS maps the skill gaps, the learning path, and the weekly artifacts that get you there.`
- Sample route block (static const `SAMPLE_ROUTE` in the component — curated, no AI call, no PII):
  - `Caption` in `c.textMuted`: `Sample route · Senior Engineer → Staff Engineer · 12 wk`
  - Three plain rows, each `Body` with a `c.career` 2px left border and `paddingLeft: spacing.sm`:
    - `Wk 1 — Ship a system-design one-pager`
    - `Wk 5 — Lead a cross-team design review`
    - `Wk 12 — Case study: a measurable production win`
- CTA: `Button3D` full width, title `Map my path` → opens `CareerSetupSheet`.

**State B — saved paths exist, none loaded:** the hero shows the most recent `SavedCareerPath` instead of the sample: h1 `{currentRole} → {targetRole}`, `Caption` `Saved {new Date(savedAt).toLocaleDateString()} · {timelineMonths / 12} yr`, primary CTA `Resume this path` (→ `loadPath`, career.tsx:252–260), secondary text action `Start a new one` in `c.career` (→ opens `CareerSetupSheet`).

**State C — analysis loaded:** the hero is the elevated path block replacing career.tsx:407–432: h1 `{currentRole} → {targetRole}`, progress percentage as `<Text variant="display">` + `TABULAR_NUMS` colored per §3.0.6 theme-contrast rule (the existing real-progress computation at lines 413–430 moves into the component verbatim), `ProgressBar` with `DOMAIN_GRADIENTS.career` (`colors.ts:53`), `Caption` `{pct}% of the way there`. The CAPS `YOUR PATH` label (line 409) is deleted. Chrome: 4px `c.career` left border on background, no Card.

**New component `CareerSetupSheet`, `src/components/modules/career/CareerSetupSheet.tsx`:**
- RN `Modal`, `transparent`, slide-from-bottom; surface `c.surface`, `borderTopLeftRadius/borderTopRightRadius: radii.card` (22, `src/theme/radii.ts:7`), `maxHeight: '90%'`, `KeyboardAvoidingView` as in the save-modal pattern at career.tsx:624.
- Contains the **entire** existing setup form verbatim (both `Input`s with rotating placeholders, timeline pills, skills tag input, error display from lines 296–387) plus, as a second segment reached after analysis succeeds, the strategy inputs (timeframe / weekly hours / constraints) currently inlined at lines 455–523.
- Footer: `Button3D` `Analyse my career path` (disabled rule unchanged: `!currentRole.trim() || !targetRole.trim() || loading`). On success: close sheet (`MOTION_BUDGET.sheetExit` 520) → results render with the hero entering at `MOTION_BUDGET.hero`.
- Sheet trigger points: hero CTA (states A and B) and the `Edit path` text action in state C's supporting cast.
- Web parity: RN `Modal` + `KeyboardAvoidingView` behave on react-native-web (same primitives as the existing save-path modal at career.tsx:618–660).

**Save-path modal extraction (required for AC3 to be mechanical):** the save modal (career.tsx:617–661) moves verbatim into `src/components/modules/career/SavePathModal.tsx`. After this and the sheet extraction, `career.tsx` imports neither `TextInput` nor `Input`.

**Supporting cast (state C), in order — CAPS labels die, the ad-hoc `sectionTitle` Body style dies:**
1. Hero.
2. `SectionTitle` `Skill gaps` → `SkillGapChart` (unchanged).
3. `SectionTitle` `Learning path` → `LearningResourceCard` rows (unchanged).
4. `SectionTitle` `12-week plan` → `CareerStrategyView` when strategy exists (with its §3.0.7 sentence-case sweep); otherwise a single `Body` row `Turn this into weekly artifacts` + `Generate plan` action in `c.career` → opens the sheet's strategy segment. The inline ELITE STRATEGIST form Card (lines 455–523) is deleted from the screen body.
5. Action row: `Save path` / `Clear` (unchanged behavior; `Save path` opens `SavePathModal`).
6. `SectionTitle` `Saved paths` with `count={savedPaths.length}` → saved-path rows (existing Cards at lines 579–611 lose their Card wrapper; row + hairline).
7. `MotivationBanner` (career.tsx:400–404) is deleted from this screen (a second voice above the fold violates one-hero).

No `Connections` section on Career (no integration exists).

**First viewport at 390×844:**
- Empty (state A): ModuleHeader (72) + hero h1+body (~120) + sample block (~150) + CTA (~72) ≈ 414. `Map my path` fully visible by y≈420 — and the user has seen concrete value (three artifacts) before any input is requested.
- Populated (state C): ModuleHeader (72) + hero (~210) + `Skill gaps` title (52) + chart top (~120 visible) ≈ 454.

**Web parity:** all primitives (Modal, KeyboardAvoidingView, Input, Button3D) already run on react-native-web in this file today; the recomposition adds no platform-split code.

---

### 3.4 Social — `app/(tabs)/social.tsx`

**THE hero — new component `ReconnectHero`, `src/components/modules/social/ReconnectHero.tsx`, slot `testID="social-hero"`.**

The answer on Social is a person, not a score.

Props: `{ contact: Contact | null; daysSince: number | null; inCadenceCount: number; onOpen: (id: string) => void; onSnooze: () => void }` — `contact` = head of the existing most-overdue sort (social.tsx:62).

**Overdue exists:**
- `<Text variant="h1">` `{firstName} would love to hear from you.` — `firstName` = `contact.name.split(' ')[0]`. Compassion rule: the words `overdue`, `late`, `neglected`, `behind`, `forgot`, and any digit are banned from this h1; the unit test asserts `/\d/` never matches the h1 text.
- `Caption` in `c.textSecondary`: `{RELATIONSHIP_META[tier].label} · last contact {n} {unit} ago` (mono numerals; `unit` = `days` below 60 days, else `months` with `n = Math.round(days / 30)`).
- Primary CTA: filled `c.social` pill, `c.inkOnColor` text, title `Say hello` → `router.push({ pathname: '/contact/[id]', params: { id } })`.
- Quiet action: `Not today` as `Caption` in `c.textMuted` → `onSnooze` hides the hero until the next local day. **Snooze persistence:** new store `src/store/useHeroSnoozeStore.ts` — zustand `persist` + `createJSONStorage(() => Platform.OS === 'web' ? window.localStorage : AsyncStorage)` (the exact pattern of `useFitSyncStore.ts:16–37`; `usePreferencesStore` is rejected for this because its hand-rolled persistence is web-only — `usePreferencesStore.ts:41,55` — and the snooze must survive native restarts). Shape: `{ snoozed: Record<string, string> }` (domain → `yyyy-MM-dd` local date) + `snooze(domain)` + `isSnoozedToday(domain)`. Storage key `lifeos_hero_snooze_v1`. No re-prompt, no badge, no timer (compassion rule).
- Chrome: type on background with 4px `c.social` left border (same structural pattern as the other heroes).

**No overdue (rest quiet):** single line, no card, no CTA: `<Text variant="h3">` `You're in cadence with everyone.` + `Caption` `{inCadenceCount} people in your orbit` (`inCadenceCount = contacts.length - overdue.length`).

**Empty (zero contacts):** hero slot = `EmptyState` — icon `people-outline`, accent `c.social`, title `Build your inner orbit` (existing copy kept), caption kept, **plus** `cta: { label: 'Add someone', onPress: () => setAddOpen(true) }` and `trustNote: 'Names stay on this device — nothing is uploaded.'`. The free-floating caption at social.tsx:100–102 is deleted in every state (its job moves into the trustNote).

**Supporting cast, in order:**
1. Hero.
2. `UpcomingBirthdaysCard` re-skinned as `SectionTitle` `Coming up` + plain rows (`Ionicons gift-outline`, both `'🎂'` literals deleted per §3.0.5); renders only when an upcoming birthday exists.
3. Social health stat row replacing `SocialScoreCard` as a top card: one row — `Body` `Social health` + right-aligned `{score} /100` mono numerals + a 4px-tall `ProgressBar` underneath (`DOMAIN_GRADIENTS.social`), full saturation. Renders only when `score !== null && score > 0` (zero-suppression: at 0 the `Reach out` rows are the action that moves it).
4. `SectionTitle` `Reach out` → remaining overdue `ContactRow`s (the hero's contact excluded). This replaces the `SectionLabel` "Overdue" header at social.tsx:125 — the word `Overdue` does not appear in any rendered string on this screen.
5. Tier sections: `SectionTitle` `{RELATIONSHIP_META[tier].label}` → `ContactRow`s (replacing `SectionLabel` at line 144).
6. `SectionTitle` `Connections` → `ConnectRow` Google Contacts (`testID="connect-row-contacts"`, copy table §3.0.3); `ContactsImportCard`'s promo render is deleted, its review modal kept as the press flow.
7. FAB unchanged.

**First viewport at 390×844:**
- Populated: ModuleHeader (72) + ReconnectHero (~190) + `Coming up` title + 1 row (~108) + score row (~64) ≈ 434. `Say hello` fully visible by y≈300.
- Empty: ModuleHeader (72) + EmptyState w/ trustNote + CTA (~330) + `Connections` + ConnectRow (~108) ≈ 510. `Add someone` is the first interactive element; the import row is present but subordinate.

**Web parity:** Contacts row is web-only (existing gate at ContactsImportCard.tsx:51); everything else platform-neutral; the snooze store persists on both platforms by construction.

---

### 3.5 Finance — `app/(tabs)/finance.tsx`

**THE hero, slot `testID="finance-hero"` (rendered inside the Overview tab, directly under the inner tab bar).** Two cases:

**Disconnected (Overview/Transactions, web):** the existing connect block (lines 681–696) is the keeper and already sits first. It is migrated to the shared `EmptyState`:
- icon `mail-outline`, accent `c.finance`
- title `Connect your inbox`
- caption `LifeOS reads HDFC, ICICI, and Axis bank alert emails to categorise spending and surface behavioural insights.`
- trustNote `Only transaction emails are scanned — nothing is uploaded.`
- cta `{ label: 'Connect Gmail', onPress: onConnect }`
The hand-rolled `connectCard`/`connectIcon`/`connectTitle`/`connectBody`/`connectBtn` styles are deleted. Native (non-web) replaces the block at lines 667–679 with `EmptyState`: icon `information-circle-outline`, title `Finance lives on the web for now`, caption `Gmail-powered transaction sync runs in the web app. Open LifeOS in your browser to connect.` (the `localhost:8081` developer string is deleted from user-facing copy).

**Connected (Overview):** the hero is the spend headline, promoted to position 1 and restyled number-first:
- `<Text variant="display">` `{formatInr(thisMonthSpend)}` + `TABULAR_NUMS`, colored per §3.0.6 theme-contrast rule.
- `<Text variant="h3">` `spent so far this month` in `c.textPrimary`.
- Delta `Caption` unchanged (existing logic, lines 743–755); cashflow strip (In/Out/Net, lines 757–775) stays inside the hero block, mono numerals.
- The CAPS `THIS MONTH SO FAR` label (line 739) is deleted. Chrome: 4px `c.finance` left border on background, no Card.

**Supporting cast (Overview connected), in order:**
1. Hero.
2. Spending-mix bar + legend, directly under the hero with `SectionTitle` `Where it went` (replaces CAPS `SPENDING MIX`, line 783); the Card wrapper drops.
3. Top categories (both the `animatedCharts` and legacy variants) under the same `Where it went` section — `TOP CATEGORIES` CAPS labels (lines 816, 831) deleted; legacy rows keep their press-through to `/finance-category`.
4. Monthly Money Review row (lines 868–883 — already row-shaped, kept; CAPS-free already).
5. Insights: keep the 4px severity left border (structural color, correct per manifesto 3) but drop the Card background — row + hairline; the CAPS `Label` title (line 895) becomes `Body`/`fonts.bodyMedium` in the severity color, sentence case.
6. `SubscriptionsBillsCard` — internals unchanged this pass **except** the three §3.0.7 label swaps.
7. `SectionTitle` `Connections` → Gmail **status** `ConnectRow` (`testID="connect-row-gmail"`, copy table §3.0.3) replacing the sync Card at lines 701–734 — sync plumbing moves from position 1 to last. Sync errors render under the row in `c.error`; `Disconnect Gmail` moves into the row's press target sheet.

**Goals tab:** empty state already uses `EmptyState` with a CTA (lines 1106–1112) — unchanged. The populated Goals tab gets the §3.0.7 swaps plus screen-level CAPS→`SectionTitle`: `TRUE SAVINGS RATE — THIS MONTH` (line 1133) → `SectionTitle` `True savings rate` with the amount as `<Text variant="display">` + `TABULAR_NUMS`; `STRATEGY` (1148) → `Strategy`; `WEEKLY TIPS` (1171) → `Weekly tips`. The inner tab bar (Overview/Transactions/Goals, lines 513–530) is kept as-is.

**First viewport at 390×844 (web):**
- Disconnected: ModuleHeader (72) + tab bar (~56) + EmptyState keeper (~360 incl. CTA) ≈ 488. `Connect Gmail` fully visible by y≈430.
- Connected: ModuleHeader (72) + tab bar (~56) + hero (~210) + `Where it went` + full mix bar (~140) ≈ 478. The month's number is the screenshot; the first pressable category row sits at ~y≈540.

**Web parity:** Finance is web-primary by design (Gmail sync); the native build renders the `Finance lives on the web for now` EmptyState. No other platform splits are added.

---

## 4. Dilution traps

1. **The legacy path never dies.** Flag-gated recomposition means the old card sludge stays in the file "until rollout finishes" — forever. **Counter-rule:** the PR adding `module_hierarchy_v1` also files the deletion task with a named owner and a graduation criterion (flag at 100% for 14 days); the legacy branch is a single `if (!hierarchyV1) return <XScreenLegacy/>` with the legacy tree extracted to a `*.legacy.tsx` sibling so deletion is one file per screen, not surgery.
2. **The Career form sneaks back inline** ("users won't find the sheet"). **Counter-rule:** zero `Input`/`TextInput` may exist in `career.tsx` at all (the save modal is extracted to `SavePathModal.tsx` precisely so this is file-level); the guard test `app/(tabs)/__tests__/hierarchyGuards.test.ts` fails on any match of `/TextInput|from '@\/components\/ui\/Input'/` in `career.tsx`.
3. **ConnectRow ships, but as a card.** Someone re-adds a `Card` wrapper, tinted background, or moves it above content "for conversion." **Counter-rule:** `ConnectRow` exposes no `style` prop (chrome is internal and closed), the layout contract states Connections is the **last** `SectionTitle` on every screen, and e2e asserts every `connect-row-*` testID has a greater y-offset than its screen's `{screen}-hero` testID.
4. **Hero accents ship at 60% opacity / `+ '20'` tints** "to be safe on OLED." **Counter-rule:** hero numerals and left borders use the raw domain token with no alpha suffix; the guard test fails on the regex `/c\.(health|career|social|finance|polymath)\s*\+\s*'/` in the five hero component files.
5. **Light mode "fixes" re-add card chrome.** Light-theme contrast on bright domain hues becomes the excuse to wrap heroes in Cards again. **Counter-rule:** the §3.0.6 theme-contrast rule (numerals = `c.textPrimary` on light, domain token on dark; border = domain token always) is the one sanctioned fix; any `Card`/background addition to a hero file fails review against this spec.
6. **The named person becomes a count.** Social's hero gets "softened" to `You have 2 overdue contacts`. **Counter-rule:** `ReconnectHero` h1 interpolates `contact.name` — the component has no count-based copy path, and the unit test asserts the h1 contains no digit; counts live only in the stat row.
7. **Zeros creep back.** A well-meaning fix re-renders "0 min" or the streak zeros "so the layout doesn't jump." **Counter-rule:** zero-suppression is enforced in component logic (`if (n <= 0) return null`), with unit tests asserting null render at 0 for the week stat line, both Health streak rows, and the social score row.
8. **SectionTitle ships but CAPS returns in new code — or survives inside child cards.** The screens go sentence-case while `MEAL IDEAS`, `YOUR CONSTELLATION`, `REALITY CHECK` keep shouting from inside cards in the same viewport. **Counter-rule:** the §3.0.7 kill table lands with its screen's PR, and the guard test fails on `/SectionLabel/` in the five screen files **and** on any all-caps text literal of length ≥ 4 matching `/>[A-Z0-9 '&—·-]{4,}</` in the §3.0.7 component files.
9. **The hero testIDs get "cleaned up"** during a refactor, silently breaking the order assertions. **Counter-rule:** the e2e order test (§5 AC1/AC6) fails the build if any of the five `{screen}-hero` or four `connect-row-*` testIDs is absent — absence is a failure, not a skip.

---

## 5. Acceptance criteria (binary — verify with `module_hierarchy_v1` forced on via the §3.0.1 route stub, 390×844 web viewport, dark theme unless stated, both empty and seeded fixtures)

1. On each of the five screens, an element with `testID="{screen}-hero"` exists and its bounding-box top is the smallest of all elements below the `ModuleHeader`, in both empty and seeded states (Explore's wrapper qualifies at height 0 in the quintuple-fallback state). Missing testID = fail.
2. Within the first viewport (bounding box entirely above y=717), the following element is fully visible per screen/state: Health empty `Add height & weight`; Health seeded `Log a meal`; Explore empty `Add an interest`; Explore seeded the `Pull thread` pill; Career empty `Map my path`; Career seeded the `Skill gaps` SectionTitle; Social empty `Add someone`; Social seeded `Say hello`; Finance disconnected `Connect Gmail`; Finance connected the complete spending-mix bar.
3. `career.tsx` (non-legacy) contains zero occurrences of `TextInput` and zero imports of `@/components/ui/Input` (guard test); on mount with no analysis, `CareerSetupSheet` is closed and no text input is focused or visible.
4. Career in the zero-data state renders, before any tap, the exact strings `Sample route · Senior Engineer → Staff Engineer · 12 wk`, `Wk 1 — Ship a system-design one-pager`, `Wk 5 — Lead a cross-team design review`, and `Wk 12 — Case study: a measurable production win`.
5. With all sheets/modals closed, in both data states, none of these strings appears in any screen's rendered output: `IMPORT FROM YOUTUBE`, `IMPORT FROM GOOGLE CONTACTS`, `GOOGLE FIT`, `GMAIL CONNECTED`, `THIS MONTH SO FAR`, `SPENDING MIX`, `TOP CATEGORIES`, `TRUE SAVINGS RATE`, `STRATEGY`, `WEEKLY TIPS`, `NEW CAREER PATH`, `ELITE STRATEGIST`, `YOUR PATH`, `TODAY'S SPARK`, `PULL THE THREAD`, `THIS WEEK`, `YOUR MAPS`, `YOUR INTERESTS`, `YOUR CONSTELLATION`, `ACTIVE EXPEDITIONS`, `CHASING NOW`, `THE FRONTIER`, `CROSS-DISCIPLINE`, `STREAKS`, `CALORIE TRACKING`, `BLOOD REPORTS`, `MEAL IDEAS`, `BLOOD REPORT`, `SUBSCRIPTIONS & BILLS`, `MILESTONES`, `WEEKLY INSIGHT`, `UPCOMING BIRTHDAYS`, `Overdue`.
6. Every `connect-row-*` testID present on a screen renders under a `Connections` SectionTitle that is the last SectionTitle in the scroll content, and its y-offset exceeds that screen's `{screen}-hero` y-offset (e2e assertion; absent testID = fail).
7. The guard test `app/(tabs)/__tests__/hierarchyGuards.test.ts` passes, and it asserts all of: no `SectionLabel` in the five screens; no `TextInput`/`Input` import in `career.tsx`; no character in the Unicode range U+1F300–U+1FAFF in the five screens plus the §3.0.7 and hero component files; no match of `/c\.(health|career|social|finance|polymath)\s*\+\s*'/` in the five hero files; no new 3/6/8-digit hex color literal in files created by this cluster outside `src/theme/`.
8. With an empty fixture, the strings `0 min`, `0 /100`, and any streak row containing ` 0 ` are absent from the accessibility tree on all five screens, asserted by unit tests that render the week-stat line, both Health streak rows, and the social score row at value 0 and expect `null`.
9. Social with exactly one overdue contact renders that contact's first name inside the hero h1, the h1 matches `/^\S+ would love to hear from you\.$/` and contains no digit; after tapping `Not today`, the hero is absent on refocus and after a full page reload within the same local day, and present again when the device date advances one day.
10. With Playwright `page.emulateMedia({ reducedMotion: 'reduce' })`, two full-page screenshots of each screen taken 600ms apart (after network idle) are pixel-identical — zero entering or ambient motion.
11. With `usePreferencesStore.gamification === 'off'` and a seeded fixture, the strings `streak` and `XP` (case-insensitive) appear nowhere in the five screens' rendered output.
12. With `module_hierarchy_v1` off, Jest snapshots of all five `*.legacy.tsx` trees match snapshots recorded from the pre-recomposition screens in the foundation PR — byte-identical.
13. Finance disconnected (web) renders the `lock-closed-outline` icon adjacent to the exact string `Only transaction emails are scanned — nothing is uploaded.`, sourced via the `trustNote` prop; Finance native renders the exact title `Finance lives on the web for now`.
14. With the AI proxy route blocked (`**/claude` fulfilled with 500), Explore's hero slot settles to FrontierCard, EmptyState, or empty wrapper within 10.5s of focus, and no `Skeleton` remains mounted after settle.
15. On the light theme, every hero display numeral's computed color equals `lightColors.textPrimary` (`#140828`), and every hero's 4px left border equals its domain token — asserted per hero by a render test toggling `useThemeStore`.

---

## 6. Effort estimates

| Piece | Effort |
|---|---|
| `module_hierarchy_v1` flag + `*.legacy.tsx` extraction + legacy snapshots (5 screens) | M |
| `SectionTitle` component + `hierarchyGuards.test.ts` (replaces ESLint — repo has none) | S |
| `ConnectRow` component (closed chrome, testID contract) | S |
| `EmptyState.trustNote` prop | S |
| `useHeroSnoozeStore` (zustand persist, both platforms) | S |
| `YouTubeImportCard` / `ContactsImportCard` refactor onto ConnectRow (keep modals) | M |
| Child-card CAPS kill table (§3.0.7, 14 files, mechanical) | M |
| Health: `HealthPulseHero` + row conversion + collapsible header restyle | L |
| Explore: SparkHero restyle + fallback chain + reorder + stat-line + constellation threshold + gating change | M |
| Career: `CareerPathHero` (3 states) + `CareerSetupSheet` + `SavePathModal` extraction + recomposition | L |
| Social: `ReconnectHero` + snooze store + score-row demotion + reorder | M |
| Finance: EmptyState migration + hero restyle + sync-row demotion + CAPS sweep | M |
| Zero-suppression unit tests + e2e viewport/order/reduced-motion assertions | M |
| Copy/QA pass (both themes incl. AC15, reduce-motion, gamification-off, web + native smoke) | M |

Sequencing: shared foundation (flag + legacy extraction + snapshots, SectionTitle, ConnectRow, EmptyState, snooze store, guard test) lands first as one PR; screens land one PR each behind the flag, any order, each carrying its §3.0.7 rows; tests land with their screen. The flag-graduation deletion task is filed in the foundation PR.

---

## Dilution audit log

1. **Wrong line number (vagueness):** spark gating cited as explore.tsx:229 — verified actual `isEnabled('domainNudges')` at explore.tsx:228; fixed, and pinned the compile-flag default to `src/config/flags.ts:49`.
2. **Missed emoji instance:** spec killed `🎂` at ContactsImportCard.tsx:248 only; `UpcomingBirthdaysCard.tsx:43` has a second literal — added to §3.0.5 and §1, with a committed Ionicons replacement (`gift-outline`, 16, `c.social`).
3. **Unenforceable enforcement (escape hatch):** "Add an ESLint `no-restricted-imports` entry" — the repo has no ESLint config or lint script (verified). Replaced everywhere with a concrete Jest source-guard test `app/(tabs)/__tests__/hierarchyGuards.test.ts` (precedent: `syncReadContract.test.ts`), with exact regexes (§3.0.2, trap 2/4/8, AC7).
4. **Vague test harness:** "`setFlagOverride` equivalent in the web harness" — no such function exists; committed to the proven Playwright `ctx.route('**/v1/config**', …)` stub, citing `e2e/sync-cross-device.spec.ts:54–62`, with the exact fulfillment body (§3.0.1).
5. **Broken persistence decision:** snooze stored in `usePreferencesStore` — its hand-rolled persistence is web-only (`usePreferencesStore.ts:41,55`), so native snoozes would not survive restarts. Committed to a new `useHeroSnoozeStore` on the `useFitSyncStore` zustand-persist pattern, key `lifeos_hero_snooze_v1` (§3.4); AC9 now tests reload survival.
6. **Self-contradicting AC (Career):** AC3 banned `TextInput` in career.tsx while the spec kept the save-path modal (which contains one at career.tsx:632) in the file. Committed extraction of `SavePathModal.tsx`, making the ban file-level and mechanical (§3.3, trap 2, AC3).
7. **Hedge in hero fallback:** "renders the FrontierCard (when available)" + "1.8s shimmer then resolve or yield" — shimmer conflated with a timeout (`MOTION_BUDGET.shimmer` is 900ms half-cycle, verified). Committed a 5-step fallback chain with a 10,000ms `Promise.race` timeout and a fixed 96pt Skeleton (§3.2); added AC14.
8. **AC1 unverifiable for Explore:** "no sibling renders above it in either data state" broke when the hero chain resolves empty. Committed an always-mounted `explore-hero` wrapper (height 0 when empty) so AC1 is structural on all five screens.
9. **Implementer-choice icon slot:** ConnectRow `icon: ReactNode // Ionicons or brand mark` — narrowed the type to `keyof typeof Ionicons.glyphMap` and committed all seven icons in the copy table (§3.0.3).
10. **Underspecified status strings:** Fit `Synced {n}d of data · {steps} steps` — window is hard-coded 14 (`syncFitDailyData(clientId, 14)`, health.tsx:182); committed `Synced 14d · {steps} steps` with `toLocaleString()`, and pinned Gmail's `skipped` suffix condition.
11. **Vague row copy ("one-word state"):** Readiness row now uses `recoveryBandLabel` verbatim — `Take it easy` / `Balanced` / `Primed` (`src/utils/recovery.ts:47–49`).
12. **Missing hero state:** Health hero had no over-target (kcalLeft ≤ 0) spec — would invite ad-hoc red "over budget" copy. Committed a compassion-compliant state with exact strings (§3.1).
13. **Zero-suppression ambiguity:** Energy/Water at 0 vs "slot disappears" — committed: Water and Energy rows always render because they carry the first-value action; null Energy shows `Log`, no numeral; social score row renders only at `score > 0` (§3.1, §3.4).
14. **Missing dilution trap — child-card CAPS:** the spec killed screen headers while 14 verified child components (`MEAL IDEAS`, `YOUR CONSTELLATION`, `REALITY CHECK`, `SUBSCRIPTIONS & BILLS`, `THE FRONTIER`, `ACTIVE EXPEDITIONS`, …) kept CAPS inside the same viewports. Added the §3.0.7 kill table with file:line and committed replacements, trap 8, and folded into AC5's expanded string list.
15. **Missing dilution trap — light-theme chrome regression:** bright domain hues fail large-text contrast on the light background (`#7EE0B8` on `#F7F4FC`), which would trigger "put the Card back" fixes. Committed the theme-contrast rule (§3.0.6), trap 5, and AC15.
16. **testIDs assumed but never mandated:** ACs referenced `{screen}-hero` / `connect-row` testIDs that no spec section required. Added the testID contract to §3.0.1 and trap 9; absence is now a test failure, not a skip.
17. **Constraint statement hardening (hex radar):** the placement-freeze lived inside an Explore bullet only. Promoted to a top-of-spec out-of-scope clause with the verified location (`app/(tabs)/index.tsx:522–530`) and a review-rejection rule.
18. **Compassion copy made testable:** banned-word list for ReconnectHero extended (`overdue/late/neglected/behind/forgot` + any digit) with a regex AC (AC9); confirmed the visible `Overdue` section header is renamed `Reach out` and added `Overdue` to AC5's banned strings.
19. **Native Finance copy leak:** existing native notice exposes `localhost:8081` to users; the committed replacement copy deletes it (§3.5).
20. **AC2 had a judgment call for Finance connected** (no CTA exists in its hero): replaced the generic "an interactive element that advances the domain" with a per-screen/state element table — every row now yes/no.
21. **Banned-word sweep (sections 3–6):** zero instances of "consider/could/maybe/potentially/we might" remain; "Explore" survives only as the tab's proper name and inside one committed copy string; remaining hedges ("when available", "or", "equivalent") eliminated by the decisions above.
22. **Flag-key safety made explicit:** asserted with code evidence why `lifeos_flags_v3` needs no bump (`Boolean(undefined) === false`, useFlagStore.ts:127) so nobody "fixes" it into a v4 bump that wipes persisted flags.
23. **Reduced-motion AC made mechanical:** "settled layout in a single frame" → two screenshots 600ms apart, pixel-identical, under `page.emulateMedia({ reducedMotion: 'reduce' })` (AC10).
24. **Tokens-only enforcement added:** new-file hex-literal guard (AC7) closes the "just this one hex" vector; border widths 4/2 documented as the existing module-card structural convention rather than free values.
