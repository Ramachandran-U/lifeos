# Cluster 3: Ink + Signal color recommit

> **Ratified amendments (founder, 2026-06-10 — cross-spec resolutions, see 00-INDEX.md):**
> R3: this spec's deletion of `DOMAIN_GRADIENTS` + the `gradientColors` prop governs — all progress fills are solid domain hue on `c.track` (supersedes 04's gradient fills).
> R4: this spec's per-mode `*Text` tokens govern hero numerals in both themes (supersedes 04 AC15's `#140828` literal).
> R9: a 4px domain rail is legal only on a screen's single hero, where the hue also carries ink or the CTA; everywhere else uses the R3 glyph mark.
> R10: GlassCard's `accent` prop removal stands — 02's FirstWinCard renders neutral.
> R11: 04's ban on `—` placeholder vitals supersedes this spec's ModuleHeader stat placeholder — the Health header stat slot is omitted until a real BMI exists.

All claims verified against the repo. Writing the hardened spec now.

# COLOR SYSTEM RECOMMIT — "Ink + Signal"
**Cluster spec · supersedes `docs/aurora-refined-v2/` color guidance · LifeOS, repo `c:\personal\Project X\lifeos-w3`**

---

## 1. Current state

**Palette (`src/theme/colors.ts`).** The shipped palette is not the violet `#5B4FE8` system described in CLAUDE.md — it is the "Aurora Glass" pastel set: `goal #C9A0FF, health #7EE0B8, finance #F4C16A, career #7FB8FF, social #FF99C5, polymath #FFD66B, primary #A584FF` on a violet-cast near-black `background #0A0612` (lines 16–44, 62–76). Every domain hue is a pastel at 60–85% perceived saturation; goal-orange and polymath-cyan are gone entirely (goal is now lilac, polymath is a second gold — finance `#F4C16A` and polymath `#FFD66B` are near-duplicates, visible in the screenshots where Finance and Explore read as the same color). The original full-saturation hues survive only as a fossil in `src/components/shared/ambient/useAmbientState.ts:24` (`ALL_DOMAIN_HUES = ['#FF6B35','#00C896','#F0B429','#5B4FE8','#FF4D8B','#00B4D8']`).

**Contrast.** `darkColors.textMuted = rgba(244,239,255,0.38)` (colors.ts:71) computes to **3.23:1** on `background` and **3.31:1** on the effective card surface (`rgba(255,255,255,0.04)` composited over `#0A0612` ≈ `#14101B`) — a hard WCAG AA failure, used at caption size everywhere (`GoalCard.tsx:45`, `SocialScoreCard.tsx:29,33`, the sign-in register prompt at `sign-in.tsx:239`, eyebrows). `lightColors.textMuted = rgba(20,8,40,0.52)` (colors.ts:98) computes to **3.87:1** on white — also failing. A third failure class hides in `Button.tsx:41,44`: the `primary` and `danger` variant labels are hardcoded `'#FFFFFF'` string literals, not tokens. Everything else passes.

**Aurora wash.** Two background systems run. `AuroraBackground.tsx` (time-of-day blooms from `ambient/presets.ts` + `GradientMesh` + `ParticleField` + `EnergySweep`, testIDs `aurora-bg` / `ambient-mesh` / `ambient-particles` / `ambient-sweep`) is rendered in **38 files**: 8 of the 10 tab screens (`index`, `goals`, `health`, `finance`, `career`, `social`, `explore`, `rewards` — `life.tsx` and `profile.tsx` do not mount it), all 11 onboarding screens, 18 detail/stack routes, `RabbitHoleScreen.tsx`, and the reduce-motion fallback inside `AuroraAnimatedBackground.tsx:182`. `AuroraAnimatedBackground.tsx` (four blurred blobs, 60px blur) is mounted on the three `(auth)` screens. The audit-confirmed result is visible in the screenshots: in-app the wash is a barely-perceptible smudge behind near-black (audit-today.png, audit-social.png), while sign-in is a fully different product — light pastel lavender/blue field (audit-signin.png). Two glass-card primitives add per-card decoration: `Card.tsx` (3px left border line 39, web `${moduleColor}22` radial corner glow lines 54–70, `BlurView`/`backdropFilter` lines 36–38 and 46–53) and `GlassCard.tsx` (same pattern via its `accent` prop: border lines 53–58, glow lines 85–100, blur lines 66–84). `presets.ts:1` says "tuned for VISIBLE atmospheric presence" — the wash has already been re-tuned upward once and still fails; the idea is dead, not the tuning.

**Structural color.** Domain hues appear as: 3px left borders (`borderLeftColor` — 24 occurrences across 21 files, including `Card.tsx` and `GlassCard.tsx`), `moduleColor=` JSX usages (43 occurrences across 30 files, one of them `primitives.test.tsx`), `accent=` GlassCard usages (17 occurrences across 9 `app/` files), `color + '20'` tinted circles (`ModuleHeader.tsx:20`), two-stop pastel gradients (`DOMAIN_GRADIENTS`, defined colors.ts:49–58, 20 occurrences across 8 files; the `gradientColors` prop lives in `ProgressBar.tsx:18` and `XpBar.tsx:12`), and LABEL-CAPS eyebrows. No screen uses a hue as a load-bearing surface. The Health header (audit-health.png) is a white title beside a 12%-tinted green circle; the Social score `60/100` is white text in a pink-edged glass card (`SocialScoreCard.tsx`). A violet leak hides in `src/utils/goalTypeColor.ts:15`: goal type `personal` maps to `c.primary`, so violet renders as domain content on every personal goal card. Color is everywhere and means nothing.

**Flags.** Compile-time registry `src/config/flags.ts` (all default false except `priorityAdjust`); runtime flags in `src/store/useFlagStore.ts` `FALLBACK_FLAGS` (`agent_what_next` at line 44). Celebration engine is `celebrationEngine` (flags.ts:37, M2). The repo's own precedent (flags.ts:32): *"Token migration itself is unflagged (behaviour-preserving)."* `colors.ts:111` exports a **static, non-reactive** `colors` constant consumed by tab layout and splash — a fact that decides the migration strategy (§Spec F).

---

## 2. Options considered

**Option A — Recalibrate Aurora in place.** Keep the violet-cast base `#0A0612` and the existing six hue names, push saturation up ~30%, fix the two failing text tokens, dim the wash further. This is the minimum-diff path and preserves `docs/aurora-refined-v2/` as canon. Rejected: it is the dilution outcome this spec exists to prevent — the wash stays (at yet another opacity), sign-in stays a second identity, and the palette stays "AI-app violet, but louder." The audit already rated the recalibrated system 6/10.

**Option B — Ink + Signal, hard recommit (Linear/Phantom school).** True-black `#000000` OLED base with a neutral (zero-violet-cast) gray scale; six domain hues restored to full saturation as *the only* chroma in the app; violet demoted from atmosphere to a restricted brand signal; every ambient wash deleted; aurora language survives solely inside the celebration layer; auth front door becomes the app. Structural color = solid hue blocks, solid hue data ink, hue glyph marks — never tints, never gradients, never borders-as-decoration.

**Option C — Two-mode split.** Ink + Signal for the app, keep an aurora "marketing skin" for auth/onboarding as a deliberate contrast ("the dream vs. the tool"). Rejected: this is the *current* bug formalized — the audit named the sign-in/app split "two identities," and onboarding is product, not marketing.

**COMMITTED: Option B.** Everything below is Option B at implementation grade.

---

## 3. The spec

### A. The palette — full replacement of `src/theme/colors.ts`

All ratios below are computed WCAG 2.1 relative-luminance contrast, verified by script against these exact hexes (the same math ships as a unit test, §A.6). Format: *on `background` / on `card`*. rgba tokens are alpha-composited onto their surface before measuring.

#### A.1 Dark palette (primary) — surfaces & text

| Token | New value | Old value | Contrast (vs `#000000` / vs `card #101014`) |
|---|---|---|---|
| `background` | `#000000` | `#0A0612` | — (true-black OLED ground) |
| `surface` | `#0E0E12` | `#120A1E` | sheets/modals |
| `surfaceAlt` | `#17171C` | `#1A1028` | raised/pressed |
| `card` | `#101014` (solid — translucency killed) | `rgba(255,255,255,0.04)` | 1.11 vs ground (visible step without a border) |
| `border` | `rgba(255,255,255,0.10)` | `rgba(255,255,255,0.08)` | hairline only |
| `track` *(new)* | `rgba(255,255,255,0.08)` | — | progress/XP bar track fill — the only legal use |
| `textPrimary` | `#F7F8F8` | `#F4EFFF` | **19.74 / 17.84** |
| `textSecondary` | `rgba(247,248,248,0.72)` | `rgba(244,239,255,0.62)` | **9.99 / 9.45** |
| `textMuted` | `rgba(247,248,248,0.58)` | `rgba(244,239,255,0.38)` ❌ 3.23 | **6.56 / 6.49** (6.34 on `surfaceAlt`) |
| `inkOnColor` | `#0B0B0D` (fixed across both themes) | `#1A0612` | ≥ **6.02** on every accent fill (worst: `primary`) |
| `onPrimary` *(new, per-mode)* | `#0B0B0D` | — | **6.02** on `primary`, **6.70** on `error` — filled-control label ink |
| `overlay` | `rgba(0,0,0,0.72)` | `rgba(0,0,0,0.65)` | scrim |
| `sidebarBg` / `sidebarBorder` | `#0E0E12` / `rgba(255,255,255,0.10)` | `#120A1E` / `rgba(255,255,255,0.08)` | follow `surface`/`border` |

The neutral scale carries **zero hue**. The violet cast in `#0A0612`/`#120A1E` is what made every pastel read as atmosphere; it dies here.

#### A.2 The six domain hues — full saturation, fixed across both themes

| Domain | New hue | Old (pastel) | vs `#000000` | vs `card` | `inkOnColor` on hue |
|---|---|---|---|---|---|
| `goal` | `#FF7733` | `#C9A0FF` | **7.94** | **7.18** | 7.43 |
| `health` | `#00D68F` | `#7EE0B8` | **11.02** | **9.96** | 10.31 |
| `finance` | `#FFB300` | `#F4C16A` | **11.70** | **10.58** | 10.96 |
| `career` | `#4D9FFF` | `#7FB8FF` | **7.72** | **6.98** | 7.23 |
| `social` | `#FF5C97` | `#FF99C5` | **7.23** | **6.54** | 6.77 |
| `polymath` | `#1FC8FF` | `#FFD66B` | **10.76** | **9.73** | 10.08 |

Every hue clears 4.5:1 as text on both base and card with margin — each hue is text-capable in dark mode by construction. Goal returns to orange, polymath returns to cyan (killing the finance/polymath gold collision), career leaves the violet family entirely (blue) so violet can become brand-exclusive. `DOMAIN_GLYPHS` is unchanged (color-blind redundancy stays).

**Dim containers** (rename `*Light` → `*Dim` — 49 occurrences across 18 files including `colors.ts` itself, mechanical): solid hexes = hue at 14% over black. `goalDim #241107`, `healthDim #001E14`, `financeDim #241900`, `careerDim #0B1624`, `socialDim #240D15`, `polymathDim #041C24`, `primaryDim #131124`. Hue-text-on-own-dim: goal 6.85, health 9.21, finance 9.64, career 6.69, social **6.32** (worst), polymath 8.99, primary 5.67 — all ≥ 4.5. These are the *only* legal tinted fills in the app; the `token + '20'`/`'33'`/`'22'`/`'14'`/`'08'`/`'B3'` string-concat pattern is banned (§4 trap 1).

**`DOMAIN_GRADIENTS` is deleted** (colors.ts:49–58). Progress fills become solid hue on the new `track` token. The `gradientColors` prop is deleted from `ProgressBar.tsx` and `XpBar.tsx` (and the `LinearGradient` import with it); the 7 importing files (`goalTypeColor.ts` ×7, `SocialScoreCard.tsx`, `SkillGapChart.tsx`, `LearningResourceCard.tsx`, `GoalHierarchy.tsx`, `FinanceGoalCard.tsx`, `XpBar.tsx`) drop their references; tsc enforces completeness.

**`goalTypeColor.ts` re-map** (in PR-1, it owns palette semantics): returns `{ hue, text, dim, label }` per goal type from the new tokens; goal type `personal` re-maps from `c.primary` → **`c.goal`** (`goalText`/`goalDim`) — the violet-as-domain-content leak dies here, not in a later sweep.

#### A.3 Brand violet ("Signal") + semantics + gamification (dark)

| Token | New value | vs base / card | Notes |
|---|---|---|---|
| `primary` | `#8B7CFF` | **6.42 / 5.81** | the one brand accent |
| `onPrimary` *(new)* | `#0B0B0D` | 6.02 on `primary`, 6.70 on `error` | label ink for `primary` and `danger` filled buttons |
| `primaryDim` | `#131124` | primary-on-dim 5.67 | replaces `primaryLight` |
| `success` | `#00D68F` | 11.02 | = health family (both mean "good") |
| `warning` | `#FFC53D` | **13.31** | amber, distinct from finance gold |
| `error` | `#FF6166` | **7.15 / 6.47** | |
| `xp` | `#9D8CFF` | **7.63** | violet permitted (policy V5) |
| `streak` | `#FF8C3C` | **9.07 / 8.20** | flame orange, unchanged hue family |
| `badge` | `#FFB300` | 11.70 | was violet `#C5B3FF` — badges are gold now; violet is not a trophy color |

**`Button.tsx` retoken (same PR as the palette — the labels are currently `'#FFFFFF'` literals at lines 41 and 44, and white on `#8B7CFF` is 3.27, white on `#FF6166` is 2.94 — both fail):**
- `primary`: `{ bg: c.primary, text: c.onPrimary }`
- `danger`: `{ bg: c.error, text: c.onPrimary }` (dark `#0B0B0D` → 6.70 ✓; light `#FFFFFF` on `#C2243B` → 5.82 ✓)
- `secondary`: `{ bg: 'transparent', text: c.textPrimary, border: c.border }` — was violet text + violet border, which violates the violet policy (§A.4); secondary buttons are neutral now
- `ghost`: unchanged (`c.textSecondary`)

#### A.4 Violet policy — the complete list of surfaces violet may appear on

Violet (`primary`, `primaryDim`, `xp`) is the **AI-and-brand signal**. It appears on exactly five surfaces:

1. **The wordmark** ("LifeOS") on `(auth)` routes and splash.
2. **The primary CTA** — `Button` variant `primary` fill (`primary` + `onPrimary` label) and `Button3D` on welcome. One per screen.
3. **Active navigation** — selected tab tint and active segment indicators (the static `colors` export in the tab layout keeps working — §F).
4. **AI-speaking surfaces** — `DailyBriefing` identity dot/eyebrow, what-next agent chips, proposed-action confirm chips, voice orb, chat assistant bubbles, the Today AI-insight card eyebrow (`index.tsx:836`). Violet = "the AI is talking."
5. **XP and level numerals** in Rewards (`xp` token), including the `XpBar` fill.

Violet is **banned** from: domain content (cards, headers, progress, charts), badges, streaks, secondary buttons, decorative borders, backgrounds, gradients, ambient anything, and `goalTypeColor.ts` (the `personal` mapping moves to `goal` per §A.2). Enforcement: grep gates in §5 — `primary` references under `src/components/modules/{goals,health,finance,career,social,polymath}/` and inside `src/utils/goalTypeColor.ts` must be **0**; current violations get swept in PR-3 (modules) and PR-1 (goalTypeColor).

#### A.5 Light palette (kept, re-derived neutral)

`background #F6F7F8`, `surface #FFFFFF`, `surfaceAlt #ECEDEF`, `card #FFFFFF`, `border rgba(11,11,13,0.12)`, `track rgba(11,11,13,0.08)`, `textPrimary #0B0B0D` (19.66), `textSecondary rgba(11,11,13,0.72)` (8.17), `textMuted rgba(11,11,13,0.60)` (**5.17** on white, 5.11 on bg, 4.96 on `surfaceAlt` — was 3.87 ❌), `overlay rgba(11,11,13,0.45)`, `primary #5B4FE8` (5.63 as text on white), `onPrimary #FFFFFF` (5.63 on `primary`, 5.82 on `error`), `error #C2243B` (5.42 on bg), `warning #8A5800` (6.04 on white), `success #047857` (5.48 on white), `xp #5B4FE8` (5.63 — shares the light primary hex; both are policy-V5 violet), `streak #C2410C` (5.18), `badge #8A5800` (6.04 — badge *fills* stay `#FFB300` + `inkOnColor` in both modes; the light token is the text form).

Domain hues as **fills/blocks** keep the same six values in light mode (`inkOnColor #0B0B0D` stays legible on them, mode-independent). Domain hues as **text** get per-mode `*Text` tokens (new, in both palettes — dark mode value = the hue itself):

| Token | Dark | Light | Light contrast on `#FFFFFF` / own light dim |
|---|---|---|---|
| `goalText` | `#FF7733` | `#B83A00` | 5.76 / 5.07 |
| `healthText` | `#00D68F` | `#00734D` | 5.90 / 5.28 |
| `financeText` | `#FFB300` | `#8A5800` | 6.04 / 5.48 |
| `careerText` | `#4D9FFF` | `#0B5FD9` | 5.75 / 4.91 |
| `socialText` | `#FF5C97` | `#C81E5C` | 5.53 / 4.63 |
| `polymathText` | `#1FC8FF` | `#00708F` | 5.65 / 5.04 |

Light dims: `goalDim #FFEDE3`, `healthDim #DFF8EE`, `financeDim #FFF3D6`, `careerDim #E3EEFF`, `socialDim #FFE4EE`, `polymathDim #DFF6FD`, `primaryDim #E9E6FF`.

**Rule of use:** color *on* a surface → `*Text` token; color *as* a surface → base hue token. This is the whole API.

#### A.6 The contrast lock — `src/theme/__tests__/contrast.test.ts` (new file)

A jest test that imports `darkColors`/`lightColors`, implements WCAG relative luminance (≈30 lines, pure math, runs under the existing Node jest harness — `npx jest src/theme/__tests__/contrast.test.ts`), alpha-composites rgba tokens onto their declared surfaces, and asserts ≥ **4.5** for every pair in an explicit `TEXT_ON_SURFACE` matrix, **in both palettes**:

- `textPrimary | textSecondary | textMuted` × `background | card | surfaceAlt`
- all six `*Text` tokens × `background | card | own *Dim`
- `inkOnColor` × all six hues + `primary` + `badge`-fill (`#FFB300`)
- `onPrimary` × `primary` and × `error`
- `error | warning | success | xp | streak | badge` × `background | card`

The test also pins **exact hex equality** for: the six domain hues, `background`, `card`, `primary`, `inkOnColor` (per §4 trap 5). This file is the AA guarantee — CI fails if anyone "softens" a token. Header comment, verbatim: `// Changing any threshold or pinned hex here requires founder sign-off in the PR description.`

#### A.7 Elevation + the two glass primitives

`src/theme/elevation.ts` dark levels recolor to neutral ink: `z1` `backgroundColor #101014` (solid, matches `card`; replaces `rgba(255,255,255,0.045)` line 27), border `rgba(255,255,255,0.10)`; `z2` `#0E0E12` + existing black shadow values; `z3` `#17171C` + existing shadow. The two violet-cast rgba fills (`rgba(26,16,40,…)` lines 32, 43) die. No glow `boxShadow` anywhere in elevation (the existing z2/z3 black shadows stay — they are depth, not glow). Light levels swap their `rgba(20,8,40,…)` borders/shadows to `rgba(11,11,13,…)` equivalents at the same alphas.

**Both** glass primitives get the same surgery in PR-1:
- `Card.tsx`: delete the web corner-glow block (lines 54–70) and the `BlurView`/`backdropFilter` glass path (lines 36–38, 46–53, plus the `expo-blur` import) — solid `card` needs no blur. (`moduleColor` border removal is PR-3, §C.)
- `GlassCard.tsx`: delete its `backdropFilter` (lines 66–69), `BlurView` (lines 77–84), and accent corner-glow (lines 85–100) paths and the `expo-blur` import. (`accent` border removal is PR-3, §C.)

---

### B. Aurora wash removal — every render site, with its verdict

**The boundary rule (definition of "aurora" going forward):** multi-hue light in motion. It is legal **only** when triggered by a user-caused event with a bounded life: reward beats (`RewardOrchestrator`, `LevelUpOverlay`, `ChestOpenOverlay`, the `celebrationEngine`-flagged Skia engine in `src/celebration/`), the `EnergySweep` event pulse (event-driven, self-clearing via `onComplete → clearSweep`), `ParticleField` in its two earned states (`allBlocksDone` → 8 particles, `voiceActive` → 14, per `useAmbientState.ts:36–39`). It is illegal as: time-of-day ambience, mount decoration, auth atmosphere, idle background of any kind. "Celebrate moments, rest quiet."

| Component / site | Verdict | Replacement |
|---|---|---|
| `src/components/shared/AuroraBackground.tsx` | **Delete file** (takes `DEFAULT_MESH_STOPS` and testIDs `aurora-bg`/`ambient-mesh` with it) | New `src/components/shared/InkCanvas.tsx` (below) |
| `src/components/shared/AuroraAnimatedBackground.tsx` | **Delete file** (consumers: 3 auth screens + its own reduce-motion fallback at line 182) | `InkCanvas` (§E) |
| `src/components/shared/ambient/GradientMesh.tsx` | **Delete file** | nothing |
| `src/components/shared/ambient/presets.ts` (time-of-day blooms + webGradients) | **Delete file** | nothing |
| `src/components/shared/ambient/useAmbientState.ts` | **Slim**: delete `useCurrentHour`, `preset`, and the `presetForHour` import; keep the `particles` trigger; replace the `ALL_DOMAIN_HUES` literal (line 24) with `[colors.goal, colors.health, colors.finance, colors.career, colors.social, colors.polymath]` via the static `colors` export (domain hues are mode-independent) | — |
| `src/components/shared/ambient/ParticleField.tsx` | **Keep** — celebration-moment only (day-complete, voice) | hues fed from new tokens |
| `src/components/shared/ambient/EnergySweep.tsx` | **Keep** — event-driven, self-clearing, behavior unchanged; idle-default hue prop value moves from the hardcoded `'#A584FF'` to `colors.primary` | — |
| `src/components/shared/ambient/useAmbientEventStore.ts` | **Keep** | — |
| `Card.tsx` / `GlassCard.tsx` glow + blur | **Delete in PR-1** (§A.7) | nothing |
| `src/theme/motion.ts` `AMBIENT.auroraDrift` (line 59) | **Delete token** (no consumer remains); keep `breath`, `fieldDrift` | — |
| 38 `<AuroraBackground />` render-site files (8 tab screens: `index`, `goals`, `health`, `finance`, `career`, `social`, `explore`, `rewards`; 11 `(onboarding)` screens; `chat`, `evening-reflect`, `annual-review`, `activity`, `edit-priorities`, `expedition-detail`, `contact/[id]`, `finance-category`, `finance-merchant`, `finance-review`, `monthly-insight`, `what-lifeos-knows`, `what-lifeos-remembers`, `welcome-intent`, `terms-privacy`, `how-it-works`, `data-residency`, `notifications-settings`; `RabbitHoleScreen.tsx`) | **Mechanical swap** to `<InkCanvas …same props minus blooms />` (import line + element line per file) | — |
| `e2e/ambient.spec.ts` | **Rewrite** — its 4 current tests assert the mesh/gradient/preset world; replace with 4 new tests: (1) `[data-testid="aurora-bg"]` and `[data-testid="ambient-mesh"]` resolve to null on Today, `[data-testid="ink-canvas"]` is visible; (2) `ink-canvas` computed background is `rgb(0, 0, 0)` and contains zero elements with a computed `background-image` other than `none`; (3) `ambient-particles` is null while blocks are incomplete and non-null after the last block completes (existing fixture path); (4) `ambient-sweep` is present and empty at idle | — |
| `docs/aurora-refined-v2/README.md` | **Mark superseded**: one banner line added at the very top: `> **SUPERSEDED by Ink + Signal (see COLOR_RECOMMIT spec). Color/wash guidance in this folder no longer applies; motion scenes remain valid.**` | — |

**`InkCanvas.tsx` (new):** renders a `StyleSheet.absoluteFill` `View` with `backgroundColor: useSurfaces().ground`, `pointerEvents="none"`, `testID="ink-canvas"`, containing exactly two children: (1) a `testID="ambient-sweep"` wrapper with `EnergySweep` wired to `useAmbientEventStore` exactly as `AuroraBackground.tsx:113–114,163–170` does today (idle hue `c.primary`), and (2) a `testID="ambient-particles"` wrapper with `ParticleField` when `useAmbientState({allBlocksDone, voiceActive}).particles` is non-null, passing `useWindowDimensions().height` as today. Props: `{ scrollY?, allBlocksDone?, voiceActive? }` — `scrollY` parallax is dropped (nothing left to parallax); the prop is accepted-and-ignored for one release so the Today call site (`app/(tabs)/index.tsx:513`) stays a one-line change. No gradient, no bloom, no mesh, no time-of-day branch, no theme branch beyond the `ground` token. On reduce-motion (`useMotionScale() === 0`), sweep completes instantly (existing behavior) and particles render statically (existing behavior) — **web and native render identically** because both remaining layers already run on both platforms.

**The hex radar on Today does not move (hard constraint).** `HexRadar` (`app/(tabs)/index.tsx:528`, `size={340}`) stays the first content element inside the Today `ScrollView`, ahead of the header block; PR-2's entire diff to `index.tsx` is the two-line import/element swap. On true black the radar becomes the brightest object in the first viewport — the recommit working *for* the radar instead of around it.

---

### C. Structural color — the three roles, and only these

> **R1 — Block.** One solid, full-bleed domain-hue surface per module screen: the header block. Content on it uses `inkOnColor` only.
> **R2 — Ink.** Data rendered *in* the hue at 100%: score numerals, solid progress fills, trend deltas, active filter chips, status words. Always via `*Text` tokens.
> **R3 — Mark.** In cross-domain lists (Today timeline, Goals list, quests), the domain is identified by its glyph (`DOMAIN_GLYPHS`/`DomainGlyph`) rendered in the hue — replacing the 3px/4px left border.
>
> Everything else is neutral ink. A hue at reduced opacity, as a gradient, as a wash, or as a border-only accent is a violation. Left borders die app-wide: `Card`'s `moduleColor` prop and `GlassCard`'s `accent` prop are both **removed** (tsc surfaces all 43 `moduleColor=` and 17 `accent=` call sites; each becomes R2 or R3 or nothing, per the dispositions below).

**Worked example 1 — Goals card (`src/components/modules/goals/GoalCard.tsx`).**
*Before:* `<Card moduleColor={typeColor.color}>` (line 41) → 3px pastel left border + corner glow; `<Label color={typeColor.color}>` LABEL-CAPS in pastel (line 44); `ProgressBar … gradientColors={typeColor.gradient}` (line 52).
*After:* `<Card>` (neutral, no border accent). Header row: `<DomainGlyph domain={…} size={14} color={typeColor.text} />` + `<Label color={typeColor.text}>` (R3 mark + R2 ink — `goalTypeColor.ts` already re-mapped in PR-1, §A.2). `<ProgressBar value={progress} color={typeColor.hue} height={isPrimary ? 8 : 6} />` — solid fill on `c.track`, no `gradientColors` prop (prop deleted from `ProgressBar` in PR-1). The status caption (line 47) renders `color: typeColor.text` when status is `active`, `c.textMuted` otherwise (R2: status is data).

**Worked example 2 — Health header (`src/components/ui/ModuleHeader.tsx` + its 8 call sites).**
*Before:* row of 40px circle `backgroundColor: color + '20'` (line 20) + `DomainGlyph` in pastel + white `Heading` (audit-health.png: a gray screen with a faint green dot).
*After:* `ModuleHeader` becomes the R1 block: container `backgroundColor: color` (the solid hue token passed by each screen), full-bleed (`borderRadius: 0`, `paddingHorizontal: spacing.lg`, `paddingVertical: spacing.lg`), glyph rendered in `inkOnColor` at 28px, title in `textVariants.h1` with `color: inkOnColor`, plus a new optional `stat?: { value: string; label: string }` slot right-aligned (`value` in `textVariants.display` `inkOnColor`, `label` in `textVariants.caption` `inkOnColor` at full opacity). The Ionicons `icon` fallback path stays, rendered in `inkOnColor`. The tinted-circle pattern is deleted from the component. **Full-bleed is achieved by hoisting**: each tab screen moves `<ModuleHeader>` out of its horizontally-padded content container so the block spans x=0→viewport width — negative-margin compensation is banned. All 8 call sites flip in the same PR: `goals.tsx:469`, `finance.tsx:349/384/510`, `health.tsx:374`, `career.tsx:670`, `explore.tsx:569` (title "Explore", hue `c.polymath`), `social.tsx:98`; `primitives.test.tsx:154–159` updates with them. Health passes `stat={{ value: '—', label: 'BMI' }}` until vitals exist, then the live BMI (the `'—'` placeholder is the only new user-facing copy in this cluster; it is neutral data, consistent with the app's no-blame compassion copy rule — this cluster changes **zero** other user-facing strings).

**Worked example 3 — Social score card (`src/components/modules/social/SocialScoreCard.tsx`).**
*Before:* `<Card moduleColor={c.social}>` (line 26, pink border + glow); score in `c.textPrimary` (line 31); `ProgressBar … gradientColors={DOMAIN_GRADIENTS.social}` (line 40); eyebrow and `/100` suffix in failing `c.textMuted` (lines 29, 33).
*After:* `<Card>` neutral. Eyebrow "Social health" in new `c.textMuted` (now 6.56:1). Score numeral `display`-size in **`c.socialText`** (R2 — the score IS the social signal; on dark that is full-sat `#FF5C97` at 7.23:1); `/100` suffix `c.textMuted`. `<ProgressBar value={score} color={c.social} />` solid. Subtitle `c.textSecondary`. The pink moves from the card's edge (decoration) into the number (meaning).

**GlassCard `accent` dispositions (all 17 sites, decided now):**
- Domain hues → **R3** glyph in the card's header row: `career.tsx:403`, `explore.tsx:727`, `finance.tsx:1110`, `goals.tsx:555`, `social.tsx:164`, `index.tsx:693` (`c.polymath`), `goals.tsx:452` (`MotivationBanner accent={tc.color}` — the banner's own left rail becomes an R3 glyph).
- `c.success` → **R2**: `index.tsx:673, 714` — the reflect-card title/status word renders in `success`; card neutral.
- `c.warning` → **R2**: `notifications-settings.tsx:203` — the permission headline renders in `warning`; card neutral.
- `c.primary` → policy V4 as **R2**: `index.tsx:836` (AI insight card — violet eyebrow + identity dot, card neutral); `rewards.tsx:218`; `notifications-settings.tsx:225` drops the accent entirely (it is not an AI surface).
- `c.xp` / `c.badge` → **R2**: `rewards.tsx:228, 237, 300` — XP numerals in `c.xp`, badge labels in `c.badge`; cards neutral.
- `data-residency.tsx:130` (varying `color`) → drop the accent; section title renders in the passed `*Text` token (R2).

The same three roles resolve every other site in the `borderLeftColor` grep (24 occurrences / 21 files): `DomainMiniCard`, `QuestCard`, `StreakRow`, `StreakRecoveryCard`, `MotivationBanner`, `DomainNudgeCard`, `OvercommitmentCard`, `DraggableRoutineList`, `PriorityChangeSheet`, `OnboardingIntroSection`, `AddGoalSheet`, polymath cards → R3 or nothing. **Semantic rails are data, not decoration, and stay as left rails recolored to new `success`/`warning`/`error`:** `RoutineDiffPreview` (add/remove/move rails) and `FitDashboard` insight rails. The admin portal (`admin/`) is a separate Next.js app and is **out of scope** for this cluster — its `accent=` usages are untouched.

---

### D. Contrast pass — failing tokens and their fixes

| Token | Today | Measured | New value | Measured |
|---|---|---|---|---|
| `darkColors.textMuted` | `rgba(244,239,255,0.38)` | **3.23** on bg, **3.31** on card ❌ | `rgba(247,248,248,0.58)` | **6.56 / 6.49** ✓ |
| `lightColors.textMuted` | `rgba(20,8,40,0.52)` | **3.87** on `#FFFFFF`, **3.55** on `#F7F4FC` ❌ | `rgba(11,11,13,0.60)` | **5.17** ✓ |
| `Button` primary/danger labels | `'#FFFFFF'` literals (Button.tsx:41,44) | 3.27 on new `primary`, 2.94 on new `error` ❌ | `c.onPrimary` | **6.02 / 6.70** dark, **5.63 / 5.82** light ✓ |

The two `textMuted` fixes heal every consuming site (eyebrows, `/100` suffixes, timestamps, "Don't have an account?") by the token change alone — zero call-site edits. The Button fix is two line edits in one file. The lock in §A.6 makes regression a CI failure, and pins the new values' margins so the fix can't rot.

---

### E. Sign-in unification — the front door becomes the app

**Decision: the light pastel aurora sign-in dies.** One identity: Ink. Files: `app/(auth)/sign-in.tsx`, `app/(auth)/sign-up.tsx`, `app/(auth)/welcome.tsx`.

- **Background:** `<InkCanvas />` — flat `#000000`. The `AuroraAnimatedBackground` import is deleted from all three files (the component no longer exists after PR-2). No blobs, no blur, no time-of-day. Web and native identical by construction (one `View`, one fill).
- **Card chrome:** the `glassCard` style block (sign-in.tsx:189–201; sign-up has the identical block — `background + 'B3'` fill, 24px `backdropFilter`, border) is **deleted** from both files. Inputs sit directly on the ink with the existing `gap: spacing.md`; `Input` fields render on `surface #0E0E12` with `border` hairline (their existing tokens).
- **Wordmark:** "LifeOS" stays `fonts.display`, `color: c.primary` — violet policy surface V1, the single violet text on screen.
- **Type-led header:** title moves up a register — `textVariants.hero` (48/50 Nunito-Black), `color: textPrimary`, left-aligned (kills the centered-marketing posture). Exact copy, unchanged strings — sign-in: title `Welcome back`, subtitle `Sign in to continue building your life.`; sign-up: title `Create your account`, subtitle `Your data stays on your device. We never see your information.` Subtitles in `textSecondary`, left-aligned under the title.
- **CTA:** `Sign in` / `Create account` button = `primary` fill + `onPrimary` label (violet policy V2 — the second and last violet element). Google button: `surface` fill, `border` hairline, `textPrimary` label, string `Continue with Google` — unchanged structure, new tokens. The native Apple button keeps `AppleAuthenticationButtonStyle.WHITE` (it is a platform-rendered control, iOS-only, and white-on-ink is its highest-contrast variant — this is the one named exemption to tokens-only on these screens).
- **Footer:** `Don't have an account? ` in `textMuted` (now 6.56:1) + `Create one` rendered in `textPrimary` with `textDecorationLine: 'underline'` — **not** `c.primary` (policy V2 allows one violet CTA per screen). Same pattern on sign-up (`Already have an account? ` / `Sign in`).
- **Motion:** entrance only — existing `FadeIn`/`FadeInDown` staggers retimed via `useTimingConfig('slow')`; zero idle motion afterward. Reduce-motion collapses to instant via the existing `useMotionScale()` path.
- **Welcome screen:** same treatment. Wordmark `c.primary` (V1); tagline `Your Digital Life Architect` and description copy unchanged, in `textSecondary`/`textMuted`. The CTA is `Button3D` with string `Let's build your life plan` — `Button3D` recolors to `primary` fill + `onPrimary` label (V2), keeping its press-depth behavior. Under the tagline, the six domain glyphs render as a single static 14px row in their full-sat hues — the only color flourish on auth: a palette signature, no motion.

---

### F. Migration — ordering, gating, rollback

**Decision: hard cutover, no new feature flag.** Justification: `colors.ts:111` exports a static non-reactive `colors` object consumed outside render (tab layout, splash); a runtime flag cannot reach those call sites, so a "flagged palette" structurally guarantees a two-palette app — which is precisely the uncommitted-identity failure this recommit kills. The repo's own registry documents the precedent (`flags.ts:32`: token migration is unflagged because it is behavior-preserving), and every change in this cluster is presentation-only: no data, no AI calls, no navigation, no mutation-log writes. The rollback unit is `git revert` of a PR, which is strictly cleaner than a kill switch that resurrects a deleted component tree. Existing flags this spec touches: **`celebrationEngine`** (compile-time, `flags.ts:37`, M2) continues to gate the Skia celebration layer where aurora language lives; **no other flag is added or changed** — runtime flags (`useFlagStore` `FALLBACK_FLAGS`, e.g. `agent_what_next`) are untouched. Compassion/parity constraints ride existing machinery: `useMotionScale()` (reduce-motion + intensity) and the `gamification: 'off'` preference in `usePreferencesStore` already gate reward surfaces — `InkCanvas` keeps both paths, and every visual in this spec renders identically on web and native (the two surviving ambient layers and all token consumers are already cross-platform).

**PR train (each PR ships a coherent app — never half a palette):**

1. **PR-1 "Ink tokens"** — `colors.ts` full swap (§A.1–A.5: new neutrals, hues, `track`, `onPrimary`, `*Text` tokens; `*Light`→`*Dim` rename across 18 files; `DOMAIN_GRADIENTS` deletion + `gradientColors` prop removal from `ProgressBar`/`XpBar` + 7 consumer files to solid fills; `goalTypeColor.ts` re-map incl. `personal`→`goal`), `Button.tsx` retoken (§A.3), `elevation.ts` recolor, `Card.tsx`/`GlassCard.tsx` glow+blur deletion (§A.7), `contrast.test.ts` (§A.6). App is fully Ink-colored but layout-identical.
2. **PR-2 "Kill the wash"** — `InkCanvas.tsx` + 38-file swap, delete `AuroraBackground`/`AuroraAnimatedBackground` (auth temporarily gets bare `InkCanvas`)/`GradientMesh`/`presets.ts`, slim `useAmbientState`, retoken `EnergySweep` idle hue, delete `AMBIENT.auroraDrift`, rewrite `e2e/ambient.spec.ts` (4 new tests per §B), banner on `docs/aurora-refined-v2/README.md`.
3. **PR-3 "Structural color"** — `ModuleHeader` R1 block + 8 call sites across the six tab screens, `Card.moduleColor` + `GlassCard.accent` prop removal + the 43+17 call-site sweep to R2/R3/nothing per §C dispositions (`GoalCard`, `SocialScoreCard`, gamification cards, semantic-rail recolor), violet-policy sweep of module dirs, CI grep gates (§4 traps 1, 5).
4. **PR-4 "Front door"** — §E auth screens incl. `Button3D` retoken.

Order is load-bearing: tokens first so every later PR builds on final values; wash second so structural color lands on true black; auth last because it depends on `InkCanvas` and final type treatment.

---

## 4. Dilution traps

1. **The tint creeps back via string math.** Someone writes `backgroundColor: c.goal + '20'` "just for this chip." **Counter-rule:** the only legal tinted fills are the named `*Dim` tokens; PR-3 adds a CI grep gate — `rg "c\.\w+ \+ '" src/ app/` and `rg "(moduleColor|accent|color) \+ '" src/ app/` must both return 0 — the pattern is mechanically detectable because every current instance (incl. `ModuleHeader.tsx:20`, `GlassCard.tsx:96`, `sign-in.tsx:190`) uses hex-suffix concatenation.
2. **`textMuted` gets "re-softened."** Three weeks in, someone finds 0.58 "too loud" and drops it to 0.45. **Counter-rule:** `contrast.test.ts` fails CI below 4.5; the test file carries the founder-sign-off header (§A.6). Margin (6.56 vs 4.5) means even a taste-driven nudge to 0.50 still passes — only AA-breaking changes fail.
3. **A deleted component survives as a "deprecated" file** and a new screen imports it in month two. **Counter-rule:** PR-2 *deletes* the files — there is no deprecated path to import; e2e asserts `testID="aurora-bg"` resolves nowhere; `InkCanvas` is the only background primitive.
4. **The R1 block ships as an opt-in variant nobody opts into** (`<ModuleHeader variant="block">` with default `"quiet"`). **Counter-rule:** the block is not a variant — it is the only rendering of `ModuleHeader`; PR-3 includes all 8 call sites in the same diff; acceptance criterion 8 checks live screens, not the component.
5. **Hues ship "at 80% to be safe"** — the classic re-pastelization, via opacity on the block or a "softer" hex one Figma round later. **Counter-rule:** the six hue values in §A.2 are normative to the digit; `contrast.test.ts` pins each listed token's exact hex with equality assertions (a palette change is a deliberate test edit, not a drive-by), and R1 blocks take the token with no `opacity` style permitted (grep gate: `opacity` styles on the `ModuleHeader` container = 0).
6. **Career quietly stays violet** ("users associate it"). **Counter-rule:** `career: '#4D9FFF'` lands in PR-1 with the rest — there is no separate "career migration" to defer; acceptance criterion 5's grep makes any `primary` reference inside `modules/career/` a review-blocking finding.
7. **Auth keeps "a little" glass** because the bare form "feels unfinished." **Counter-rule:** acceptance criterion 9 asserts zero `backdrop-filter` computed styles on auth routes; the fix for "unfinished" is the §E type scale, not chrome.
8. **`Card` gets cleaned but `GlassCard` keeps the border-and-glow** — the second primitive becomes the escape hatch (it already has 17 `accent=` call sites today). **Counter-rule:** both primitives lose blur+glow in PR-1 and their accent/moduleColor props in PR-3, with all dispositions pre-decided in §C; criterion 6 greps both files.
9. **The violet leak re-enters through `goalTypeColor.ts`** (it lives in `src/utils/`, outside the module-dir grep). **Counter-rule:** the `personal`→`goal` re-map lands in PR-1, and criterion 5 greps `goalTypeColor.ts` explicitly.
10. **Hardcoded label literals survive on filled controls** (`'#FFFFFF'` in `Button.tsx`, `Button3D`) and silently fail on the new fills. **Counter-rule:** §A.3 retokens both in PR-1/PR-4; criterion 13 greps for the literal.

---

## 5. Acceptance criteria (binary, reviewer-checkable)

1. `npx jest src/theme/__tests__/contrast.test.ts` passes, and the test file contains assertions ≥ 4.5:1 for every pair in the §A.6 `TEXT_ON_SURFACE` matrix (`textPrimary|textSecondary|textMuted` × `background|card|surfaceAlt`; all six `*Text` × `background|card|own *Dim`; `inkOnColor` × six hues + `primary` + `#FFB300`; `onPrimary` × `primary|error`; `error|warning|success|xp|streak|badge` × `background|card`) — in **both** palettes.
2. `darkColors.background === '#000000'` in `src/theme/colors.ts`, and on the web build at 390×844 the Today route's `[data-testid="ink-canvas"]` computed background-color is `rgb(0, 0, 0)`.
3. `rg "AuroraBackground|AuroraAnimatedBackground|GradientMesh|presetForHour|DOMAIN_GRADIENTS|auroraDrift|gradientColors" app/ src/ -g '*.ts' -g '*.tsx'` returns 0 matches, and the files `src/components/shared/AuroraBackground.tsx`, `src/components/shared/AuroraAnimatedBackground.tsx`, `src/components/shared/ambient/GradientMesh.tsx`, `src/components/shared/ambient/presets.ts` do not exist.
4. On the web build, `[data-testid="aurora-bg"]` and `[data-testid="ambient-mesh"]` resolve to null on `/sign-in` and on `/`, `/goals`, `/health`, `/finance`, `/career`, `/social`, `/explore`, `/rewards`; `[data-testid="ink-canvas"]` resolves to non-null on those same nine routes; `[data-testid="ambient-particles"]` resolves to null on Today while blocks are incomplete and non-null after the last block completes (existing e2e fixture path).
5. `rg "c\.primary|colors\.primary" src/components/modules/goals src/components/modules/health src/components/modules/finance src/components/modules/career src/components/modules/social src/components/modules/polymath --glob '!*test*'` returns 0 matches, and `rg "primary" src/utils/goalTypeColor.ts` returns 0 matches.
6. `rg "moduleColor" src/components/ui/Card.tsx` returns 0 matches; `rg "accent" src/components/ui/GlassCard.tsx` returns 0 matches; `rg "borderLeftColor" src/components/ui/Card.tsx src/components/ui/GlassCard.tsx src/components/modules/goals/GoalCard.tsx src/components/modules/social/SocialScoreCard.tsx` returns 0 matches; `rg "expo-blur" src/components/ui/Card.tsx src/components/ui/GlassCard.tsx` returns 0 matches; `npx tsc --noEmit` passes (proving all former `moduleColor`/`accent` call sites were swept, not silenced).
7. `rg "LinearGradient|gradientColors" src/components/ui/ProgressBar.tsx src/components/gamification/XpBar.tsx` returns 0 matches, and both components render their track with `c.track` (string `track` present in both files).
8. Web build at 390×844, for each of the six module tabs — `/goals` ("Goals", `rgb(255, 119, 51)`), `/health` ("Health", `rgb(0, 214, 143)`), `/finance` ("Finance", `rgb(255, 179, 0)`), `/career` ("Career", `rgb(77, 159, 255)`), `/social` ("Social", `rgb(255, 92, 151)`), `/explore` ("Explore", `rgb(31, 200, 255)`): the `ModuleHeader` container's computed background-color equals the listed rgb and its bounding box spans x=0 to x=390, and the title's computed color equals `rgb(11, 11, 13)`.
9. On `/sign-in` (web): no element in the document has a computed `backdrop-filter` other than `none`; the count of elements whose computed color or background-color equals `rgb(139, 124, 255)` is exactly 2 (wordmark text, primary CTA fill); the document body's computed background-color is `rgb(0, 0, 0)`; the "Create one" link's computed color equals the `textPrimary` rgb (`rgb(247, 248, 248)`) with `text-decoration-line: underline`.
10. With Playwright `reducedMotion: 'reduce'`, on `/sign-in` and `/` (Today), `document.getAnimations().length === 0` after a 1500ms post-load settle, and the rewritten `e2e/ambient.spec.ts` passes (all 4 tests of §B).
11. `rg "(goal|health|finance|career|social|polymath|primary)Light" src/ app/` returns 0 matches (the `*Dim` rename across all 18 files is complete).
12. `contrast.test.ts` contains exact-equality assertions pinning `goal === '#FF7733'`, `health === '#00D68F'`, `finance === '#FFB300'`, `career === '#4D9FFF'`, `social === '#FF5C97'`, `polymath === '#1FC8FF'`, `background === '#000000'`, `card === '#101014'`, `primary === '#8B7CFF'`, `inkOnColor === '#0B0B0D'`.
13. `rg "'#FFFFFF'" src/components/ui/Button.tsx src/components/ui/Button3D.tsx` returns 0 matches (labels are `c.onPrimary`), and the `secondary` variant in `Button.tsx` references `textPrimary` and `border`, not `primary`.
14. `rg "c\.\w+ \+ '" src/ app/ -g '*.tsx'` and `rg "(moduleColor|accent|color) \+ '" src/ app/ -g '*.tsx'` both return 0 matches (string-concat tints are gone, including `ModuleHeader.tsx`'s `color + '20'` and `sign-in.tsx`'s `background + 'B3'`).
15. In PR-2's diff, the only lines changed in `app/(tabs)/index.tsx` are the `AuroraBackground` import and the element at line 513 (swapped to `InkCanvas`); `<HexRadar` with `size={340}` remains the first content element inside the Today `ScrollView` (hard constraint: the hex radar's placement on Today is unchanged).
16. The first line of `docs/aurora-refined-v2/README.md` body is the verbatim superseded banner from §B, and `git log` shows no edits to any other file in `docs/aurora-refined-v2/`.

---

## 6. Effort estimate

| Piece | PR | Size |
|---|---|---|
| A.1–A.5 token swap + `track`/`onPrimary`/`*Text` additions + `*Light`→`*Dim` rename (18 files) + `DOMAIN_GRADIENTS` removal (`ProgressBar`/`XpBar` prop + 7 consumer files) + `goalTypeColor.ts` re-map | PR-1 | **M** |
| A.3 `Button.tsx` retoken (primary/danger/secondary) | PR-1 | **S** |
| A.6 `contrast.test.ts` (matrix + hex pins) | PR-1 | **S** |
| A.7 `elevation.ts` recolor + `Card.tsx`/`GlassCard.tsx` glow+blur deletion | PR-1 | **S** |
| B `InkCanvas.tsx` + 38-file swap + 4 file deletions + `useAmbientState` slim + `EnergySweep` hue retoken + `e2e/ambient.spec.ts` rewrite | PR-2 | **M** |
| B docs banner on `docs/aurora-refined-v2/README.md` | PR-2 | **S** |
| C `ModuleHeader` R1 block + 8 call sites across six tab screens + `primitives.test.tsx` | PR-3 | **M** |
| C `Card.moduleColor` + `GlassCard.accent` prop removal + 43+17 call-site sweep (GoalCard, SocialScoreCard, gamification cards, semantic rails) per §C dispositions | PR-3 | **L** |
| C violet-policy sweep of module dirs + CI grep gates (traps 1, 5) | PR-3 | **S** |
| E auth screens (sign-in, sign-up, welcome) + `Button3D` retoken | PR-4 | **M** |

Total: one focused week for one developer; PR-3's call-site sweep is the only L and is fully tsc-guided.

---

## Dilution audit log

1. **Wrong wash-site count (§1, §B, §6):** "35 screens" → verified by grep: **38 files** render `<AuroraBackground />`; enumerated them, including the missed reduce-motion fallback at `AuroraAnimatedBackground.tsx:182`.
2. **False "every tab" claim (§1, §B):** `life.tsx` and `profile.tsx` do not mount the wash — corrected to the exact 8 tab screens, preventing a swap PR that "completes" while missing or over-touching files.
3. **`GlassCard.tsx` ignored entirely:** a second glass primitive with `accent` border+glow+blur and 17 live call sites — the obvious escape hatch. Added to §1, §A.7, §C (all 17 dispositions decided), §F, trap 8, criteria 6/14, effort table.
4. **Wrong borderLeftColor count (§1):** "25 other sites" → verified **24 occurrences across 21 files** (incl. both card primitives); component list in §C corrected to files that actually exist (added `StreakRecoveryCard`, `DraggableRoutineList`, `PriorityChangeSheet`, `OnboardingIntroSection`, `AddGoalSheet`).
5. **Vague "~40 call sites" (§C):** pinned to grep-verified 43 `moduleColor=` + 17 `accent=` occurrences.
6. **Filename typo `SocialScoreCard.tssx` (§C):** the file is already `SocialScoreCard.tsx` — fictional rename removed; before/after lines pinned to verified line numbers (26/29/31/33/40).
7. **Wrong contrast figures:** textSecondary-on-card 9.09→**9.45**, textMuted-on-card 5.81→**6.49**, old-textMuted-on-card 3.02→**3.31**, polymath inkOnColor 9.51→**10.08** — all recomputed by script; wrong numbers would have made criterion 1 un-trustable.
8. **Hardcoded `'#FFFFFF'` Button labels (missed failure):** white fails on new `primary` (3.27) and `error` (2.94) — added per-mode `onPrimary`, full Button variant retoken (§A.3, §D, criterion 13, trap 10).
9. **Violet secondary buttons (constraint violation):** `Button` `secondary` uses violet text+border, violating the five-surface violet policy — retokened to neutral (§A.3).
10. **Violet leak via `goalTypeColor.ts` `personal`→`primary` (constraint violation, outside the module-dir grep):** decided `personal`→`goal`; moved to PR-1; criterion 5 extended; trap 9 added.
11. **Light-mode gamification gap (escape hatch):** §A.5 gave no light `xp`/`streak`/`badge`; dark values fail on white (2.75/2.32/1.79). Committed `#5B4FE8`/`#C2410C`/`#8A5800` with computed ratios.
12. **Untokened progress track (`rgba(255,255,255,0.08)` would violate tokens-only):** added `track` token to both palettes; criterion 7 extended.
13. **Vague InkCanvas internals:** pinned testIDs (`ink-canvas`, kept `ambient-sweep`/`ambient-particles` wrappers), `EnergySweep` idle hue `'#A584FF'`→`c.primary`, `useWindowDimensions().height` wiring, and the exact `useAmbientState` deletions (`useCurrentHour`, `presetForHour` import).
14. **Unverifiable EnergySweep duration claim ("≤ celebrationFall 2000ms"):** unverified in code — replaced with the verifiable property (event-driven, self-clearing via `onComplete → clearSweep`, behavior unchanged).
15. **Vague e2e rewrite (§B):** the existing 4 tests assert mesh/gradient internals — replaced "rewrite assertions" with 4 concretely specified replacement tests, wired into criterion 10.
16. **Hex-radar constraint had no check:** added §B placement paragraph pinned to `index.tsx:528` `size={340}` and new binary criterion 15 (PR-2 diff scope + first-element position).
17. **`ModuleHeader` spec gaps:** pinned all 8 call sites with line numbers (finance mounts it 3×), kept the `icon` fallback (in `inkOnColor`), replaced unspecified "full-bleed (margin 0)" with the hoisting rule + negative-margin ban, named the `primitives.test.tsx` update, fixed padding spec to match the component's real style shape.
18. **Banned-word "five tab routes" / "other five module screens" ambiguity (criteria 4, 8):** routes and expected rgb()/title strings now enumerated exactly; Explore pinned to `c.polymath` per `explore.tsx:569`.
19. **Invalid grep in criterion 3 (`--type tsx` is not a ripgrep type):** replaced with `-g '*.ts' -g '*.tsx'`; pattern extended to catch `gradientColors` and `AuroraBackground` itself.
20. **Hedged footer decision in §E ("`c.primary`? No —"):** rhetorical waffle replaced with the committed rule plus a computed-style check in criterion 9 (underline + exact rgb).
21. **Missing exact copy for sign-up/welcome (§E):** pinned verified strings (`Create your account`, `Your data stays on your device. We never see your information.`, `Your Digital Life Architect`, `Let's build your life plan`) and named `Button3D` + the native Apple `WHITE` button as an explicit, justified exemption.
22. **Compassion-copy rule absent:** added the explicit statement (§C) that this cluster changes zero user-facing strings except the neutral `'—'` BMI placeholder, which must obey the no-blame rule.
23. **Web+native parity statements hardened:** §B (InkCanvas identical by construction, both surviving layers cross-platform) and §F (all token consumers cross-platform) now state parity affirmatively.
24. **Flag gating named precisely (§F):** `celebrationEngine` pinned to `flags.ts:37`; runtime `FALLBACK_FLAGS`/`agent_what_next` declared untouched; `gamification:'off'` preference cited from `usePreferencesStore`.
25. **Admin portal scope hole:** `admin/` has its own `accent=` usages — declared out of scope in §C so PR-3's "0 matches" gates don't get silently widened or narrowed.
26. **String-concat tint gate had no criterion:** trap 1's grep promoted to binary criterion 14, with the three known current instances named so the reviewer can verify the gate actually bites.
27. **Banned-word scan (§3–6):** zero instances of "consider/could/maybe/potentially/we might" remain; the token "explore" appears only inside literal file/route identifiers (`app/(tabs)/explore.tsx`, `/explore`, "Explore" title), which are repo facts, not hedges.
28. **Criteria count:** raised from 12 to 16, all yes/no (grep result, test exit code, computed style, diff scope).
