/**
 * Planning pipeline — the "master planner", documented and named.
 *
 * LifeOS does not have a monolithic master-planner class. Planning is an
 * EMERGENT pipeline that already works across several modules; this facade
 * gives those stages one import surface and one place to read the flow, so
 * call sites stop reaching into five different files. It is intentionally a
 * thin named index — it adds NO logic of its own. If you need to change
 * behaviour, change the underlying module, not this file.
 *
 * The pipeline (per the architecture docs in CLAUDE.md):
 *
 *   1. RETRIEVE  context        → buildHistoryContext()            (src/ai/historyContext.ts)
 *   2. PLAN      the full day   → planDay()                        (propose → critique → commit)
 *   3. REPLAN    intra-day      → replanRestOfToday()              (surgical edits to remaining blocks)
 *   4. PLAN      tomorrow       → planTomorrow()                   (end-of-day generation)
 *   5. DECIDE    next action    → whatNext()                       (tool-use agent over live state)
 *   6. DETECT    cognition      → src/cognition/*                  (stagnation, overcommitment, …)
 *   7. LEARN     outcomes       → src/ai/productionOutcomes.ts     (kill/keep verdicts; human-toggled)
 *
 * Steps 6–7 run out-of-band (end-of-day / app-open), not inline in a single
 * call — hence "emergent" rather than one orchestrating function.
 */

export {
  // 2 — full-day routine generation (retrieve + propose/critique/commit)
  planRoutineWithContext as planDay,
  planRoutineWithContextDetailed as planDayDetailed,
} from '../routinePlanner';

export {
  // 3 — surgical replan of the remainder of today
  rebalanceRestOfToday as replanRestOfToday,
  // 4 — generate and persist tomorrow's routine
  generateAndSaveTomorrow as planTomorrow,
} from '../replanApply';

export {
  // 5 — "what should I do next?" tool-use agent over live user state
  whatShouldIDoNext as whatNext,
} from '../agent/whatNext';
