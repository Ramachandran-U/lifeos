# Handover — Domain Stagnation Detector + Action Suggestions

> For a fresh Claude Code session. This implements the first concrete **Phase 2 cognitive detector**: when a life domain the user *chose to care about* stops growing because nothing in their routine feeds it, surface a supportive insight at end-of-day with 2-3 small, specific action items they can add to their routine.
>
> Read [docs/architecture/phase-2-cognitive-engine.md](../docs/architecture/phase-2-cognitive-engine.md) and [roadmap/00-architecture-audit.md](../roadmap/00-architecture-audit.md) first. **Do not auto-modify the routine. Propose, never apply.** Land it behind a feature flag, off by default.

## Status (updated 2026-05-30) — SHIPPED end-to-end

| Step | Status | Notes |
|---|---|---|
| Task 0 — BUG-009 taxonomy (`mind`→`polymath`, 6th hub card) | ✅ Shipped | `5aff7cb` (pre-program) |
| Step 1 — Pure `detectStagnantDomain()` + 12 tests | ✅ Shipped | PR #41 |
| Step 2 — `cognitive_insights` schema + web parity + cooldown | ✅ Shipped | PR #41 |
| Step 3 — `buildDomainSuggestions()` (goal-mining + AI fallback hook) + 14 tests | ✅ Shipped | PR #41 |
| Step 4 — `DomainNudgeCard` wired into evening-reflect 'tomorrow' step | ✅ Shipped | PR #41 |
| Step 5 — Telemetry events + flag gating | ✅ Shipped | PR #41 |
| Real `aiSuggest` AI fallback (callAI-backed) — wires the existing prompt hook | ⏳ Deferred | Goal-mining covers the high-trust path; AI fallback only matters when <2 mined goals |

Flags `domainNudges` + `domainNudgesVisible` are in `src/config/flags.ts`, both default **off**. Enable both to render. Shadow-mode (`domainNudges=on`, `domainNudgesVisible=off`) is supported — detector runs and records insights without surfacing the card.

The rest of this doc is the original handover, retained as the design reference.

---

## The product principle (do not violate this)

**Protect the domains the user chose — do NOT force a balanced hexagon.**

Imbalance is not automatically bad. A user mid-startup-sprint *should* be career-heavy. Nagging someone to "balance" a domain they deliberately deprioritized is the creepy/nagging failure mode the Phase 3 design explicitly warns against. The welcome insight is: *"A domain you told me mattered has gone quiet because nothing in your day feeds it."* The annoying one is: *"Your hexagon isn't even."* Build the former.

Concretely: a domain is a candidate **only if it's in the user's `primaryDomains`** (set in onboarding, stored in `useUserStore`). Never flag a non-chosen domain.

## Tone

Insight, not warning. No red alerts, no guilt, no "you're falling behind." Frame as opportunity ("Curiosity has been quiet for two weeks — want to fold in something small?"). Surfaced **once** at end-of-day reflect, with a **per-domain cooldown of ~7 days** so it never becomes wallpaper.

---

## PREREQUISITE — fix BUG-009 first (or this is a dead end)

See [qa/debug-handover.md](../qa/debug-handover.md) BUG-009. The domain taxonomy is fragmented:
- Score storage (`useGameStore` / `useDomainHistoryStore`) keys on: `goals, health, finance, career, social, **mind**`.
- `primaryDomains` (`useUserStore`, `DomainId`) uses: `goals, health, finance, career, social, **polymath**`.
- The Life hub (`LifeHubSheet`) only has 5 cards (no mind/polymath), so a user **cannot reach** the polymath/mind domain to act on it.

If the detector tells a user to feed `mind`/polymath but they can't navigate there or add an action, the nudge is a dead end. **Reconcile `mind` ↔ `polymath` into one canonical key and ensure every flagged domain is reachable/actionable before shipping this detector.** At minimum: a single `domainKey` map (`src/utils/domains.ts`) that both stores and the hub use, plus the 6th hub card. Treat this as task 0.

---

## Architecture (fits the existing spine)

Two-tier, exactly like the Phase 2 design:
1. **Deterministic detector** (no LLM) reads score history + primaryDomains → decides *whether* a domain is stagnant and *why*.
2. **Suggestion engine** produces 2-3 action items — **goal-mining first, AI fallback** (see below). LLM only runs when we actually need to invent suggestions, keeping cost/latency near zero for the common case.

Reuse, don't rebuild: `useDomainHistoryStore` (history), `useUserStore.primaryDomains`, goal/routine query layers, the planner's AI conventions (`callAI` + `pickModel` + `withSpan` + Zod + `USE_AI_MOCK` mock), and `src/config/flags.ts`.

```
end-of-day (evening-reflect, 'tomorrow' step)
        │
        ▼
detectStagnantDomains()           ── deterministic, src/cognition/domainStagnation.ts
  • for each domain in primaryDomains:
      delta = useDomainHistoryStore.deltaFor(domain, WINDOW_DAYS)
      fed   = routineFeedsDomain(domain, last N days)   // any blocks/events in that module
      if delta <= FLAT_EPSILON && !fed && cooldownOK(domain): candidate
  • rank candidates by (lowest absolute score, longest flat) → take top 1 (maybe 2)
        │
        ▼
buildDomainSuggestions(domain)    ── src/cognition/domainSuggestions.ts
  1. MINE existing goals: getGoalsByUser → goals in this domain whose level is
     weekly/daily and that have NO matching routine block scheduled. Surface those
     first ("You set 'read 12 books' but Curiosity has no routine slot").
  2. FALLBACK (only if <2 mined): callAI with a tight prompt → 2-3 small,
     routine-shaped actions tied to the user's goals/context for that domain.
        │
        ▼
emit CognitiveInsight (status: proposed) → surface card at reflect
        │
        ▼
user taps an action → add a routine block (propose-not-apply: user chose) → record cooldown
```

---

## Detection spec

`src/cognition/domainStagnation.ts` — pure, unit-testable.

- **Inputs:** `primaryDomains: DomainId[]`, a history accessor (inject `useDomainHistoryStore` getters so it's testable), and a "domain fed?" predicate over recent routine blocks / behaviourEvents.
- **WINDOW_DAYS = 14** (two weeks of flat is a real signal; 7 is too twitchy).
- **FLAT_EPSILON:** treat `deltaFor(domain, WINDOW_DAYS) <= 2` (on the 0-100 scale) as "not growing." Tune later from telemetry.
- **min-sample guard:** require at least `WINDOW_DAYS` of history for that domain (`fullHistoryFor(domain).length >= WINDOW_DAYS`); below that, stay silent (new users get no nags).
- **"fed" check:** a domain is "being fed" if the user has ≥1 routine block in that module OR ≥1 `behaviourEvent` for it in the last 7 days. If it's being fed but still flat, that's a *different* insight (effort-not-translating) — out of scope here; just don't fire.
- **cooldown:** don't re-fire for a domain surfaced/dismissed in the last 7 days. Persist last-fired per domain (small zustand-persist store, e.g. `useCognitionCooldownStore`, or reuse the insight table's `createdAt`).
- **Output cap:** surface **at most 1** stagnant domain per session (2 only if both are severe and you've validated it doesn't overwhelm). One good nudge > three ignored ones.

## Suggestion spec

`src/cognition/domainSuggestions.ts`

1. **Goal-mining (primary, deterministic, free):**
   - `getGoalsByUser(userId)` → filter to goals whose `goalType`/domain maps to the stagnant domain, `level ∈ {weekly, daily}`, `status === 'active'`.
   - Cross-reference scheduled routine blocks: a goal is "unscheduled" if no routine block's `linkedEntityId === goal.id` (and no title match) in the upcoming window.
   - Surface up to 3 unscheduled goals as ready-to-add actions. These are the highest-trust suggestions because they're things the user *already committed to*.
2. **AI fallback (only when goal-mining yields < 2):**
   - One `callAI` call, `pickModel('cognition.suggest')`, `withSpan`, Zod-validated, `USE_AI_MOCK` mock provided.
   - Prompt must produce **small, concrete, routine-shaped** actions (a 15-30 min block, not "improve your finances"), grounded in the domain + any of the user's goals/profile in that domain. Forbid vague filler ("be more mindful"). Each suggestion = `{ title, suggestedDurationMin, module, rationale }`.
   - Guard: reject suggestions with no concrete verb/duration; cap at 3.

## Schema / storage

Reuse the Phase 2 `cognitive_insights` concept (create it if not present):
```
cognitive_insights(
  id, userId, kind ('domain_stagnation'), domain, severity,
  evidence JSON (delta, daysFlat, currentScore),
  suggestions JSON ([{title,durationMin,module,source:'goal'|'ai',goalId?}]),
  status ('proposed'|'shown'|'accepted'|'dismissed'|'expired'),
  createdAt, expiresAt
)
```
- Web parity: add the matching `webStorage/cognitiveInsights.ts` (mirror the existing one-file-per-entity pattern) and branch in the query module on `Platform.OS === 'web'`. **Don't forget web** — that's where the QA bot tests, and missing web branches throw (`index.web.ts`).
- "accepted" = user added at least one suggested action to the routine.

## Where it renders

End-of-day flow: `app/evening-reflect.tsx`, the **`'tomorrow'` step** (it already shows AI tweak cards there — same visual language). Add a `DomainNudgeCard` above/below the existing tweak card. Each suggestion is a chip/button: tapping it creates a routine block for tomorrow (reuse the routine create query, set `linkedEntityId` when it came from a goal) and marks the insight `accepted`. A "Not now" dismisses (records cooldown).

Do **not** auto-add anything. The user taps to accept.

## Feature flag

Add to [src/config/flags.ts](../src/config/flags.ts): the registry already has `cognitiveEngine`. Gate this detector behind it (or add a narrower `domainNudges` flag). Off by default. Support a **shadow mode**: when `cognitiveEngine` is on but `domainNudgesVisible` is off, run detection + log the insight (`status: proposed`) but render nothing — lets you measure precision before exposing.

## Telemetry

- Counters: `cognition.domain_stagnation.raised|shown|accepted|dismissed` (tag by domain, by suggestion source goal|ai).
- The core quality metric: **accept rate**. Low accept rate on a domain = noisy threshold or bad suggestions → tune or silence.
- Privacy: counts/timings only, never goal text or suggestion content in telemetry.

## Edge cases / failure modes

| Case | Handling |
|---|---|
| New user, sparse history | min-sample guard → silent |
| User deprioritized everything (no primaryDomains) | nothing to protect → silent |
| Domain flat but actively fed | don't fire (different insight) |
| All chosen domains healthy | no card; reflect flow unchanged |
| AI returns vague/empty suggestions | guard rejects; fall back to goal-mined only; if still 0, don't surface |
| Flagged domain unreachable (BUG-009 not fixed) | **blocker** — fix taxonomy first |
| User dismisses repeatedly | cooldown + after N dismissals for a domain, back off longer (escalating cooldown) |
| Mock mode (USE_AI_MOCK / CI) | deterministic mock suggestions; detection is pure so it's fully testable offline |

## Tests (required)

- **Pure detector unit tests** (`src/cognition/__tests__/domainStagnation.test.ts`): flat+unfed+chosen → fires; flat+fed → silent; not-chosen → silent; below min-sample → silent; cooldown active → silent; ranking picks lowest/longest-flat. Inject fake history/predicates.
- **Goal-mining tests:** unscheduled active goals in domain are surfaced; scheduled ones excluded; <2 mined triggers AI fallback path (mock the AI).
- **Suggestion guard tests:** vague/empty AI output rejected; cap at 3.
- Coverage on `src/cognition/**` ≥ 90% (matches program standard).

## Acceptance criteria

- [ ] BUG-009 taxonomy reconciled; every flaggable domain is reachable + actionable.
- [ ] Detector fires only for chosen, flat-for-14-days, unfed domains, ≥ min-sample, respecting cooldown.
- [ ] Suggestions prefer the user's own unscheduled goals; AI fallback only when needed and is concrete/routine-shaped.
- [ ] Card renders at end-of-day reflect; tapping a suggestion adds a routine block (user-initiated) and marks insight accepted; "Not now" sets cooldown.
- [ ] Nothing is auto-applied to the routine.
- [ ] Behind a flag, off by default; shadow mode works (detect+log, render nothing).
- [ ] Web branch present (no `db is not available on web` throw).
- [ ] Tests green, `src/cognition/**` ≥ 90% coverage, clean `tsc`.

## What NOT to do

- Don't force balance or flag non-chosen domains.
- Don't auto-inject routine blocks.
- Don't fire daily / without a cooldown.
- Don't ship vague suggestions — concrete + small + tied to their goals, or nothing.
- Don't add a second event/insight table — extend the Phase 2 `cognitive_insights`.
- Don't skip the web storage branch.
- Don't use clinical/guilt language anywhere in copy.

## Suggested commit sequence

1. Task 0 — reconcile domain taxonomy (BUG-009): `src/utils/domains.ts` canonical map + 6th hub card + test.
2. Pure detector `domainStagnation.ts` + tests (flag off, no UI).
3. `cognitive_insights` schema + web parity + queries.
4. Suggestion engine (goal-mining + AI fallback + mock) + tests.
5. `DomainNudgeCard` + wire into evening-reflect `'tomorrow'` step; accept/dismiss + cooldown.
6. Telemetry + shadow mode; flip flag on for dogfood.

Land each as a small, separately-tested commit. Start at task 0 — without the taxonomy fix the feature points users at a door that doesn't open.
