# PROMPTS · paste into Claude Code, one phase at a time

Open Claude Code at the repo root. Make sure `docs/aurora-refined-v2/` exists
with all four reference docs. Then paste these prompts in order, one per
session turn. Wait for Claude Code to finish each phase, review the diff,
verify the gate, commit, then move on.

> **For every phase.** If tests fail or the smoke test breaks, do not proceed.
> Either fix the test (if the visual change is intended) or revert and re-prompt.

---

## Phase 0 · Orient

```
Read docs/aurora-refined-v2/README.md, then DELTA.md, then MOTION.md.
Don't make any changes yet.

After reading, confirm to me:
1. The five "hard rules" from README.md
2. The phase order (10 phases)
3. Which existing files you'll be editing in Phase 1
4. Which existing files are forbidden to touch

Then run: npm test
Report whether the baseline is green.
```

**Gate.** Claude Code echoes the rules accurately and `npm test` is green.

---

## Phase 1 · Tokens · elevation + radii

```
Apply the Phase 1 deltas from docs/aurora-refined-v2/DELTA.md.

Specifically:
- src/theme/elevation.ts: tune darkLevels.z3 and lightLevels.z3 to remove
  the primary-color halo. Use the exact diffs in DELTA.md.
- src/theme/radii.ts: add `lg: 20` and `xl: 28`. Keep all existing values.

Do not touch any other files.

After editing:
1. Run: npm test
2. Run: tsc --noEmit
3. Show me a unified diff of the two files.
```

**Gate.** Tests green, types green, diff matches DELTA.md.
**Commit.** `refactor(theme): drop primary-color halo on z3 elevation, extend radii scale`

---

## Phase 2 · Motion easings + budget constants

```
Apply the Phase 2 delta from docs/aurora-refined-v2/DELTA.md.

In src/theme/motion.ts:
- Add the EASING export with out / soft / spring / bounce / inOut.
- Add the MOTION_BUDGET constants.
- Do NOT modify SPRING, TIMING, TIMING_CFG, useMotionScale, useSpringConfig,
  useTimingConfig, useStaggerDelay.

After editing, run npm test and show me the diff.
```

**Gate.** Tests green. No existing exports renamed or removed.
**Commit.** `feat(motion): add EASING tokens and MOTION_BUDGET constants`

---

## Phase 3 · Shared primitives · drop glow

```
Apply the Phase 3 deltas from docs/aurora-refined-v2/DELTA.md.

Files:
1. src/components/ui/GlassCard.tsx
   - Weaken the accent glow overlay
   - Replace press opacity with a soft scale (0.985) + opacity (0.96)
2. src/components/gamification/XpBar.tsx
   - Search for and delete any boxShadow on the fill bar
3. src/components/gamification/AvatarRing.tsx
   - Search for and delete any shadow on the level chip
   - Replace with a 1.5 px border using #0B0712 if there was a shadow

After editing:
1. Run npm test
2. If any snapshot tests fail because of the visual change, regenerate
   them with: npm test -- -u, then show me the snapshot diff so I can
   confirm the change is intended.
3. Show me a unified diff of all three files.
```

**Gate.** Tests green or snapshots regenerated and diff approved.
**Commit.** `refactor(ui): quiet GlassCard accent, drop XpBar / AvatarRing glow`

---

## Phase 4 · HexRadar · thinner + smaller

```
Apply the Phase 4 deltas from docs/aurora-refined-v2/DELTA.md.

File: src/components/gamification/HexRadar.tsx

Changes:
- Polygon stroke: width 2 → 1.25, fillOpacity 0.18 → 0.14, add strokeLinejoin="round"
- Dots: drop the outer halo circle (r + 8). Reduce radius to flat r = 3.
  For active state, draw a 1.25 px stroke ring at r + 5 instead of a
  filled halo.
- Active dot stroke color: c.background instead of '#fff'.
- Grid rings: drop 0.25, keep [0.33, 0.66, 1.0].
- Outer-ring center fill: remove (use fill="none" for all rings).
- Yesterday outline: stroke 1.5 → 1, opacity 0.6 → 0.4.

After editing:
1. Run npm test
2. If snapshot tests need regeneration: npm test -- -u
3. Show me the diff.
4. Take a screenshot of app/(tabs)/index.tsx in web preview if you can
   (npm run web), or describe what the new radar looks like.
```

**Gate.** Tests green, manual visual confirms thinner stroke and smaller dots.
**Commit.** `refactor(hex-radar): thinner stroke, flat dots, three grid rings`

---

## Phase 5 · Gamification · quiet streak + badge

```
Apply the Phase 5 deltas from docs/aurora-refined-v2/DELTA.md.

Files:
1. src/components/gamification/StreakRow.tsx
   - Border: use c.border for the outline (only borderLeft keeps the
     domain color)
   - Drop hue from the "Best:" number text
   - Style: borderRadius 20 → 16, borderLeftWidth 3 → 2, padding 16 → 14
2. src/components/gamification/StreakFlame.tsx
   - Delete any textShadow or boxShadow on the count or flame
   - Keep the LinearGradient on the flame SVG
3. src/components/gamification/BadgeCard.tsx
   - Delete any boxShadow / shadowColor on the tile
   - Earned state is signaled by border color saturation + glyph color,
     not by radiating glow
   - Leave the structure intact; this is a visual deemphasis only

After editing, run npm test, regenerate snapshots if needed, show diffs.
```

**Gate.** Tests green. Streak rows read as typographic rows, not heavy colored cards.
**Commit.** `refactor(gamification): drop glow from streak rows, flames, badges`

---

## Phase 6 · RoutineBlock · long-press + drop glow

This phase has two parts. Apply them in order.

### 6a · Drop the resting glow

```
Apply the Phase 6 "drop glow" delta from docs/aurora-refined-v2/DELTA.md.

File: src/components/shared/RoutineBlock.tsx

Delete:
- The activeGlow constant (the boxShadow on isActive cards)
- The boxShadow on the time-rail dot when isActive
- The boxShadow on the NOW pill

Do NOT change the long-press behavior yet. Run npm test, show diff.
```

**Commit.** `refactor(routine-block): drop active-state glow shadows`

### 6b · Long-press to complete

```
Now refactor src/components/shared/RoutineBlock.tsx to use a long-press
gesture instead of a single tap to complete.

Read docs/aurora-refined-v2/MOTION.md scene 02 for the full pattern.

Requirements:
- Hold duration: 1000 ms (use the existing TIMING.epic? No — use a local
  HOLD_MS const, since hold-to-confirm is its own duration not a token).
- Press-progress arc: a small circle around the time-rail dot whose
  stroke-dashoffset is driven by a pressP shared value.
- Cancel cleanly if the user lifts before HOLD_MS.
- Haptics only fire on commit, not on press start.
- Existing onComplete callback wiring stays the same.
- All animations gated by useMotionScale() — reduce-motion users get
  an instant tap-to-complete fallback (~120 ms tap window).

After editing:
1. Run npm test
2. Run npm run smoke:local — if any smoke test was tapping a routine
   block to complete it, you'll need to update the test to hold instead.
   Update the smoke tests in e2e/ if necessary, justifying each change
   in a short comment in the test file.
3. Show diff for RoutineBlock.tsx and any e2e/ files changed.
```

**Gate.** Tests + smoke green. Manual: hold a routine block on web preview, watch progress arc fill.
**Commit.** `feat(routine-block): long-press to complete with press-progress arc`

---

## Phase 7 · Today · mount stagger + scroll-driven header

```
Apply mount stagger and scroll-driven sticky header to app/(tabs)/index.tsx.

Read docs/aurora-refined-v2/MOTION.md scenes 01 and 07 for full patterns.

Mount stagger (scene 01):
- Wrap top-level sections (greeting row, headline, hex radar surface,
  timeline rows) in Animated.View with FadeIn delays.
- Use useStaggerDelay() (already exported from theme/motion.ts) for the
  timeline rows.
- Delays: 0 (greeting), 120 (headline), 280 (radar), 420+stagger(i) (rows).

Scroll-driven sticky header (scene 07):
- Use useAnimatedScrollHandler to capture scroll Y.
- When scrollY crosses 80 → 160 px, fade in a compact band:
  Avatar(32) + "Today" title + meta + search icon + MicFab(32).
- Aurora wash translates at -0.5 × scrollY (parallax).
- Hero greeting (greeting row + headline) fades 0 → -200 px scroll.

DO NOT change the screen's information architecture or which components
it renders. Only wrap them in animation layers and add the sticky band.

After editing:
1. Run npm test
2. Run npm run smoke:local
3. Show diff for app/(tabs)/index.tsx.
4. If the smoke test scrolls Today, verify it still passes; if not,
   debug or update the selector in e2e/.
```

**Gate.** Tests + smoke green. Manual: scroll Today on web, watch hero compress and sticky band appear.
**Commit.** `feat(today): mount stagger + scroll-driven sticky header`

---

## Phase 8 · DailyBriefing · typed insight reveal

```
Apply scene 08 from docs/aurora-refined-v2/MOTION.md to
src/components/shared/DailyBriefing.tsx.

Add a useTypedText hook (inline in the file, or as a sibling helper in
src/hooks/useTypedText.ts — your call, but prefer the latter if it can
be reused for other AI reveal moments).

Requirements:
- Default reveal rate: 49 chars/sec
- Configurable startDelay (default 0)
- Honor useMotionScale() — when 0, reveal full text instantly
- Sparkle pulse on the leading "✦" icon (one-shot 320 ms in + 400 ms out)
- If the briefing body contains a markdown-style emphasis (**text**),
  preserve the existing parsing — the typed reveal works on the rendered
  text length, not the source markdown length.

After editing:
1. Run npm test
2. Show diff.
3. Describe what the briefing looks like during the typing animation.
```

**Gate.** Tests green. Manual: refresh Today, watch the daily briefing type itself in.
**Commit.** `feat(briefing): typed reveal for AI insight body`

---

## Phase 9 · Sheets · enter / exit polish

```
Apply scene 06 from docs/aurora-refined-v2/MOTION.md to:
- src/components/shared/LifeHubSheet.tsx
- src/components/shared/VoiceAssistantSheet.tsx

For each sheet:
- TranslateY enter via withSpring(useSpringConfig('soft'))
- Backdrop opacity via withTiming(useTimingConfig('normal'))
- Inner tile/grid stagger via useStaggerDelay(50) wrapped in FadeIn
- Exit timing chart in MOTION.md scene 06 — apply exactly.

If either sheet already uses an existing bottom-sheet library, just
configure that library's spring + duration props to match. Don't
hand-roll if the library handles it.

After editing:
1. Run npm test
2. Run npm run smoke:local
3. Show diff for both files.
```

**Gate.** Tests + smoke green. Manual: open Life hub and voice sheets, confirm spring feels soft, tiles stagger in.
**Commit.** `refactor(sheets): unify enter/exit motion vocabulary`

---

## Phase 10 · Final sweep

```
Run the full verification:
1. tsc --noEmit
2. npm test
3. npm run evals          (mock mode)
4. npm run smoke:local

Report any failures with file + test name + brief diagnosis.
If any failure is a legitimate regression caused by phases 1-9, propose
the smallest possible fix and ask before applying.

Then do a final audit:
- Grep for any remaining boxShadow with non-zero blur referencing a
  domain hue or c.primary. List each occurrence with file:line.
- Grep for any textShadow. List each occurrence.
- Grep for any direct hex string starting with #A584 / #C9A0 / #7EE0 etc.
  in src/components/ — confirm each one is using a token (c.primary,
  c.goal, etc.) or is justified (e.g. a static gradient stop in an SVG
  that intentionally bypasses theming).

Output a one-paragraph summary of what was done across all 10 phases
suitable for a PR description.
```

**Gate.** All four checks green. Glow grep returns zero hits in components/. PR description ready.
**Commit.** `chore(aurora-v2): final sweep — verify clean, no residual glow`

---

## If something goes sideways

**Test fails after a phase you didn't expect.**

```
The test [name] is failing after Phase [N]. Show me:
1. The test's expected vs actual output
2. Whether this is a snapshot test (visual) or a behavioral test
3. Whether the failure is consistent with the visual changes from this
   phase or whether it indicates an unintended regression.
Then propose: regenerate snapshot, fix the visual regression, or revert.
```

**Smoke test fails because a selector changed.**

```
The smoke test [name] is failing because [reason]. The Aurora Refined v2
pass shouldn't change information architecture — if a selector broke,
it's likely because a component now renders different DOM. Show me the
selector and the before/after DOM, then we'll either update the test
or update the component.
```

**TypeScript errors after adding EASING.**

```
TypeScript is complaining about [error]. Show me the error and the
relevant file:line. The Phase 2 changes should be additive only — if
the error is on a file you didn't edit, it's an import path issue. Fix
the import path or roll back the EASING import location.
```
