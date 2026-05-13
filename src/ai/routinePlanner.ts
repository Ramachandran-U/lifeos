/**
 * Public entry-point for the context-aware Routine Builder.
 *
 * Wraps the multi-step `planRoutineAgent` so consumer screens (onboarding,
 * post-discovery) get the same `GeneratedRoutine` shape they used to get
 * from the single-shot `generateRoutine` — but with retrieval over recent
 * user history baked in.
 *
 * Pulls history from SQLite/IndexedDB via `buildHistoryContext()`. On
 * cold-start onboarding the history is empty and the agent's retrieve
 * step returns zero hits — behaviour falls back to the propose→critique→
 * commit loop with no extra context, which is still better than the
 * single-shot call because of the critique pass.
 */

import type { GeneratedRoutine, RoutineInput } from './types';
import { planRoutineAgent, type AgentResult } from './agent/planner';
import { buildHistoryContext } from './historyContext';

export async function planRoutineWithContext(input: RoutineInput): Promise<GeneratedRoutine> {
  const result = await planRoutineWithContextDetailed(input);
  return result.plan;
}

/** Same as above but also returns the full agent trace (for debug / eval / admin display). */
export async function planRoutineWithContextDetailed(input: RoutineInput): Promise<AgentResult> {
  let contextItems: ReturnType<typeof buildHistoryContext> = [];
  try {
    contextItems = buildHistoryContext();
  } catch {
    // Defensive: if the DB layer throws (e.g. on a fresh install where no
    // tables exist yet), we just plan without history.
    contextItems = [];
  }
  return planRoutineAgent({ ...input, contextItems });
}
