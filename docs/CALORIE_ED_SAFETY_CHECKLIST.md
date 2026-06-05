# Calorie / Nutrition surface — eating-disorder (ED) safety checklist

> **Status:** the calorie-target surface shipped with the **code-level** guardrails below (PR #125 + the voice nutrition tool). The items marked ☐ still need a **human sign-off** (product + ideally a clinician) **before** the calorie/nutrition surface is *promoted* — i.e. before we add notifications/nudges about it, feature it in onboarding, gamify it, or surface meal targets more aggressively. This file is that gate.
>
> **Why this exists:** calorie trackers are a recognised ED-trigger surface. Research consistently finds diet/fitness apps can intensify rigid calorie-counting, number-fixation, and shame; "make the number more precise/authoritative" is the direction flagged as harmful. A confidently-wrong personalised number can be worse than an honestly-flagged estimate. Sources at the bottom.

## Already in place (code guardrails — ✅)
- ✅ **Honest framing** — the target is labelled an *estimate*, not a fact: "Estimated from your vitals — a guide, not medical advice" (personalised) / "Generic estimate. Add your age + vitals to personalise — not medical advice" (fallback). The voice `getTodayNutrition` tool carries the same "guidance, not medical advice" note.
- ✅ **Safe floors** — the engine never recommends below the standard safe minimum: **1500 kcal (men) / 1200 kcal (women)**. No "extreme deficit" goal option exists; the steepest goal (`lose_weight`) is a ~18% deficit, within the evidence-based 10–20% range.
- ✅ **Pull, not push** — calorie tracking is opt-in (the user opens the Health tab / vitals editor); nothing proactively pushes it.

## Required before promoting the surface (human sign-off — ☐)
- ☐ **Present a range, not a single hard number?** Decide whether to show "~1,900–2,100 est." rather than a single authoritative figure. (Recommended by the red-team review; not yet implemented.)
- ☐ **No shaming UI** — audit `CalorieRing` / `MealSuggestionsCard` and any "over budget" state: no red/danger framing for exceeding the target, no guilt copy. Neutral language only. *(Action: review the over-target visual state.)*
- ☐ **Crisis off-ramp** — add a discreet, always-available link to eating-disorder support (region-aware, e.g. NEDA in the US / Beat in the UK / regional equivalent) on the Health/food surface. *(Not yet present — concrete action item.)*
- ☐ **No gamification pressure on calorie accuracy** — do **not** add streaks/badges/XP tied to *hitting* a calorie target exactly (that rewards restriction). Logging food can be encouraged; "you stayed under budget" celebration must not.
- ☐ **Vulnerable-user copy review** — a human (ideally with clinical input) reviews all calorie/macro/meal copy for triggering language before any promotion.
- ☐ **No proactive calorie notifications** without this checklist complete — e.g. "you have 600 kcal left today" push notifications are out of scope until sign-off.

## Adaptive TDEE compounds the risk
Any "we learned your *real* expenditure is X" number (see [`ADAPTIVE_TDEE_DESIGN.md`](ADAPTIVE_TDEE_DESIGN.md)) reads as *more* authoritative than a formula estimate, so the guardrails above are **prerequisites**, not parallel work — ship the safety items before the adaptive number.

## Sign-off
| Reviewer | Role | Date | Notes |
|---|---|---|---|
| | Product | | |
| | Clinical / safety (recommended) | | |

## Sources
- [Effects of diet and fitness apps on eating-disorder behaviours (BJPsych Open)](https://www.cambridge.org/core/journals/bjpsych-open/article/effects-of-diet-and-fitness-apps-on-eating-disorder-behaviours-qualitative-study/2D1EE739D97AB3EFC6573835E4C527BD)
- [Fitness-tracking apps & eating disorders (National Center for Health Research)](https://www.center4research.org/fitness-tracking-apps-eating-disorders/)
- [The trouble with tracking (Duke Psychiatry)](https://psychiatry.duke.edu/blog/trouble-tracking)
- [Preventing another "Tessa": safety as a first-class component (arXiv 2509.07022)](https://arxiv.org/pdf/2509.07022)
