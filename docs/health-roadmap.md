# Health Engine — Feature Roadmap & Backlog

> Source: competitive analysis of Apple Health, MyFitnessPal, HealthifyMe (Ria/Snap),
> Noom, and Whoop/Oura (May 2026). Tiers reflect impact vs. effort. This file is the
> running tracker for health-section work — keep statuses current as items ship.

## Strategic angle

LifeOS should **not** try to out-database MyFitnessPal. Its moat is the **master
planner + cognition layer + unified event-sourced log across 6 domains**. The health
features that win are the ones a single-purpose health app *cannot* build:
recovery-aware replanning, cross-domain correlations, and a coach that sees the whole
life. Prioritise those over nutrition-DB depth.

---

## ✅ Sprint 1 — "make logging effortless + rewarding" (DONE)

Low-risk wins, mostly wiring existing pieces. Shipped on `test/coverage-ci-followup`.

| # | Item | What shipped |
|---|------|--------------|
| 1 | **Smart calorie & macro targets** | `calorieTargets()` in `src/utils/health.ts` — sex-neutral Mifflin-St Jeor BMR → TDEE → goal adjustment. Replaces the hard-coded `2000`. Macro targets shown in `CalorieRing`. Falls back to generic target (flagged `estimated: false`) when vitals missing. |
| 2 | **Food entry edit & delete** | `updateFoodEntry` / `deleteFoodEntry` (native + Dexie web). `FoodEntryRow` is tap-to-edit with a delete affordance; `AddFoodSheet` has an edit mode. |
| 3 | **Meal suggestions wired in** | `MealSuggestionsCard` surfaces the previously-orphaned `suggestMeals()` AI fn. Builds the gap context from today's totals + target + flagged blood markers; one-tap log into a chosen meal slot. |
| 4 | **Health streaks** | Food-log + workout streaks (`useGameStore.triggerStreak`) surfaced as a streak card on the Health tab. Food streak fires on any food log; workout streak fires on a Fit-synced workout dated today. Grace-day logic already in `updateStreak`. |

---

## Sprint 2 candidates — Tier 1 remainder (low effort)

- [ ] **Voice food logging** *(deferred from Sprint 1 — larger lift)*. Reuse
  `src/ai/voiceClient.ts` (Gemini Live) → transcript → parse into food entries.
  MyFitnessPal's headline 2025 feature. Touches the audio-capture path, hence its own
  sprint.
- [ ] **Water tracker** — most-requested simple tracker. New lightweight log + a quick
  +250ml tap row. No AI.
- [ ] **Energy-level quick log** — the `healthLogs.energyLevel` (1–5) column already
  exists with no UI. Add a one-tap row; feeds future correlations.
- [ ] **Biological sex on profile** — unblocks an exact (non-sex-neutral) BMR in
  `calorieTargets()`. Needs a `users.sex` column + migration + one onboarding question.
- [ ] **Activity-level selector** — replace the fixed 1.45 TDEE multiplier; could be
  inferred from recent Fit avg steps.

## Tier 2 — the differentiators (medium effort)

- [ ] 🌟 **Recovery score → Routine Builder** — synthesize Fit sleep + resting HR +
  active minutes into a 0–100 readiness score (Oura/Whoop-style), then feed it into
  `replanRestOfToday` so a low-recovery day automatically softens the plan. *No
  competitor can do this — they have no planner.* Sleep is already persisted
  (`getLatestSleepHours`); `fitInsights.ts` already computes rule-based signals.
- [ ] 🌟 **Conversational health coach** — extend the `whatNext` tool-use agent
  (`src/ai/agent/`) with read-only health tools (food, sleep, blood markers) so users
  can ask "why am I tired this week?" — Ria-style.
- [ ] **Noom-style reflection loop** — on a detected calorie overage / skipped workout
  (cognition layer), prompt a short "what was going on?" reflection in
  `evening-reflect`. Builds the habit, not just the log.
- [ ] **Cross-domain correlations** — "goal progress drops 30% on nights under 6h
  sleep." Only LifeOS can do this via the unified mutation log.
- [ ] **Auto-detect food photos** (HealthifySnap-style) — opportunistic prompt to log a
  recently-taken meal photo. Gallery permissions + heuristics.

## Tier 3 — depth & polish

- [ ] **Micronutrient & nutrition-quality tracking** (Cronometer-style) — extend
  `foodEntries`; pair with blood-report flags (low Vit D → highlight D-rich foods).
- [ ] **Intermittent fasting timer** (Zero-style) — simple, popular, low effort.
- [ ] **Blood-report trends over time** — chart a marker (e.g. cholesterol) across the
  multiple stored reports.
- [ ] **Manual workout logging** — Fit shows workouts but there's no manual add for
  users without a wearable.
- [ ] **Health history export** — weekly/monthly digest; export for doctor visits.
- [ ] **Proximity/social context** — research's most underused retention lever; lower
  priority given LifeOS's privacy-first, local-only stance.

---

## Notes / known shortcuts to revisit

- `calorieTargets()` uses a **sex-neutral** Mifflin-St Jeor (midpoint offset −78) and a
  **fixed 1.45** activity multiplier because the `users` table stores neither sex nor
  activity level. Both are Sprint-2 Tier-1 items above.
- Food entries are **hard-deleted** (no `deletedAt` column, like routine blocks). The
  soft-delete convention applies to durable data (goals, contacts), not daily logs.
- Meal-suggestion entries are logged with `quantityG: 0` (a composed meal has no single
  weight) and `source: 'search'`.
