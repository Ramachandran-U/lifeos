# Adaptive TDEE — design scope (calorie v2 differentiator)

> **Status:** scoped, **not built**. This is the "learns your real expenditure from logged food + weight trend" feature (the MacroFactor playbook). It's a real ~1.5–2 day build with genuine accuracy *and* safety implications, so it warrants an explicit go/no-go rather than being slipped in. Decisions for sign-off are flagged **[DECIDE]**.

## Why
The current target uses Mifflin–St Jeor → activity-factor TDEE. That's the right *starting* estimate (±~10%), but self-reported activity is the dominant error source (most people over-report → target inflated by 300–500 kcal). An **adaptive** estimate that infers true Total Daily Energy Expenditure from the user's *own* logged intake vs. weight trend is materially more accurate after ~2–4 weeks of consistent logging, and turns "a formula guessed this" into "the app learned this about you" — the differentiating moment.

## The core idea (energy balance)
Over a window of `D` days:

```
TDEE ≈ (total calories consumed over D days − ΔbodyMass_kg × 7700) / D
```

- `7700 kcal ≈ energy in 1 kg of body mass` (standard approximation).
- `ΔbodyMass` comes from a **smoothed weight trend** (EMA), not raw scale readings — daily weight is dominated by water/food/glycogen noise.
- This is a *measured* expenditure, independent of the activity multiplier, so it absorbs NEAT, exercise, and individual metabolism.

## Data — already on-device
- **Intake:** `getFoodEntriesByDate` (food entries with calories) → daily kcal totals.
- **Weight:** health logs with `weight` (`getRecentWeightLogs`) → EMA trend.
Both are local; no new storage layer, no sync change (stays in the privacy boundary).

## Proposed shape
- `src/utils/adaptiveTdee.ts` — pure `computeAdaptiveTdee(intakeByDay, weightByDay) → { tdee: number | null, confidence: 'low'|'medium'|'high', daysUsed: number }`. Pure + unit-testable like `calorieTargets`.
- Blend with the formula until enough data:
  `displayedTarget = confidence === 'high' ? adaptive : confidence === 'medium' ? blend(adaptive, formula) : formula`.
- The existing goal adjustment (deficit/surplus + protein) layers **on top** of the adaptive maintenance number, unchanged.
- UI: show provenance — "Tailored to you · learned from your data" (adaptive) vs "Formula estimate" — reusing the `estimated`-flag pattern.

## Gates & edge cases (must handle)
- **Minimum adherence** — require e.g. **≥14 days** with **≥80% of days logged** and **≥2 weight readings/week** before showing an adaptive number. Below that → formula. **[DECIDE]** thresholds.
- **Incomplete logging is poison** — partial food logging makes intake look low → adaptive TDEE reads falsely low → under-eating advice. The adherence gate is the safety valve; also detect implausible results (e.g. TDEE < BMR) and discard.
- **Weight noise** — EMA with a sane half-life (~10 days); ignore single-day spikes.
- **Rate cap** — clamp how fast the adaptive number can move week-to-week.
- **Goal interaction** — adaptive replaces *maintenance* TDEE; deficit/surplus still applied after.

## Effort & risk
- **Effort:** ~1.5–2 days (util + tests + a small rolling store + UI provenance state).
- **Ship behind a feature flag**, formula as the always-available fallback.
- **Safety:** a "your real TDEE is X" number is *more* authoritative than a formula estimate → the [`CALORIE_ED_SAFETY_CHECKLIST.md`](CALORIE_ED_SAFETY_CHECKLIST.md) items (range presentation, crisis off-ramp, no shaming, no accuracy-gamification) are **prerequisites**, not parallel.

## Recommendation
Worth building **as a flagged v2** *after* the ED-safety checklist is signed off — it's the strongest "the AI understands me" proof point in Health. Do **not** ship it as the default target until the adherence gate and safety items are in place.

## Open decisions for sign-off
1. **[DECIDE]** Adherence thresholds (days logged, weight cadence) before adaptive shows.
2. **[DECIDE]** Blend curve (hard switch at "high" vs. gradual medium blend).
3. **[DECIDE]** Presentation — single number vs. range (ties to the ED-safety decision).
4. **[DECIDE]** Feature-flag name + rollout cohort.
