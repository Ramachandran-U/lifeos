/**
 * Closes the MEASUREMENT end of the learning loop.
 *
 * We log every AI suggestion (`logAiSuggestion`) but, until now, nothing ever
 * recorded its OUTCOME — so `recordSuggestionOutcome` had no caller and the
 * kill/keep analysis in productionOutcomes.ts had no data to read. This module
 * fills that gap: for each suggestion old enough to judge (≥ windowDays) and
 * not yet measured, it counts the user's routine-block completion over the
 * window after the suggestion and writes one outcome row.
 *
 * Pure orchestrator with injected deps (no DB/clock coupling) so it's fully
 * unit-testable; `measureDueSuggestionOutcomes` is the thin live wiring.
 */

import {
  listSuggestionsWithOutcomes,
  recordSuggestionOutcome,
  type SuggestionWithOutcome,
  type RecordOutcomeInput,
} from '@/db/queries/aiSuggestions';
import { getRoutineBlocksInRange } from '@/db/queries/routine';

export const DEFAULT_WINDOW_DAYS = 14;

export interface BlockCounts {
  total: number;
  completed: number;
}

export interface MeasureDeps {
  /** Today as YYYY-MM-DD — injected so the core is deterministic. */
  today: string;
  windowDays?: number;
  /** All suggestions (most recent first), each with its outcome if already measured. */
  listSuggestions: () => SuggestionWithOutcome[];
  /** Completed/total routine blocks in [startDate, endDate] inclusive, for a user. */
  countBlocks: (userId: string, startDate: string, endDate: string) => BlockCounts;
  /** Persist one outcome row. */
  record: (input: RecordOutcomeInput) => void;
}

function addDays(date: string, days: number): string {
  const ms = Date.parse(`${date}T00:00:00Z`) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/**
 * Measures every suggestion whose window has elapsed and which has no outcome
 * yet. Returns the number of outcome rows written. Idempotent: a suggestion
 * that already has an outcome is skipped, so it's safe to run daily.
 */
export function measureDueOutcomes(deps: MeasureDeps): number {
  const windowDays = deps.windowDays ?? DEFAULT_WINDOW_DAYS;
  let written = 0;

  for (const s of deps.listSuggestions()) {
    if (s.outcome) continue; // already measured
    const createdDate = s.createdAt.slice(0, 10);
    if (daysBetween(createdDate, deps.today) < windowDays) continue; // too soon to judge

    const endDate = addDays(createdDate, windowDays);
    const { total, completed } = deps.countBlocks(s.userId, createdDate, endDate);

    deps.record({
      suggestionId: s.id,
      windowDays,
      blocksTotal: total,
      blocksCompleted: completed,
    });
    written += 1;
  }

  return written;
}

/**
 * Live wiring. Call from the end-of-day / app-open path. Never throws into the
 * caller — measurement must not break the app.
 */
export function measureDueSuggestionOutcomes(today: string, windowDays = DEFAULT_WINDOW_DAYS): number {
  try {
    return measureDueOutcomes({
      today,
      windowDays,
      listSuggestions: () => listSuggestionsWithOutcomes(),
      countBlocks: (_userId, startDate, endDate) => {
        // outputRef isn't reliably a date, so we measure the user's routine-block
        // completion over the window as the outcome proxy the kill/keep analysis uses.
        const blocks = getRoutineBlocksInRange(startDate, endDate);
        const total = blocks.length;
        const completed = blocks.filter((b) => b.status === 'completed').length;
        return { total, completed };
      },
      record: recordSuggestionOutcome,
    });
  } catch {
    return 0;
  }
}
