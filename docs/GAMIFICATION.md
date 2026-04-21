# Gamification

Cross-cutting system. UI lives in [`app/(tabs)/rewards.tsx`](../app/(tabs)/rewards.tsx) and [`app/(tabs)/index.tsx`](../app/(tabs)/index.tsx) (HexRadar + chips). Logic in [`src/utils/gamification.ts`](../src/utils/gamification.ts). State in [`src/store/useGameStore.ts`](../src/store/useGameStore.ts). Persisted via the `gamification` SQLite row (native) or localStorage (web).

## XP

```
XP_VALUES = {
  completeBlock: 10, completeGoalTask: 15,
  logFood: 5, logWeight: 10, uploadBloodReport: 50,
  completeResource: 100, earnBadge: 200, photoFood: 20,
}
```

Every handler that awards XP also calls `logBehaviourEvent(...)` and then `checkBadges(...)`.

## Levels

Triangular curve: `xpForLevel(n) = 100 * n * (n+1) / 2`.
- L1→L2 = 100 XP, L2→L3 = 300 XP cumulative, L10 ≈ 5,500 XP.
- `levelFromXP(xp)` and `xpProgressInLevel(xp)` drive the LevelRing on Today and Rewards.

## Streaks (5 types)

`workout, learning, foodTracking, journaling, social` — each `{ count, lastDate, graceUsed }`.

`updateStreak()` rules (based on days since `lastDate`):
- 0 → no change (already logged today)
- 1 → increment, reset `graceUsed`
- 2 AND grace unused → count holds, `graceUsed = true` (one free miss)
- else → reset to 1

## Badges (8)

`first_blueprint` (onboarding complete), `first_blood_report`, `goal_complete`, `skill_mastery`, `streak_30_any` (any streak ≥30), `life_balance` (all 6 domain scores >60), `week_1` (7 consecutive days), `food_photo` (used photo food log).

`checkBadges(current, context)` is a pure function returning newly earned badges only. New badges trigger `AchievementToast` and award `+200 XP` each.

## Domain Scores (0–100)

`goals, health, finance, career, social, mind`. Updated via `calculateDomainScore(completedToday, totalToday, current)` — weighted rolling: `0.7 * current + 0.3 * today%`. Rendered by the hexagonal radar in [`LifeBalanceDashboard.tsx`](../src/components/shared/LifeBalanceDashboard.tsx).

## Quests

2–3 daily + 1 weekly. Each has a module color, progress, and XP reward chip. Currently defined and rendered in the Rewards tab.

## Where to hook in

Adding a new XP source:
1. Add entry to `XP_VALUES`
2. Call `useGameStore.getState().addXP(n)` from the handler
3. Log the behaviour event so weekly insights pick it up
4. If it should unlock a badge, extend `checkBadges` context + the badge table on Rewards
