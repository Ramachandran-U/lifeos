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
import { buildCalendarContext } from './calendarContext';
import { buildBillsContext } from './billsContext';
import { buildEpisodicContext } from './episodicContext';

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

  // Fold in today's real calendar commitments so the plan is built around
  // actual meetings/busy windows. `buildCalendarContext` never throws and
  // returns [] when the calendar isn't connected, so this is always safe.
  const calendarItems = await buildCalendarContext();
  if (calendarItems.length) {
    contextItems = [...contextItems, ...calendarItems];
  }

  // Fold in upcoming bills / subscription renewals so the planner can slot in
  // time to pay what's due soon. Also never throws; returns [] when the finance
  // store is unavailable (e.g. native) or nothing is due.
  const billItems = await buildBillsContext();
  if (billItems.length) {
    contextItems = [...contextItems, ...billItems];
  }

  // Fold in recent day summaries (episodic memory, flag `episodic_memory`) so
  // retrieval can rank whole lived days — not just event counts — against the
  // plan query. Never throws; [] when the flag is off or nothing is recorded.
  const episodeItems = await buildEpisodicContext();
  if (episodeItems.length) {
    contextItems = [...contextItems, ...episodeItems];
  }

  // Adaptive-rebalance signal — only inject when the caller didn't already
  // pass one. Empty / failing lookups are non-fatal.
  let lastWeekDomainMinutes = input.lastWeekDomainMinutes;
  if (!lastWeekDomainMinutes) {
    try {
      const { computeLastWeekDomainMinutes } = await import('@/utils/routineBalance');
      lastWeekDomainMinutes = computeLastWeekDomainMinutes();
    } catch { /* non-fatal */ }
  }

  // Default dayOfWeek to today if the caller didn't specify — keeps weekday/
  // weekend differentiation working for the common single-day case.
  const dayOfWeek = input.dayOfWeek ?? new Date().getDay();

  return planRoutineAgent({ ...input, lastWeekDomainMinutes, dayOfWeek, contextItems });
}
