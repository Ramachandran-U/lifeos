# Explore, Reimagined — Today's Spark · Expeditions · Constellation

> Turns the Explore tab from an interest *tracker* (log minutes spent elsewhere) into a *curiosity engine* you actually explore inside. Three loops that feed each other; everything trackable and synced across devices.
> Builds on: existing polymath module (`interests`, `explorationLog`, `CrossDisciplineCard`, `DiscoverGrid`), the cognition engine, and the Phase 1 sync spine. Surfaces in `app/(tabs)/explore.tsx`.

## Status (updated 2026-05-30)

| Build step | Status | PR |
|---|---|---|
| 0 — Schema (`expeditions`, `expedition_progress`, `sparks`) + web parity | ✅ Shipped | PR #41 |
| 0 — `mergeStrategies['expedition_progress']` resolver registration | ⚠️ **Half-done** — `mergeExpeditionProgress()` exists (commutative+idempotent, property-tested) but isn't yet registered in `src/sync/resolve.ts` (that resolver doesn't exist; pending Phase 1 sync engine) | PR #41 (logic only) |
| 1 — Pure multi-expedition engine + set-union merge | ✅ Shipped | PR #41 |
| 2 — Daily Spark pipeline (callAI + Zod + hard guards + curated fallback) | ✅ Shipped | PR #41 |
| 3 — Expedition generation (callAI + Zod + structural guard + curated fallback) | ✅ Shipped | PR #41 |
| 4 — Constellation projection (pure nodes/edges, synapses, breadth×depth stats) | ✅ Shipped | PR #41 |
| 5 — UI: restructured Explore tab (`SparkHeroCard`, `ExpeditionProgressRow`, `ConstellationView`) + `/expedition-detail` | ✅ Shipped | PR #41 |
| 6 — Gamification (3 new badges, polymath score, 4 new XP values) + 12 new telemetry events | ✅ Shipped | PR #41 |
| Rabbit-hole branching view (in-app thread-pulling beyond a spark) | ⏳ Not started | — |
| Real spark-to-expedition graduation flow ("Start expedition" from a saved spark) | ⏳ Not started — `SparkHeroCard` exposes the action but the handler is a stub | — |
| Curiosity streak (forgiving, freezes) | ⏳ Not started — `curiosityStreakDay` event reserved | — |
| Expedition impact wiring in priority-change (`assessImpact.expeditionsSlowing`) | ⏳ Half-wired — the structure is in place; edit-priorities passes `[]` for now | — |

The rest of this doc is the original spec.

---

## A. Why (the diagnosis)

Today's Explore asks the user to go explore *somewhere else* and return to log minutes — homework, not exploration. The value happens outside the app, so there's no reason to open it. Fix = exploration happens **in-app**, gives a **daily reason to return**, and leaves a **compounding visible artifact**.

Three interlocking loops:

```
  TODAY'S SPARK  (daily pull, 2 min)
        │  pull a thread →
        ▼
  RABBIT HOLE  (in-app exploration, branching)
        │  a thread can graduate →
        ▼
  EXPEDITION  (multi-day themed journey, finite, completion-driven)
        │  every spark / step explored becomes a node →
        ▼
  CONSTELLATION  (the artifact: your mind, growing + cross-linked)
```

Synergy with what we just shipped: when the **domain-stagnation detector** finds `polymath` has gone quiet, "Today's Spark" is the perfect 2-minute action it points to. Explore stops being a dead-end tab and becomes the curiosity loop that feeds the polymath domain score.

## B. The three features

### B1. Today's Spark
One AI-generated, ~2-minute curiosity hit per day, personalized to the user's interests **plus a deliberate adjacent stretch** (the polymath thesis — connect distant fields). Actions on a spark: **Save** (→ constellation), **Pull the thread** (→ rabbit hole), **Dismiss**, or **Start an expedition** from it. The daily streak lives here (forgiving — freezes, not punishment).

### B2. Expeditions (the focus of this spec)
Finite, structured, multi-day themed journeys ("7 days into the history of jazz", "a week in behavioral economics"). Completion-driven — completion psychology is the strongest retention force we have.

**Requirements (explicit):**
- A user can **start multiple expeditions** and have several **active at once**.
- **Independent per-expedition progress** — advancing one never touches another.
- Progress is **tracked** (current step, completed steps, timestamps) and **synced across devices** with no lost progress.
- Resumable: leave mid-expedition, come back (on any device) exactly where you left off.

### B3. Constellation
A growing star-map of everything explored: nodes (interests, explored sparks, expedition topics) + edges (cross-discipline "synapses"). A **projection** — rebuildable from the underlying data, never a source of truth (same principle as the Phase 4 memory graph). This is the shareable, Wrapped-able artifact.

## C. Data model (with sync semantics — the heart of the ask)

All user-mutable rows below route through the Phase 1 `mutate()` write helper → mutation log → sync engine, so they sync for free. JSON columns on web mirror SQLite (web parity via `webStorage/*`).

### C1. `expeditions` — the journey definition (immutable once created)
```
expeditions(
  id, userId, title, theme, domain ('polymath' default),
  steps        JSON  -- [{ index, title, kind:'read'|'watch'|'do'|'reflect', prompt, estMinutes }]
  totalSteps   int,
  source       ('ai' | 'curated' | 'spark'),
  seedSparkId  text?,           -- when graduated from a spark
  createdAt
)
```
Immutable: the journey content doesn't change after generation, so it never conflicts on sync. It still syncs (so the *other* device has the steps to render progress against) — but as append-only, conflict-free.

### C2. `expedition_progress` — the tracked, synced, per-user-per-expedition state
```
expedition_progress(
  id, userId, expeditionId,
  status        ('active' | 'completed' | 'abandoned'),
  currentStep   int,            -- furthest unlocked step
  completedSteps JSON           -- int[] (a SET of completed step indexes)
  startedAt, lastActivityAt, completedAt?, updatedAt
)
-- unique (userId, expeditionId); one row per expedition the user started
```
**Multiple concurrent expeditions** = multiple `expedition_progress` rows; advancing one is an isolated update to its row. **No global "current expedition"** — that's the mistake that would prevent concurrency.

### C3. `sparks`
```
sparks(
  id, userId, date, title, body, domain,
  seedInterestIds JSON, kind,
  status ('new'|'seen'|'saved'|'dismissed'|'explored'),
  threadId text?,        -- links to a rabbit-hole thread if pulled
  createdAt
)
```

### C4. Constellation (projection — rebuildable)
```
constellation_nodes(id, userId, type:'interest'|'spark'|'expedition'|'concept', label, salience, sourceRef, createdAt)
constellation_edges(id, userId, fromId, toId, relation:'synapse'|'within'|'led_to', weight, createdAt)
```
Reuse the cosine RAG retriever for node dedup (no vector DB — CLAUDE.md constraint). Dropping & re-projecting yields the same graph.

### C5. The sync-merge detail that matters
Blind last-writer-wins would **lose progress** if a user advances an expedition on their phone *and* laptop while offline. So `expedition_progress` gets a **custom field-merge** in the resolver (the Phase 1 spine already stores per-field `fields` and supports field-level merge — this extends it):
- `completedSteps` → **set union** of both sides (you can't "un-complete" by losing a step).
- `currentStep` → **max** of both sides.
- `status` → `completed` wins over `active`; `abandoned` is LWW by lamport.
- `lastActivityAt` → max.

This is a small, well-defined CRDT-style merge per field — register it as a per-entity merge strategy in `src/sync/resolve.ts` (a `mergeStrategies['expedition_progress']` map). Worth a property test: two devices advancing different steps offline → union, zero progress lost.

## D. AI pipelines (quality is the whole product — guard hard)

All follow the planner template: `withSpan` traced, `pickModel(task)`, Zod-validated, `USE_AI_MOCK` mock, propose-not-apply.

- **`generateDailySpark(profile, interests, recentSparkTitles)`** → one spark. Guards: must reference ≥1 real interest OR a named adjacent field; **dedupe** against recent spark titles (no repeats); reject generic filler (a banned-pattern check + min specificity). The spark must be *surprising and personal*, not a Wikipedia summary — this is the defensible part.
- **`generateExpedition(seed, userContext)`** → `{title, theme, steps[5..9]}`. Guards: step count bounded; each step concrete (has a verb + a deliverable/prompt + estMinutes 5–30); no step is "reflect on your journey" filler more than once.
- **`generateRabbitHoleNode(currentNode, direction:'deeper'|'sideways')`** → 1–2 next nodes, each a tight concept/question.
- Cost control: sparks are 1 cheap call/day/user (cache, generate lazily on first open); expeditions generated once at start; rabbit-hole nodes on demand. Use the cheap model tier for sparks, stronger for expedition structure.

## E. Gamification (beyond XP)

- **Polymath Score** rewarding *depth* (deep-dives, expedition completions) **and** *breadth* (distinct domains/fields touched) — the polymath tension is the game. Feeds the `polymath` domain score the stagnation detector watches.
- **Synapses** — cross-discipline edges; the scarce prestige currency. Connecting two distant fields is a celebrated moment.
- **Expedition badges** — per completed expedition; "expedition streak" for finishing several.
- **Curiosity streak** — daily spark engagement; forgiving (freezes), never punishing (Duolingo/Finch lesson).
- **Concept collection** — explored concepts become collectible cards; collection-completion drive.
- **Open loops** — "You're on day 3 of *History of Jazz* and left a thread open on Bauhaus." Pulls users back.

## F. UX surfaces

- **Explore tab** restructured top→bottom: *Today's Spark* (hero) → *Active Expeditions* (horizontal progress cards, each resumable, showing N/total) → *Constellation* (tappable, growing) → *Discover* (existing grid, now also "start an expedition" entry) → *Your Interests* (existing).
- **Expedition detail**: step list with completed/locked/next states; advancing a step = a satisfying moment + node added to constellation. Multiple expeditions reachable from the Active row.
- **Rabbit-hole view**: full-screen branching cards, "deeper / sideways / save / done."

## G. Telemetry

- Counters: `spark.shown|saved|dismissed|thread_pulled`, `expedition.started|step_completed|completed|abandoned`, `constellation.node_added|synapse_formed`, `curiosity.streak_day`.
- Quality north-stars: **spark save-rate** (low = sparks are generic, fix the prompt), **expedition completion-rate**, **D1/D7 return to Explore**.
- Privacy: counts only; never spark/expedition content in telemetry.

## H. Edge cases / failure modes

| Case | Handling |
|---|---|
| New user, no interests | Spark uses onboarding profile + broad starter themes; expeditions offer curated templates |
| AI spark is generic/stale | Guard rejects + regenerate once; if still weak, show a curated fallback spark — never an empty state |
| Offline | Sparks/expeditions cached; progress recorded locally, syncs on reconnect (Phase 1) |
| Same expedition advanced on 2 devices offline | set-union merge (§C5) — no step lost |
| User starts 10 expeditions, finishes none | Cap active expeditions (e.g. 5); gently nudge to finish before starting more (completion psychology) |
| Expedition content references something unavailable | steps are self-contained text/prompts, not external links that rot |
| AI cost spike | 1 spark/day cached; expedition gen once; rabbit-hole on demand; cheap tier for sparks |

## I. Acceptance criteria

- [ ] A daily spark appears, personalized + deduped, with Save / Pull-thread / Start-expedition actions.
- [ ] User can start ≥2 expeditions and they appear as independent progress cards.
- [ ] Advancing step N of expedition A does not alter expedition B.
- [ ] Progress persists across reload and **syncs across devices** with zero lost steps (set-union merge proven by a property test).
- [ ] Completing an expedition awards a badge and grows the constellation.
- [ ] Constellation rebuilds deterministically from underlying data.
- [ ] Polymath score moves on real exploration; feeds the stagnation detector.
- [ ] Everything behind an `explore_v2` flag, off by default; AI paths have mocks; web parity present.
- [ ] `src/explore/**` (or `src/cognition/explore/**`) pure logic ≥ 90% covered; clean tsc.

## J. Risks

| Risk | Mitigation |
|---|---|
| AI content is generic → trust dies in a week | Hard specificity/dedup guards; curated fallbacks; spark save-rate as the gate before wide rollout |
| Feature sprawl / never ships | Sequence below; ship the daily loop first, expeditions second, constellation polish third |
| Sync loses expedition progress | set-union field merge + property tests (§C5) |
| Becomes a content app detached from the life-OS | Everything feeds the polymath domain score + routine; sparks/expeditions can become routine blocks |
| Cost | per-day caching + tiered models |

## K. Build sequence (small, tested commits)

0. **Schema + web parity + sync-merge strategy** — `expeditions`, `expedition_progress`, `sparks`, constellation tables; `mergeStrategies['expedition_progress']` in `resolve.ts` + property test.
1. **Expedition engine (pure)** — start/advance/complete/abandon over injected storage; multi-expedition concurrency; set-union progress; tests. *(No UI — highest-leverage core, mirrors how we built the stagnation detector.)*
2. **Daily Spark pipeline** — `generateDailySpark` + guards + mock + dedup; `sparks` queries; tests.
3. **Expedition generation** — `generateExpedition` + guards + mock; "start from spark/discover".
4. **Constellation projection** — nodes/edges projector + dedup; rebuildable; tests.
5. **UI** — restructured Explore tab (spark hero, active-expeditions row, constellation, detail, rabbit-hole). *Verify in browser.*
6. **Gamification + telemetry** — polymath score (depth+breadth), synapses, badges, curiosity streak, collection; counters; shadow → dogfood flag flip.

Start at step 0/1 (pure engine + sync semantics) — that's the trackable/syncable backbone the rest hangs off, and it's fully testable before any UI.
