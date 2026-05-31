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

## ✅ Sprint 2 — Tier 1 remainder, profile-accuracy & quick logs (DONE except voice)

| Item | What shipped |
|------|--------------|
| **Biological sex** | `users.sex` column (+ migration, web shim). Feeds the exact Mifflin-St Jeor constant (+5 male / −161 female) in `calorieTargets()`; still falls back to the −78 midpoint when unset. Set via `EditVitalsSheet`. |
| **Activity level** | `users.activity_level` column. Replaces the fixed 1.45 multiplier with sedentary→very_active factors (`ACTIVITY_OPTIONS`). Set via `EditVitalsSheet`. |
| **Water tracker** | `health_logs.water_ml` increments; `WaterCard` with +250/+500 quick-add, undo, and a goal (~35 ml/kg). Summed per day via `getWaterMlForDate`. |
| **Energy-level quick log** | `EnergyCard` 1–5 check-in writing `health_logs.energyLevel` (column existed, had no UI). `getLatestEnergyForDate` reads today's value. |

Added 3 `calorieTargets` tests (sex constants + activity scaling) → 18/18 health-util tests pass.

### ✅ Sprint 2 follow-ups (DONE)

- [x] **Voice food logging (web)** — `useSpeechRecognition` (Web Speech API, feature-detected,
  web-only) transcribes on-device → new self-contained `src/ai/voiceFood.ts` `parseSpokenMeal()`
  → AddFoodSheet "Speak" mode reuses the existing review/confirm flow. Deliberately does **not**
  touch the Gemini Live `voiceClient.ts` path (active in a parallel branch) — it reuses the
  `FoodRecognition` schema/mock and the `recogniseFood` model tier, so no shared AI-registry edits.
- [x] **Collect sex + activity during onboarding** — added to `day3-health` (optional chips), so
  new users get an exact calorie target from day one instead of only via `EditVitalsSheet`.

### Remaining

- [ ] **Voice food logging on native** — needs a native STT module (`@react-native-voice/voice`)
  + rebuild; the Web Speech API path is web-only. The "Speak" entry point hides itself on native.
- [ ] **Infer activity from Fit** — optionally seed the activity level from recent
  average steps instead of asking.

## Tier 2 — the differentiators (medium effort)

- [x] 🌟 **Recovery score → Routine Builder (Sprint 3)** — `src/utils/recovery.ts`
  `computeRecoveryScore()` blends sleep duration, deep-sleep %, HR-vs-baseline, and
  prior-day load into a 0–100 score (Oura/Whoop-style), shown on the Health tab via
  `RecoveryCard`. Persisted to `health_logs.recovery_score`; `useReplanFlow` feeds it into
  the existing `softenForRecovery` wire so a low-recovery day eases the re-plan — **no edits
  to the replan core** (`types.ts`/`replanApply.ts`/prompts). Degrades gracefully to a
  sleep-only score without Fit.
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

- `calorieTargets()` now uses **exact** Mifflin-St Jeor sex constants and an activity
  factor when `users.sex` / `users.activity_level` are set (Sprint 2); it still falls
  back to the −78 midpoint offset and a 1.45 factor when they're unset (e.g. before the
  user opens *Edit vitals*).
- Food entries are **hard-deleted** (no `deletedAt` column, like routine blocks). The
  soft-delete convention applies to durable data (goals, contacts), not daily logs.
- Meal-suggestion entries are logged with `quantityG: 0` (a composed meal has no single
  weight) and `source: 'search'`.
- **Water** is stored as signed `health_logs.water_ml` increments summed per day; the
  *Undo* button logs a negative increment rather than deleting a row. **Energy** takes
  the latest row's `energyLevel` for the day.
