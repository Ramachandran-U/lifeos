/**
 * Variant policy (#3-act) — closes the ACTION end of the learning loop, but
 * keeps a human in the seat.
 *
 * The measurement loop (productionOutcomes.ts) produces a kill/keep verdict per
 * task. LOCKED DECISION: we do NOT auto-flip. `getTaskVerdict` surfaces the
 * verdict + a recommendation for the UI; the user toggles via useVariantStore;
 * `pickVariant` then honours that toggle at dispatch time, defaulting to the
 * task's normal variant so behaviour is unchanged until the user opts in.
 */
import { buildTaskReports, type Verdict } from './productionOutcomes';
import { listSuggestionsWithOutcomes } from '@/db/queries/aiSuggestions';
import { useVariantStore, type Variant } from '@/store/useVariantStore';

export interface VariantRecommendation {
  /** What the data suggests using. */
  recommend: Variant;
  /** True when the verdict actively argues against the current default (kill_agent). */
  urgent: boolean;
  note: string;
}

/** Pure: turn a verdict into a recommendation. Only `kill_agent` argues for single-shot. */
export function recommendFromVerdict(verdict: Verdict): VariantRecommendation {
  switch (verdict.state) {
    case 'kill_agent':
      return {
        recommend: 'single_shot',
        urgent: true,
        note: `The agent is underperforming the simple baseline by ${(Math.abs(verdict.deltaPctPoints) * 100).toFixed(1)} pts. Consider switching this task to single-shot.`,
      };
    case 'keep_agent':
      return {
        recommend: 'agent',
        urgent: false,
        note: `The agent is beating the baseline by ${(verdict.deltaPctPoints * 100).toFixed(1)} pts.`,
      };
    case 'no_signal':
      return { recommend: 'agent', urgent: false, note: 'No meaningful difference between variants yet.' };
    case 'insufficient_data':
      return { recommend: 'agent', urgent: false, note: `Not enough data yet — ${verdict.reason}.` };
  }
}

/**
 * Pure variant resolution: an explicit user override wins; otherwise the task's
 * default (agent). The verdict is intentionally NOT consulted here — it only
 * informs the human via getTaskVerdict; the human's choice lands in `override`.
 */
export function pickVariant(
  _task: string,
  opts: { override?: Variant; default?: Variant } = {},
): Variant {
  return opts.override ?? opts.default ?? 'agent';
}

// --- Live helpers ---

/** The current verdict for a task (for surfacing in the UI). */
export function getTaskVerdict(task: string): Verdict {
  const reports = buildTaskReports(listSuggestionsWithOutcomes(task));
  const report = reports.find((r) => r.task === task);
  return report?.verdict ?? { state: 'insufficient_data', reason: 'no suggestions logged yet' };
}

/** The human's stored override for a task, if any. */
export function getVariantOverride(task: string): Variant | undefined {
  return useVariantStore.getState().overrides[task];
}
