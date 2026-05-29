# STORE_TOPOLOGY — Zustand stores

15 stores under `src/store/` + 2 finance stores (`src/finance/store/`) + 2 ambient stores (`src/components/shared/ambient/`).

## Store inventory

| Store | File | LOC | Slice / Ownership |
|-------|------|----:|-------------------|
| `useUserStore` | `src/store/useUserStore.ts` | 39 | Logged-in user, onboarding stage, primary domains, `ONBOARDING_COMPLETE` sentinel, `DomainId` type |
| `useGameStore` | `src/store/useGameStore.ts` | 281 | Gamification: domain scores, streaks, badges, XP (weekly+total), quests |
| `useGoalStore` | `src/store/useGoalStore.ts` | 25 | Goals cache + CRUD |
| `usePolymathStore` | `src/store/usePolymathStore.ts` | 166 | Interests, suggestions cache, cross-discipline cache, expedition state; helper `suggestionsAreStale` |
| `useTrajectoryStore` | `src/store/useTrajectoryStore.ts` | 34 | Cached `assessTrajectory` results |
| `useDomainHistoryStore` | `src/store/useDomainHistoryStore.ts` | 137 | Rolling per-domain `ScorePoint[]` history |
| `useFlagStore` | `src/store/useFlagStore.ts` | 80 | Feature flags (persisted) |
| `useMotivationStore` | `src/store/useMotivationStore.ts` | 40 | Per-key motivation copy cache |
| `usePreferencesStore` | `src/store/usePreferencesStore.ts` | 97 | Theme mode, density, motion intensity, gamification visibility, narration prefs |
| `usePromptStore` | `src/store/usePromptStore.ts` | 71 | Live prompt overrides pulled from admin portal |
| `useRewardQueueStore` | `src/store/useRewardQueueStore.ts` | 49 | Queue of XP/badge/level reward beats consumed by `RewardOrchestrator`; exports `enqueueXPReward` |
| `useTelemetryStore` | `src/store/useTelemetryStore.ts` | 33 | Legacy shim — telemetry buffer |
| `useThemeStore` | `src/store/useThemeStore.ts` | 24 | Theme mode (selector-style hook, not `create()`) |
| `useBehaviourSuggestionsStore` | `src/store/useBehaviourSuggestionsStore.ts` | 84 | Behaviour pattern suggestions (persisted) |
| `useAnnualReviewStore` | `src/store/useAnnualReviewStore.ts` | 36 | Cached annual review |
| `useTransactionStore` | `src/finance/store/useTransactionStore.ts` | 197 | Finance transactions |
| `useMoneyReviewStore` | `src/finance/store/useMoneyReviewStore.ts` | — | Monthly money review cache; exports `currentMonthKey` |
| `useAmbientEventStore` | `src/components/shared/ambient/useAmbientEventStore.ts` | — | Ambient UX events (energy sweep, pulses) |
| `useAmbientState` | `src/components/shared/ambient/useAmbientState.ts` | — | Derived ambient render state |

## Usage hotspots (import count across `src/` + `app/`)

| Store | Importers |
|-------|----------:|
| `useUserStore` | 50 |
| `useGameStore` | 17 |
| `usePreferencesStore` | 7 |
| `useDomainHistoryStore` | 7 |
| `useThemeStore` | 6 |
| `useFlagStore` | 4 |
| `usePromptStore` | 3 |
| `useTelemetryStore` | 2 |
| `useRewardQueueStore` | 2 |
| `usePolymathStore` | 2 |
| `useGoalStore` | 2 |
| `useBehaviourSuggestionsStore` | 2 |
| `useTrajectoryStore` | 1 |
| `useMotivationStore` | 1 |
| `useAnnualReviewStore` | 1 |

## Cross-store imports (coupling)

Direct store-to-store imports were searched (`from '@/store/use…Store'` inside another store file). None of the stores import other stores — coupling is via consumer components.

Notable consumer fan-in:
- `LifeScoreHero` reads `useGameStore + useUserStore + useDomainHistoryStore` — central composite.
- `AddGoalSheet` reads `useUserStore + useGoalStore`.
- `QuestDetailSheet` reads `useGameStore + useUserStore`.
- `discovery-confirm.tsx` writes `useUserStore + useGameStore` at completion.
- `RewardOrchestrator` reads `useRewardQueueStore + usePreferencesStore`.

## Coupling risks

1. **`useUserStore` is a god-store hub.** 50 import sites — type `DomainId` is re-exported from it; many modules pull both data and the type from the same module. Splitting domain-id types into `@/types/domain` would reduce coupling.
2. **`useGameStore` (281 LOC) bundles XP + streaks + badges + quests + domain scores.** This is the second largest store. Consider splitting `quests`, `badges`, `streaks` into dedicated slices — boundary already partly drawn (`useRewardQueueStore`, `useDomainHistoryStore`).
3. **`useTelemetryStore` is documented as a legacy shim.** Two importers remain — clean-up candidate.
4. **`useThemeStore` and `usePreferencesStore` overlap on theme mode** — preferences has `ThemeMode = 'dark'|'light'`, theme store has the same. Single source needed.
5. **Ambient stores live under `components/shared/ambient/`** rather than `src/store/` — discoverability gap.
6. **Finance stores live under `src/finance/store/`** — fine domain bound, but breaks the "look in `src/store/`" convention used elsewhere; the cross-cutting `useTransactionStore` (197 LOC) is invisible to a `src/store/` search.
7. **Persistence is inconsistent.** Some stores use `persist()` (Flag, DomainHistory, Telemetry, Trajectory, AnnualReview, Behaviour, MoneyReview, Preferences, Prompt, Polymath), others are pure-memory (User, Game, Goal, Reward queue, Motivation, Theme, Transaction). User + Game state being non-persisted means they must hydrate from SQLite on every cold start — verify this is intentional and exhaustively covered.
8. **`useThemeStore` uses a custom selector signature** (`useThemeStore<T>(selector?)`) instead of `create()` — divergence from every other store API.
