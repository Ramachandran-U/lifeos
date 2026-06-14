# Explore: "Dive vs Bridge" — user-chosen exploration

> Status: PLAN (not yet implemented) · Branch: `feat/explore-deep-dive` · Author: session 2026-06-15
> Scope: give users agency to explore an interest **individually (Dive)** or **across disciplines (Bridge)**, feeding the existing rabbit-hole / expedition / frontier engines. **The YouTube import feature is preserved unchanged** — it is the one place users already have agency and is the pattern we build on, not replace.

---

## 1. Problem & intent

Explore today is a **curation engine**: the system chooses what you explore and you react. Every discovery entry point is auto-seeded:

| Entry point | Single vs cross | Who picks the topic | Where |
|---|---|---|---|
| Daily Spark (hero) | cross (interest × adjacent) | system rotates by day | [spark.ts](../src/explore/spark.ts) |
| Frontier | cross (best A×B edge) | system auto-ranks | [frontier.ts:67](../src/explore/frontier.ts#L67) `pickFrontierPair` |
| Cross-Discipline card | cross | system `pickPair()` | [explore.tsx:131](../app/(tabs)/explore.tsx#L131) |
| Chasing now | single | system (from logs) | [chasing.ts] |
| Expedition (5–7 steps) | **single, deep** | seeded only from a Spark | [expeditionGen.ts:38](../src/explore/expeditionGen.ts#L38) |
| Rabbit hole | **both** (deeper/sideways) | seeded only from Spark/Frontier/Chasing | [rabbit-hole.tsx:28](../app/rabbit-hole.tsx#L28) |
| **YouTube import** | — | **the user** (toggle interests) | [YouTubeImportCard] — **DO NOT TOUCH** |

Two real gaps:
1. **Single-idea depth exists but is unreachable directly.** Expeditions and the rabbit hole's "Go deeper" already do single-topic depth — but you can only start them from a system-chosen Spark, so depth *feels* absent and Explore reads as cross-discipline-only.
2. **No "pick what I want to explore."** The only user agency is the YouTube toggle. The rabbit hole — the user's specific ask — has no user-chosen seed; [InterestCard](../src/components/modules/polymath/InterestCard.tsx) has no "explore" action (only log / delete / depth / protect).

**The fix is agency + an explicit depth entry point, not new intelligence — the engines are already capable.**

## 2. The model: two verbs on any interest

Add two user-invokable verbs, available on every interest, anytime:

- **Dive** → one idea, deep. Launches a rabbit hole **rooted on that interest** (depth-first: "Go deeper" drills the idea, "Branch sideways" twists within/around it).
- **Bridge** → two ideas, across. Pick a second interest → launches a cross-discipline rabbit hole seeded with both (`seedInterest` + `seedAdjacent`).

Serendipity (the daily Spark) **stays** — agency is added *alongside* it, never replacing it. Nothing about YouTube import, Spark, Frontier, Chasing, or Expeditions is removed.

Both verbs reuse the **existing** rabbit-hole machinery ([rabbit-hole.tsx](../app/rabbit-hole.tsx) already accepts inline seeds: `seedTitle`, `seedBody`, `seedInterest`, `seedAdjacent`, `sparkId`). No engine rewrite for Phase 1 — mostly wiring + one sheet.

---

## 3. Phase 1 — pick-to-explore (small, high-leverage)

### 3.1 Feature flag (ships dark)
- **`src/store/useFlagStore.ts`** — add `explore_pick_to_explore: false` to the defaults map (next to `explore_frontier`/`explore_chasing`, [useFlagStore.ts:64-66](../src/store/useFlagStore.ts)). Gate the new affordance so it can be flipped per-rollout, matching the project's flag culture. (Optionally mirror in `src/config/flags.ts` if a compile-time check is wanted; runtime flag is sufficient.)

### 3.2 Pure seed builders (new, unit-testable)
- **`src/explore/exploreLaunch.ts`** (NEW) — pure functions, no I/O:
  - `buildDiveParams(interest: { id: string; name: string }): RabbitHoleRouteParams` → seeds a single-idea rabbit hole: `seedTitle = name`, `seedInterest = name`, `seedAdjacent = ''`, a depth-oriented `seedBody`/threadStarter, `sparkId = \`interest-${id}\``.
  - `buildBridgeParams(a, b): RabbitHoleRouteParams` → `seedInterest = a.name`, `seedAdjacent = b.name`, `seedTitle = \`${a.name} × ${b.name}\``, `sparkId = \`bridge-${a.id}-${b.id}\``.
  - Synthetic, stable `sparkId`s mean re-opening the same Dive/Bridge resumes the same saved map (via `getRabbitHoleTreeBySpark` in [rabbitHoleActions.ts:151](../src/explore/rabbitHoleActions.ts#L151)) instead of spawning duplicates.
- **`src/explore/__tests__/exploreLaunch.test.ts`** (NEW) — assert param shape, stable sparkIds, and that distinct interests/pairs produce distinct ids.

### 3.3 Launcher hook (keeps the screen diff tiny)
- **`src/hooks/useExploreLauncher.ts`** (NEW) — wraps navigation + side-effects so [explore.tsx](../app/(tabs)/explore.tsx) barely changes (minimises merge surface with the parallel session):
  - `dive(interest)` → `router.push(buildDiveParams(...))` + `track(EVENTS.exploreDiveStarted)` + `triggerStreak(userId, 'learning')`.
  - `bridge(a, b)` → `router.push(buildBridgeParams(...))` + `track(EVENTS.exploreBridgeStarted)` + streak.

### 3.4 Chooser UI (new component)
- **`src/components/modules/polymath/ExploreActionSheet.tsx`** (NEW) — bottom sheet opened for one interest:
  - Two primary choices: **Dive** ("Go deep on {name}") and **Bridge** ("Connect {name} with…").
  - Bridge expands to an **interest picker** listing the user's *other* active interests; picking one calls `bridge(a, b)`.
  - Design: neutral `Card`/sheet surface, **ink selection** (`surfaceAlt` / `textPrimary`, never violet — passes `violetVoiceCompliance`), polymath hue only as the R3 domain mark, `StyleSheet.create`, haptics on every tap. Follows existing sheets (`DepthSheet`, `AddInterestSheet`).
  - Empty/edge: if the user has <2 interests, **Bridge** is shown disabled with a one-line hint ("Add another interest to bridge"); **Dive** always works.

### 3.5 Interest card affordance
- **`src/components/modules/polymath/InterestCard.tsx`** — add an **optional** `onExplore?: () => void` prop and, when provided, render an "Explore" button next to "Log" in the `progressRow` (polymath-tinted pill, mirrors the Log button at [InterestCard.tsx:104](../src/components/modules/polymath/InterestCard.tsx#L104)). Optional prop = backward-compatible; existing call sites/tests unaffected.

### 3.6 Wire into the screen
- **`app/(tabs)/explore.tsx`** — minimal diff:
  - read `pickToExplore = useFlagStore(s => s.isEnabled('explore_pick_to_explore'))`,
  - `const launcher = useExploreLauncher()`, sheet state `const [exploreFor, setExploreFor] = useState<Interest | null>(null)`,
  - pass `onExplore={pickToExplore ? () => setExploreFor(interest) : undefined}` to each `<InterestCard>` ([explore.tsx:731](../app/(tabs)/explore.tsx#L731)),
  - render `<ExploreActionSheet visible={!!exploreFor} interest={exploreFor} otherInterests={...} onDive={launcher.dive} onBridge={launcher.bridge} onClose={() => setExploreFor(null)} />`.
  - **`app/rabbit-hole.tsx` needs no change** — it already maps inline params to a `RabbitHoleSeed`.

### 3.7 Telemetry
- **`src/utils/telemetry.ts`** — add `exploreDiveStarted: 'explore_dive_started'` and `exploreBridgeStarted: 'explore_bridge_started'` to `EVENTS` (alongside [telemetry.ts:68-73](../src/utils/telemetry.ts#L68)). Lets us compare user-initiated vs system-initiated exploration engagement.

### 3.8 Tests / gates
- Unit: `exploreLaunch.test.ts` (seed shape + stable ids), `ExploreActionSheet` render + Bridge-disabled-when-<2.
- Reuse existing: rabbit-hole engine tests already cover node generation/scoring — Dive/Bridge only feed it new seeds.
- Green bars required: `npm run typecheck` (0), `npx jest` (full), manifesto/violet compliance ratchets, schema-drift (no schema change in Phase 1).

### Phase 1 file summary
| File | Change |
|---|---|
| `src/store/useFlagStore.ts` | + `explore_pick_to_explore: false` |
| `src/explore/exploreLaunch.ts` | NEW — pure seed builders |
| `src/explore/__tests__/exploreLaunch.test.ts` | NEW — tests |
| `src/hooks/useExploreLauncher.ts` | NEW — nav + telemetry + streak |
| `src/components/modules/polymath/ExploreActionSheet.tsx` | NEW — Dive/Bridge chooser + interest picker |
| `src/components/modules/polymath/InterestCard.tsx` | + optional `onExplore` + Explore button |
| `app/(tabs)/explore.tsx` | wire flag + sheet (tiny diff) |
| `src/utils/telemetry.ts` | + 2 EVENTS |

No DB/schema change, no Worker change, no new AI task (reuses `generateRabbitHoleNode`). **YouTube import untouched.**

---

## 4. Phase 2 — true single-idea depth + more agency (outline)

1. **Dive-aware rabbit-hole nodes.** Today "Branch sideways" always jumps to an *adjacent discipline* (cross) — see the SIDEWAYS_FRAMES in [rabbitHole.ts:71](../src/explore/rabbitHole.ts#L71). For a genuine single-idea Dive, add a `mode: 'dive' | 'bridge'` to `RabbitHoleInput` so in Dive mode "sideways" means **sibling sub-topics within the same field** (breadth-in-topic), not another discipline. Threads through `buildGenParams` ([rabbitHoleActions.ts:67](../src/explore/rabbitHoleActions.ts#L67)) and a `RABBIT_HOLE_NODE_PROMPT` variant. This is the one real engine change for "breadth twists within one idea."
2. **"Turn this into a 7-step plan."** Add an Expedition path from a chosen interest via `generateExpedition({ seedInterest })` ([expeditionGen.ts:92](../src/explore/expeditionGen.ts#L92)) — the strongest breadth+depth single-topic artifact — respecting `MAX_ACTIVE_EXPEDITIONS`.
3. **Free-text seed.** "What are you curious about?" entry on the Explore screen → Dive on an arbitrary phrase (not just existing interests).
4. **Make Frontier/Cross-Discipline pickable.** Keep auto as default, but let the user choose the pair instead of `pickPair`/`pickFrontierPair`.
5. **Saved maps per interest.** Group "Your maps" by seed interest so a Dive's history is discoverable.

---

## 5. Risks & constraints
- **Parallel session.** `app/(tabs)/explore.tsx` is a shared hotspot. The hook-based design keeps its diff to ~5 lines; all real logic lives in new files (conflict-free). Merge conflicts, if any, resolve at PR time.
- **Design guards.** New sheet must be ink-selected (no violet), neutral cards, tokens only, `StyleSheet.create`, haptics — or CI ratchets fail.
- **Cost / rate limit.** User-initiated exploration = more AI calls; gated by the flag + the existing proxy rate limit. Acceptable.
- **Empty states.** Dive needs the interest (always present); Bridge needs ≥2 interests (disabled otherwise).
- **Do not regress YouTube import, Spark, Frontier, Chasing, or Expeditions** — all remain; this is purely additive.

## 6. Rollout
Ship Phase 1 behind `explore_pick_to_explore` (off) → verify in browser (driver/seeded session) → flip on for internal → measure dive/bridge telemetry vs system-seeded engagement → decide Phase 2.
