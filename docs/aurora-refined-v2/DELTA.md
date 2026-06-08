# DELTA · token + component refinements

Line-level edits. Every block below is **idempotent** — apply once and re-running
should produce no further change. Snapshots may shift; run `npm test -- -u`
once per phase, then review the diff.

> **Convention.** `▸ replace` = swap value, `+ add` = new line, `− remove` = delete line.

---

## Phase 1 · `src/theme/elevation.ts`

The current dark `z3` casts a 60 px primary-color halo. Refined design treats
elevation as **shadow only** — no colored glow. Halo moments belong to motion
(BadgeUnlock scene), not resting state.

### `darkLevels.z3` — soften

```diff
   z3: {
-    backgroundColor: 'rgba(26,16,40,0.96)',
-    borderColor: 'rgba(165,132,255,0.4)',
+    backgroundColor: 'rgba(26,16,40,0.94)',
+    borderColor: 'rgba(255,255,255,0.12)',
     borderWidth: 1,
-    shadowColor: '#A584FF',
-    shadowOffset: { width: 0, height: 12 },
-    shadowOpacity: 0.4,
-    shadowRadius: 30,
-    elevation: 20,
-    boxShadow:
-      '0 30px 80px rgba(20,8,40,0.6), 0 0 60px rgba(165,132,255,0.4)',
+    shadowColor: '#000',
+    shadowOffset: { width: 0, height: 16 },
+    shadowOpacity: 0.45,
+    shadowRadius: 32,
+    elevation: 18,
+    boxShadow: '0 16px 40px rgba(8,4,16,0.5)',
   },
```

### `lightLevels.z3` — drop the primary-color halo

```diff
   z3: {
     backgroundColor: '#FFFFFF',
-    borderColor: 'rgba(165,132,255,0.3)',
+    borderColor: 'rgba(20,8,40,0.10)',
     borderWidth: 1,
-    shadowColor: '#A584FF',
+    shadowColor: '#140828',
     shadowOffset: { width: 0, height: 16 },
-    shadowOpacity: 0.18,
+    shadowOpacity: 0.10,
     shadowRadius: 40,
     elevation: 16,
-    boxShadow: '0 16px 40px rgba(165,132,255,0.18), 0 0 40px rgba(165,132,255,0.15)',
+    boxShadow: '0 16px 40px rgba(20,8,40,0.10)',
   },
```

### `darkLevels.z2` — slight cleanup, optional

`z2` is fine as-is. Touch only if QA flags the negative-y shadow as wrong for
its callers (bottom sheets get `z3` per their own offset).

---

## Phase 1 · `src/theme/radii.ts`

Add two values used by sheet + intro surfaces. Do not rename existing.

```diff
 export const radii = {
   pill: 999,
+  xl: 28,
   card: 22,
+  lg: 20,
   control: 14,
   tile: 10,
   hairline: 4,
 } as const;
```

Order matters only for `keyof typeof` autocomplete. Place `xl` above `card`
and `lg` below it so the descending magnitude reads correctly.

---

## Phase 2 · `src/theme/motion.ts`

Add two easings used by streak ticks and attention bells. Keep all existing
`SPRING` and `TIMING` values — they already match the refined motion vocabulary.

### Add to the top of the file, after `import` block

```ts
import { Easing as RNEasing } from 'react-native';

// Custom easings beyond Reanimated's built-ins.
//   bounce — single-overshoot bounce. Streak +1 number tick.
//   pulse  — 0 → 1 → 0 bell over duration. Attention flash on AI insight.
export const EASING = {
  out:    RNEasing.out(RNEasing.cubic),
  soft:   RNEasing.bezier(0.2, 0.7, 0.3, 1),
  spring: RNEasing.bezier(0.34, 1.56, 0.64, 1),    // damped overshoot
  bounce: RNEasing.bezier(0.34, 1.86, 0.64, 1),    // 6 % overshoot, single oscillation
  inOut:  RNEasing.bezier(0.4, 0, 0.2, 1),
} as const;

// Pulse — drive via Reanimated's withTiming + a custom progress 0..1..0.
// Use: pulse.value = withSequence(withTiming(1, { duration: 200, easing: EASING.out }),
//                                 withTiming(0, { duration: 600, easing: EASING.inOut }));
```

> Do **not** modify `SPRING` or `TIMING` values. They're correct.

### Add motion budget constants

```ts
// Aurora Refined v2 motion budget — see docs/aurora-refined-v2/MOTION.md.
// Every animation in the app should pick from these or compose them.
export const MOTION_BUDGET = {
  pressFeedback:    120,  // tap scale
  microFeedback:    220,  // chip flash
  reveal:           360,  // standard surface arrival
  hero:             520,  // hero entry
  morphLong:       1600,  // hex radar score morph
  textReveal:      1900,  // AI insight typing (49 chars/sec)
  staggerTight:      40,  // tight row stagger
  stagger:           70,  // standard row stagger (timeline, sheet tiles)
} as const;
```

---

## Phase 3 · `src/components/ui/GlassCard.tsx`

Two changes: weaken `accentGlow` overlay, drop the press-opacity feedback in
favor of scale.

### Weaken accent glow

```diff
       Platform.OS === 'web'
         ? ({
-            background: `radial-gradient(ellipse at top left, ${accent}22, transparent 70%)`,
+            background: `radial-gradient(ellipse at top left, ${accent}14, transparent 65%)`,
           } as unknown as ViewStyle)
-        : { backgroundColor: accent + '12' },
+        : { backgroundColor: accent + '08' },
```

### Replace press opacity with a soft scale

Replace the entire `Pressable` block:

```diff
     return (
       <Pressable
         onPress={onPress}
-        style={({ pressed }) => [
-          { borderRadius: radiusValue, opacity: pressed ? 0.92 : 1 },
-        ]}
+        style={({ pressed }) => [
+          {
+            borderRadius: radiusValue,
+            transform: [{ scale: pressed ? 0.985 : 1 }],
+            opacity: pressed ? 0.96 : 1,
+          },
+        ]}
         accessibilityRole="button"
       >
```

---

## Phase 3 · `src/components/gamification/XpBar.tsx`

If the file applies `boxShadow` to the fill bar, remove it. The bar should be
flat. Keep gradient if present — gradient ≠ glow.

```diff
-  boxShadow: `0 0 12px ${color}88`,
```

(Search the file; if no match exists, no change needed — already clean.)

---

## Phase 3 · `src/components/gamification/AvatarRing.tsx`

Open the file. If the level chip uses a `shadowColor` matching its fill or any
`boxShadow` with non-zero blur, replace with a flat border:

```diff
-  shadowColor: '#FFD66B',
-  shadowOpacity: 0.5,
-  shadowRadius: 8,
+  borderWidth: 1.5,
+  borderColor: '#0B0712',  // hairline against the canvas
```

The progress arc itself stays as-is.

---

## Phase 4 · `src/components/gamification/HexRadar.tsx`

The refined radar reads as a **data instrument**, not a hero ornament.

### Polygon stroke — thinner

```diff
-        <Path d={dataPath} fill={c.primary} fillOpacity={0.18} stroke={c.primary} strokeWidth={2} />
+        <Path d={dataPath} fill={c.primary} fillOpacity={0.14} stroke={c.primary} strokeWidth={1.25} strokeLinejoin="round" />
```

### Dots — smaller, no halo ring

The current code draws an outer halo circle (`r + 8` with 15–30 % opacity).
Remove it. Reduce dot radius from `4 + (score/100)*5` to a flat `3`.

```diff
-          const r = 4 + (score / 100) * 5;
+          const r = 3;
           return (
             <G key={d.key} onPress={() => onDomainPress?.(d.key)}>
-              <Circle cx={pos.x} cy={pos.y} r={r + 8} fill={dotColor} opacity={0.15 + (isActive ? 0.15 : 0)} />
+              {isActive && (
+                <Circle cx={pos.x} cy={pos.y} r={r + 5} fill="none" stroke={dotColor} strokeWidth={1.25} opacity={0.6} />
+              )}
               <Circle
                 cx={pos.x}
                 cy={pos.y}
                 r={r}
                 fill={dotColor}
-                stroke={isActive ? '#fff' : dotColor}
-                strokeWidth={isActive ? 2 : 0}
+                stroke={isActive ? c.background : dotColor}
+                strokeWidth={isActive ? 1.5 : 0}
               />
             </G>
           );
```

Active state becomes a 1-px ring around the dot instead of a soft glow circle.

### Grid rings — fewer, lighter

```diff
-  const rings = [0.25, 0.5, 0.75, 1.0];
+  const rings = [0.33, 0.66, 1.0];
```

Three rings instead of four. The 25 % ring noisy without adding information.

### Center fill — remove

```diff
-            fill={i === 3 ? c.primary + '10' : 'none'}
+            fill="none"
```

The polygon already provides fill; the outer-ring tint reads as visual lint.

### Yesterday outline — keep, but soften

```diff
           <Path
             d={yesterdayPath}
             fill="none"
             stroke={c.textMuted}
-            strokeWidth={1.5}
+            strokeWidth={1}
             strokeDasharray="4 3"
-            opacity={0.6}
+            opacity={0.4}
           />
```

---

## Phase 5 · `src/components/gamification/StreakRow.tsx`

The current row reads as a heavy colored card. Refined version reads as a
typographic row with hue as a marker, not a fill.

### Card surface — neutral, hue is a hairline left bar

```diff
   <View style={[styles.card, { backgroundColor: c.card, borderColor: color + '33', borderLeftColor: color }]}>
-    <View style={[styles.card, { backgroundColor: c.card, borderColor: color + '33', borderLeftColor: color }]}>
+    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border, borderLeftColor: color }]}>
```

Border is now the standard hairline; only the left edge carries domain hue.

### Drop the "Best:" Text fragment color emphasis

```diff
-      Best: <Text style={{ color }}>{best}</Text>
+      Best: <Text style={{ color: c.textSecondary }}>{best}</Text>
```

Keeps the hue exclusively for the active count, the flame, and the left bar.

### Style sheet — tighter padding and lighter borderLeftWidth

```diff
   card: {
     flexDirection: 'row',
     alignItems: 'center',
     gap: 14,
-    borderRadius: 20,
+    borderRadius: 16,
     borderWidth: 1,
-    borderLeftWidth: 3,
-    padding: 16,
+    borderLeftWidth: 2,
+    padding: 14,
   },
```

---

## Phase 5 · `src/components/gamification/StreakFlame.tsx`

Drop any `boxShadow` or `textShadow` on the count number or flame SVG. The
flame's existing gradient is enough warmth — text-shadow on it produces the
"slot machine" feeling the refinement removes.

Pattern to search and delete:

```diff
-  textShadow: ... ,
-  boxShadow: ... ,
```

Keep the flame `LinearGradient` — that's color, not glow.

---

## Phase 5 · `src/components/gamification/BadgeCard.tsx`

Earned badges should still feel warm but stop **radiating**. Drop any `boxShadow`
on the tile and the outer radial-gradient halo if present.

```diff
-  shadowColor: hue,
-  shadowOpacity: 0.5,
-  shadowRadius: 16,
+  // Earned state is signaled by border-color saturation + glyph color,
+  // not by glow. Halo bloom lives in BadgeUnlock motion (see MOTION.md).
```

The unlock *moment* still has a halo bloom — that's a one-shot animation, not
a resting style. See `MOTION.md` scene 05.

---

## Phase 6 · `src/components/shared/RoutineBlock.tsx`

Two changes: drop the `activeGlow` boxShadow, swap NOW-pill glow for a flat
fill, and promote the `onPress` handler to `onLongPress` with a press-progress
arc.

### Drop active card glow

```diff
-  const activeGlow = isActive && Platform.OS === 'web'
-    ? ({ boxShadow: `0 0 24px ${moduleColor}33, inset 0 0 0 1px ${moduleColor}55` } as unknown as object)
-    : undefined;
```

Remove the prop where applied:

```diff
       <View
         style={[
           styles.container,
           isActive && { borderColor: moduleColor + '66', backgroundColor: moduleColor + '11' },
-          activeGlow as object,
         ]}
       >
```

### Drop dot glow

```diff
           <View
             style={[
               styles.dot,
               { backgroundColor: moduleColor },
-              isActive && Platform.OS === 'web'
-                ? ({ boxShadow: `0 0 12px ${moduleColor}` } as unknown as object)
-                : undefined,
             ]}
           />
```

### Drop NOW pill glow

```diff
             <View
               style={[
                 styles.nowPill,
                 { backgroundColor: moduleColor },
-                Platform.OS === 'web'
-                  ? ({ boxShadow: `0 0 20px ${moduleColor}77` } as unknown as object)
-                  : undefined,
               ]}
             >
```

### Long-press complete — see `MOTION.md` scene 02 for full implementation

Phase 6 prompts will paste a full replacement for `handleComplete` + the
status button. Don't attempt it from this delta alone.

---

## Phase 7 · `app/(tabs)/index.tsx` (Today)

Two changes covered in detail by motion scenes 01 + 07.

1. **Mount stagger.** Use `useStaggerDelay()` (already exported from
   `theme/motion.ts`) and Reanimated's `FadeIn.delay(d).duration(420)` to
   sequence: header → headline → radar surface → timeline rows. Cap stagger
   at index 5 (matches existing hook behavior).
2. **Scroll-driven sticky header.** When the `ScrollView`'s `contentOffset.y`
   crosses 80 px, fade in a compact band (avatar 32, title, search, mic FAB)
   that sits above the scroll. The hero greeting + radar surface dim/translate
   up at half velocity for parallax.

Implementation pattern, in detail, lives in `MOTION.md` scenes 01 + 07.

---

## Phase 8 · `src/components/shared/DailyBriefing.tsx`

Typed reveal of the AI insight body. See `MOTION.md` scene 08 for the full
pattern. Single-state hook: `useTypedText(fullString, { startDelay, charsPerSec })`.

---

## Phase 9 · `src/components/shared/LifeHubSheet.tsx` + `VoiceAssistantSheet.tsx`

Both sheets should use `SPRING.soft` for translateY on mount, `TIMING.normal`
for backdrop opacity, and `useStaggerDelay(50)` for any tile grid inside.
Most sheets already do something close — the diff is making sure every sheet
uses the same vocabulary.

See `MOTION.md` scene 06 for the full enter / exit timing chart.

---

## Phase 10 · Brilliant-inspired press + gradient + celebration pass — ✅ shipped 2026-06-09

Unlike the phases above, this one is **already applied** — it's recorded here as the
design-system log of what landed, not an apply-me diff. Motivation: a competitive
pass over Brilliant's "feel alive" interaction language (physical press, gradient
progress, distinct haptics, number rolls, celebration bursts). Zero new deps — all
`react-native-reanimated` + `expo-linear-gradient` (already installed) + `expo-haptics`.
Rive was evaluated and **deliberately skipped** (needs Expo prebuild; Reanimated
covers the same ground). Verified: `npm run typecheck` clean on all touched files,
242/242 component tests, gradient bars confirmed in a real web build.

### `src/theme/colors.ts` — `+ add` `DOMAIN_GRADIENTS`

A two-stop (hue → ~25 % lighter) gradient per domain, plus `primary` and `xp`. This
is **additive** — it does not touch the existing palette (the "do not change
`colors.ts`" rule above is about the resting hues, not new tokens). Consumed by the
gradient progress bars below; `useGoalTypeColor()` now also returns a `gradient` pair.

### `src/components/ui/Button.tsx` — press opacity → spring scale

Same move Phase 3 made for `GlassCard`, now on the primary `Button`. The flat
`opacity: pressed ? 0.85 : 1` is replaced by a spring scale to **0.97** on `onPressIn`
and back on `onPressOut`, wrapping the content in an `Animated.View`. Commit haptic
softened `Medium → Light` (guardrail 2 + 4: immediate *feel*, light touch).
Accessibility/loading/disabled surface unchanged — `Button.test` still green.
(The scale logic was subsequently extracted into the shared `usePressScale` hook —
see the press-feel rollout below; Button now consumes it.)

### `src/hooks/usePressScale.ts` — `+ add` (new) — shared press-feel, rolled out to cards

The spring-compression interaction extracted into one reusable primitive so every
tappable surface shares one motion vocabulary instead of each re-implementing opacity
dips or ad-hoc scales. Returns `{ onPressIn, onPressOut, animatedStyle }`; honors
reduce-motion for free (`useSpringConfig` collapses to a near-instant overdamped spring
at motion intensity 0). Convention: controls compress to **0.97**, larger card surfaces
to a gentler **0.98** so the motion reads as proportional to size.

Rolled out to the tappable surfaces:

- **`Button.tsx`** — refactored onto the hook (removed its inline copy; no behavior change).
- **`GlassCard.tsx`** — replaced the Phase 3 discrete `scale: 0.985` + opacity dip with
  the spring hook. Highest-leverage: every `GlassCard onPress={…}` across the app now
  springs, with no per-call-site change.
- **`QuestCard.tsx`** — replaced the `opacity: pressed ? 0.9 : 1` dip; the card style
  moved onto an inner `Animated.View` carrying the scale.
- **`GoalCard.tsx`** — its `onPress` branch now wraps `content` in a scaled `Animated.View`.

Deliberately **not** applied to `RoutineBlock.tsx` — it owns a bespoke long-press-to-
complete gesture (Phase 6 / MOTION scene 02) that a press-scale could fight. Left for a
later pass that coordinates the two. Verified: typecheck clean on touched files, 15/15
across `Button`/`QuestCard`/`GoalCard` tests, GoalCard confirmed rendering post-restructure
in a real web build.

### `src/components/ui/ProgressBar.tsx` + `src/components/gamification/XpBar.tsx` — gradient fill

Both gained an optional `gradientColors?: readonly [string, string]` prop. When set,
the animated fill renders an `expo-linear-gradient` (left→right) instead of a solid
`backgroundColor`; omitted → solid, fully backwards-compatible. Wired through all six
module progress bars (`GoalCard`, `FinanceGoalCard`, `GoalHierarchy`, `SkillGapChart`,
`LearningResourceCard`, `SocialScoreCard`) using `DOMAIN_GRADIENTS` / the goal-type
gradient. `XpBar` defaults to `DOMAIN_GRADIENTS.xp`.

### `src/components/gamification/XpChip.tsx` — number roll

The XP amount now rolls on change with the **scene 04 / StreakFlame** choreography
(old value slides up + fades, new springs in from below via `EASING.bounce`), gated on
`useMotionScale()`. Because the chip now renders prefix / number / suffix as separate
`Text` nodes, it exposes a composed `accessibilityLabel` (`+30 XP`) — `XpChip.test` and
`QuestCard.test` assert against that label.

### `src/components/gamification/RewardOrchestrator.tsx` — streak haptic + burst

Streak beats now fire `ImpactFeedbackStyle.Heavy` (a satisfying "thud") while XP beats
stay `Light`. Peak beats (any streak, or XP ≥ 50) also mount a `CelebrationBurst`.

### `src/components/gamification/CelebrationBurst.tsx` — `+ add` (new) — see MOTION.md scene 12

A radial particle burst (12 dots, even angular spread, gravity arc, fade) for
celebration peaks. Pure Reanimated, fixed-count `Particle` children, skipped entirely
under reduce-motion. Full pattern documented in `MOTION.md` scene 12.

### Tooling · `.claude/skills/run-lifeos/driver.mjs` — `+ add` `--rich` seed

Opt-in flag (requires `--seed`) that layers stepped goals + finance goal/milestones +
contacts so the gradient bars and social score render filled for visual regression
(Career 75 %, Health 40 %, Finance 50 %, Social 60 %). See the skill's SKILL.md.

### Tests · `e2e/visual-regression.spec.ts` — `+ add` (new) — screenshot baselines

A Playwright `visual` project that pins the gradient bars against committed
screenshots. Seeds the same filled proportions via `seedVisualRich` (the in-suite
mirror of `--rich`, with reduce-motion + A2HS-dismissed for determinism), captures
`/goals` and `/social` on an iPhone-13 viewport, and asserts `toHaveScreenshot`.
Run `npm run visual` / `npm run visual:update`. Deliberately **not** in CI —
Playwright baselines are OS-specific and this repo's CI is Linux (see e2e/README.md
§ Visual regression).

---

## What you should NOT change

- `src/theme/colors.ts`, `typography.ts`, `spacing.ts`, `density.ts`, `surfaces.ts`, `shadows.ts` — leave alone.
- `src/ai/**`, `evals/**`, `workers/**` — out of scope.
- `app/(tabs)/_layout.tsx` — tab structure stays.
- `src/store/**` — no state-shape changes.
- `design-bundle/`, `design upgrade/` — reference only, do not modify.
- Any file containing `Supabase`, `drizzle`, `expo-health`, `expo-calendar`, `expo-notifications` integration — leave alone.
