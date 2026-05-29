# TECH_DEBT_CANDIDATES — LifeOS

Evidence-based — line counts and concrete file paths. Not a code review; just inventory of risk surfaces.

## Files over 500 LOC (god-object / fat-screen candidates)

| LOC | File | Category |
|----:|------|----------|
| 1530 | `app/(tabs)/finance.tsx` | Screen |
| 1124 | `app/(tabs)/index.tsx` | Screen (Home/Today) |
|  930 | `src/ai/types.ts` | AI schemas/types — single-file dump of every Zod schema |
|  839 | `app/what-lifeos-knows.tsx` | Screen |
|  831 | `src/ai/functions.ts` | 27 AI functions in one file |
|  776 | `app/(tabs)/career.tsx` | Screen |
|  629 | `app/(tabs)/profile.tsx` | Screen |
|  620 | `src/components/modules/health/AddFoodSheet.tsx` | Component sheet |
|  578 | `app/evening-reflect.tsx` | Screen |

`app/(tabs)/finance.tsx` at 1530 LOC is the single biggest debt item; it composes finance components, runs Gmail-based ingestion, manages multiple modal sheets, and reaches into both `useTransactionStore` and `useUserStore + useGameStore`. Splitting per-section subviews into `src/components/modules/finance/` is the obvious path.

## Files 300–500 LOC (watch list)

| LOC | File |
|----:|------|
| 480 | `app/(tabs)/health.tsx` |
| 472 | `app/(onboarding)/day1-routine.tsx` |
| 470 | `src/components/shared/ProfileSidebar.tsx` |
| 434 | `app/(tabs)/explore.tsx` |
| 415 | `src/components/shared/RoutineBlock.tsx` |
| 391 | `app/contact/[id].tsx` |
| 361 | `app/(onboarding)/discovery-confirm.tsx` |
| 360 | `src/db/index.ts` |
| 357 | `src/components/shared/LifeBalanceDashboard.tsx` |
| 355 | `src/data/foods/seed.ts` (data file, acceptable) |
| 353 | `app/(onboarding)/discovery-chat.tsx` |
| 345 | `src/components/modules/social/AddContactSheet.tsx` |
| 340 | `workers/ai-proxy/src/claude.ts` |
| 336 | `app/(tabs)/goals.tsx` |
| 332 | `src/utils/behaviourPatterns.ts` |
| 318 | `src/components/modules/health/FitDashboard.tsx` |
| 317 | `src/db/schema.ts` |
| 314 | `src/integrations/googleFit/client.ts` |
| 305 | `app/(onboarding)/day7-finance.tsx` |
| 303 | `app/notifications-settings.tsx` |

## Architectural drift

1. **Two parallel persistence layers without an explicit interface.**
   `src/db/queries/*` (Drizzle / SQLite, 17 files) and `src/db/webStorage/*` (Dexie / AsyncStorage, 16 files) are manually kept in sync. There is no shared abstract repository — divergence between native and web is a constant risk. Tests exist for some web modules (`cognitiveInsights`, `expeditions`, `routine`, `sparks`) but not for the SQLite equivalents.

2. **`src/db/index.ts` (native, 360 LOC) vs `src/db/index.web.ts`.** Drizzle on one side, hand-rolled on the other. Migrations exist only for native (`migrations/0000…0003`).

3. **Two Gmail/Google OAuth code paths.**
   - Generic driver: `src/integrations/google/oauth.ts` (220 LOC) is the shared `createGoogleOAuthClient` factory.
   - `src/finance/gmail/oauth.ts` is a separate Gmail OAuth not consuming the shared driver. Per `CLAUDE.md`, all new Google integrations should use the shared driver. Gmail is the exception. Consolidation candidate.

4. **Provider-name mismatch in proxy URL.**
   `src/ai/client.ts` hits `${PROXY_URL}/claude` while `modelRouter.ts` exclusively emits Gemini model IDs and a comment notes "the worker runs `LLM_PROVIDER=gemini`". The endpoint name is misleading and Claude-specific code (`workers/ai-proxy/src/claude.ts` 340 LOC) is dead-or-fallback. Either rename to `/llm` or remove the Claude path.

5. **`src/ai/types.ts` (930 LOC) is the single schema/type file for every AI function.** Splitting per-domain (`types/goals.ts`, `types/finance.ts`, …) would mirror the prompts/mocks/queries folder pattern already used.

6. **`src/ai/functions.ts` (831 LOC, 27 exports).** Already shares mocks + prompts via re-exports; splitting into `functions/<domain>.ts` to mirror prompts/mocks is the natural pattern.

7. **`useGameStore` (281 LOC)** mixes XP, streaks, badges, quests, domain scores. `useRewardQueueStore` and `useDomainHistoryStore` were carved out already — quests + badges are the next slice boundaries.

8. **`useTelemetryStore` documented as a legacy shim** but still has 2 importers — schedule removal.

9. **`useThemeStore` is structurally different from every other store** (custom selector signature, not `create()`). Plus it overlaps with `usePreferencesStore.themeMode`. Two sources of truth for the same field.

10. **`expo-health` pinned at `0.0.0`** (placeholder). HealthKit integration is not implemented, despite Day-3 onboarding asking for health data. The codebase does have Google Fit, so iOS Health Connect is the gap.

11. **Sync layer (`src/sync/*`)** — `hashChain`, `lamport`, `mutationLog` are unit-tested but not invoked from any write path. Either wire them in or document as deferred (Phase 2 per CLAUDE.md).

12. **Onboarding `discovery-*` flow** (`day1-vision` + `discovery-intro/paste/chat/confirm`) duplicates Day-1 questioning routes. Likely an A/B fork that needs collapsing.

13. **`expo.log` committed at repo root.** Dev artifact in the working tree.

14. **`design-bundle/LifeOS.zip` + `LifeOS (1).zip` + `design upgrade/`** in tree — large binary assets in git, not used at build time.

## Coupling risks

- **`useUserStore`** with 50 importers is the most heavily depended-on module. It also exports the `DomainId` type, conflating data + type concerns.
- **Cross-store composition lives in screens**, not in dedicated selectors. `LifeScoreHero`, `RewardOrchestrator`, `DomainNudgeCard` all wire 2–3 stores inline.
- **Direct `callAI` invocations in non-`functions.ts` modules:** `src/explore/spark.ts`, `src/explore/expeditionGen.ts`, `src/components/shared/DailySummarySheet.tsx`, `src/ai/agent/planner.ts`. The schema-failure telemetry helper in `functions.ts` is therefore only effective for the 27 wrapped functions — other call sites lack the same observability.

## Scalability concerns

- **Single 1530-LOC route file** will be a re-render hotspot; finance reload performance should be benchmarked once real Gmail volumes appear.
- **In-memory cost ledger** (`src/ai/costLedger.ts`) resets on app reload — fine for dev, but production cost visibility relies fully on server-side worker logs + telemetry. Confirm worker emits per-request cost.
- **`src/data/foods/seed.ts` (355 LOC)** is the embedded food DB. `scripts/build-food-db.js` exists — the seed file should be generated, not hand-edited.
- **No Suspense/code-splitting** on the web build despite very large screen files. `dist/` has 149 files; the home/finance routes likely dominate the bundle.

## Test coverage observations

- AI: 10 test files in `src/ai/__tests__/`, 2 in `mocks/__tests__/`, 1 in `rag/__tests__/`.
- DB: only 2 native query tests (`goalComments`, `social`); 4 web storage tests. Most queries untested.
- Stores: only `useDomainHistoryStore` and `useTrajectoryStore` have tests.
- Components: zero unit tests under `src/components/`.
- E2E (`e2e/`): 5 specs (`ambient`, `auth.setup`, `career-strategy`, `notifications-prefs`, `smoke`, `voice-assistant`).

## Quick wins (no-architecture-change)

1. Delete `expo.log` and zip files from tree; add to `.gitignore`.
2. Generate `src/data/foods/seed.ts` from `scripts/build-food-db.js` and remove the static file.
3. Remove `useTelemetryStore` shim; migrate 2 importers.
4. Collapse `useThemeStore` into `usePreferencesStore`.
5. Split `src/ai/types.ts` per-domain (mechanical refactor).
6. Rename `/claude` worker endpoint to `/llm` for honesty, even if alias is kept.
