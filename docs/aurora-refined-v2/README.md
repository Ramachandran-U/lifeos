> **SUPERSEDED by Ink + Signal (see COLOR_RECOMMIT spec). Color/wash guidance in this folder no longer applies; motion scenes remain valid.**

# Aurora Refined v2 · handover

Surgical refinement pass for LifeOS. **This is not a redesign.** Layouts, palette,
fonts, component names, and product mental model are preserved. What changes is
posture: less performative, more inhabited.

This folder is the canonical reference for the refinement. Drop it into the repo
at `docs/aurora-refined-v2/` and Claude Code reads it phase-by-phase.

---

## TL;DR for Claude Code

You will perform a **token + component refinement** of the existing Aurora
Refined design system, plus integrate 11 motion scenes. The repo already has:

- `src/theme/colors.ts` — palette matches the refined design **exactly**. Do not edit.
- `src/theme/typography.ts` — font stack matches. Do not edit.
- `src/theme/motion.ts` — SPRING + TIMING tokens are correct in shape. Add
  two new easings (`bounce`, `pulse`) for streak ticks and attention bells.
- `src/theme/elevation.ts`, `radii.ts` — needs **tuning**, not rewriting.
- `src/components/{ui,shared,gamification,modules}/` — refine in place. No
  new files unless this doc explicitly says to create one.

Read the four sibling docs in this order:

| # | File | Purpose |
|---|------|---------|
| 1 | `README.md` (this file) | Strategy + phase order |
| 2 | `DELTA.md` | Line-level token + component diffs |
| 3 | `MOTION.md` | 11 scenes → existing-component integration points |
| 4 | `PROMPTS.md` | Phased prompts to paste in this Claude Code session |

`USER-INSTRUCTIONS.md` is the human's workflow — not for Claude Code.

---

## Preserved

- **Aurora palette.** Same six domain hues (`#C9A0FF / #7EE0B8 / #F4C16A / #7FB8FF / #FF99C5 / #FFD66B`), same primary `#A584FF`, same dark canvas `#0A0612`. `src/theme/colors.ts` is unchanged.
- **Typography.** Nunito display, DM Sans body, JetBrains Mono meta. `typography.ts` is unchanged.
- **Layouts.** Today, Health, Finance, Rewards, Profile keep their information architecture. No screens are added or removed.
- **Hex Radar concept.** Still the hero of Today and Profile. Refined visually, not conceptually.
- **Gamification systems.** XP, streaks, badges, quests stay. Their *visual loudness* drops.
- **Glass DNA.** Surfaces still translucent. The elevation system is consolidated, not replaced.

## Tuned down

- **Neon glow.** Drop `boxShadow` glow rings on z3 cards, NOW pills, streak flames, badge tiles. Light should fall on data, not radiate from it.
- **Aurora wash.** Keep `AuroraBackground.tsx`, but reserve full intensity for the Today hero. Other screens get a clean canvas. A fade-out band below the hero prevents bleed.
- **Tinted everything.** Cards lean neutral (`rgba(255,255,255,0.04)`). Hue lives in dots, a 1px accent border, or a single bar — not the entire fill.
- **Gamification noise.** Streak rows compress to a tighter grid. Badge tiles drop the outer halo. No confetti specks on the rewards hero. XP toasts arrive briefly and leave.
- **Random radii.** Five values only: `hairline 4 / tile 10 / control 14 / card 22 / pill 999`. Add `lg 20` and `xl 28` only if MOTION.md sheet/intro work needs them.

## Added (motion + interaction)

- **11 motion scenes** — see `MOTION.md`. Each maps to an existing component or screen. No new top-level screens.
- **Two new easings** — `bounce` (streak tick), `pulse` (attention bell).
- **Long-press complete** — promote the existing tap-to-complete to long-press in `RoutineBlock.tsx` with a press-progress arc.
- **Mount stagger** — wire `useStaggerDelay` (already exists) through Today screen entry.
- **AI text reveal** — character-by-character on `DailyBriefing.tsx` insight body.
- **Sheet enter/exit** — refine `LifeHubSheet.tsx` + `VoiceAssistantSheet.tsx` to use `SPRING.soft` consistently.

## Phase order (Claude Code follows this)

| Phase | Scope | Verification gate |
|-------|-------|-------------------|
| 0 | Orient: read this folder + run `npm test` to confirm baseline green | tests pass |
| 1 | `elevation.ts` + `radii.ts` token tuning | tests pass, screenshot Today |
| 2 | `motion.ts` — add `bounce` + `pulse` easings | tests pass |
| 3 | `GlassCard.tsx`, `AvatarRing.tsx`, `XpBar.tsx` — drop glow | tests pass, snapshot diff |
| 4 | `HexRadar.tsx` — thinner stroke, smaller dots, no halo ring | tests pass, manual visual |
| 5 | `StreakRow.tsx`, `BadgeCard.tsx`, `StreakFlame.tsx` — quiet gamification | tests pass |
| 6 | `RoutineBlock.tsx` — long-press complete + press-progress arc | tests pass, manual interaction |
| 7 | `app/(tabs)/index.tsx` — mount stagger + scroll-driven sticky header | smoke pass |
| 8 | `DailyBriefing.tsx` — typed insight reveal | tests pass |
| 9 | `LifeHubSheet.tsx`, `VoiceAssistantSheet.tsx` — sheet motion polish | smoke pass |
| 10 | Final sweep: `npm run verify` (tsc + jest + smoke) | all green |

Each phase has a numbered prompt in `PROMPTS.md`. Do not skip ahead. Each
phase must commit before the next begins.

---

## Hard rules

1. **Do not touch `src/theme/colors.ts` or `typography.ts`.** They already match the refined design exactly.
2. **Do not create new top-level screens** under `app/`. All work lives in existing files.
3. **Do not edit `src/ai/**`, `evals/**`, or `workers/**`.** This is a visual + interaction pass. AI behavior is out of scope.
4. **Do not delete `design-bundle/`.** It's reference for the earlier design state.
5. **Use existing `motion.ts` tokens.** `SPRING.standard / soft / snappy / gentle` and `TIMING.fast / normal / slow / epic` cover 95% of needs. Only add `bounce` + `pulse` easings (Phase 2).
6. **Use existing `radii.ts` tokens.** Add `lg: 20` and `xl: 28` if and only if Phase 9 (sheets) needs them.
7. **Run `npm test` after every phase.** If anything breaks, fix the test or revert — don't proceed.
8. **Respect `useMotionScale()`.** Every animation must scale by it. The repo already enforces reduce-motion.
9. **Keep snapshots updated.** Run `npm test -- -u` after intentional visual changes; review the diff before committing.

---

## Source of truth for the refined design

This folder. The HTML designs (`LifeOS Aurora Refined v2.html` + `LifeOS Motion Pass.html`) are reference exports; this document is what Claude Code follows. If they disagree, this document wins.

Why? HTML uses div + CSS; React Native uses View + StyleSheet. Direct port would
introduce visual regressions. The token-level deltas in `DELTA.md` are the
correct translation.
