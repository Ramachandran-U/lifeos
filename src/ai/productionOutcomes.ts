import type { SuggestionWithOutcome, SuggestionVariant } from '@/db/queries/aiSuggestions';

/**
 * Production outcomes analysis (the consumer of ai_suggestions / suggestion_outcomes).
 *
 * Unlike the synthetic eval suites in `evals/cases/`, this looks at *real* user
 * outcomes and answers the kill/keep question for the agent variant of each
 * task. See `src/db/migrations/0004_ai_suggestions.sql` for the hypothesis.
 */

export const KILL_KEEP_WINDOW_DAYS = 14;

/** Difference in completion rate (in absolute pct points) at which we kill the agent variant. */
export const KILL_KEEP_THRESHOLD = 0.03;

/** Minimum suggestions per arm before we'll declare a verdict. Below this we say "insufficient data". */
export const MIN_ARM_SIZE = 30;

export type Verdict =
  | { state: 'insufficient_data'; reason: string }
  | { state: 'keep_agent'; deltaPctPoints: number }
  | { state: 'kill_agent'; deltaPctPoints: number }
  | { state: 'no_signal'; deltaPctPoints: number };

export interface VariantStats {
  n: number;
  nWithOutcome: number;
  meanCompletionRate: number | null;
}

export interface TaskOutcomeReport {
  task: string;
  windowDays: number;
  singleShot: VariantStats;
  agent: VariantStats;
  verdict: Verdict;
}

function statsFor(rows: SuggestionWithOutcome[], variant: SuggestionVariant): VariantStats {
  const arm = rows.filter((r) => r.variant === variant);
  const withRate = arm.filter(
    (r) => r.outcome?.completionRate != null && r.outcome.windowDays === KILL_KEEP_WINDOW_DAYS,
  );
  const mean =
    withRate.length > 0
      ? withRate.reduce((sum, r) => sum + (r.outcome!.completionRate as number), 0) / withRate.length
      : null;
  return { n: arm.length, nWithOutcome: withRate.length, meanCompletionRate: mean };
}

function verdictFor(single: VariantStats, agent: VariantStats): Verdict {
  if (single.nWithOutcome < MIN_ARM_SIZE || agent.nWithOutcome < MIN_ARM_SIZE) {
    return {
      state: 'insufficient_data',
      reason: `need ${MIN_ARM_SIZE} per arm; have single=${single.nWithOutcome}, agent=${agent.nWithOutcome}`,
    };
  }
  if (single.meanCompletionRate == null || agent.meanCompletionRate == null) {
    return { state: 'insufficient_data', reason: 'no completion-rate data on at least one arm' };
  }
  const delta = agent.meanCompletionRate - single.meanCompletionRate;
  // Agent worse than baseline by more than the threshold → kill.
  if (delta < -KILL_KEEP_THRESHOLD) return { state: 'kill_agent', deltaPctPoints: delta };
  // Agent better than baseline by more than threshold → keep.
  if (delta > KILL_KEEP_THRESHOLD) return { state: 'keep_agent', deltaPctPoints: delta };
  return { state: 'no_signal', deltaPctPoints: delta };
}

export function buildTaskReports(rows: SuggestionWithOutcome[]): TaskOutcomeReport[] {
  const byTask = new Map<string, SuggestionWithOutcome[]>();
  for (const r of rows) {
    const arr = byTask.get(r.task) ?? [];
    arr.push(r);
    byTask.set(r.task, arr);
  }
  const out: TaskOutcomeReport[] = [];
  for (const [task, taskRows] of byTask) {
    const single = statsFor(taskRows, 'single_shot');
    const agent = statsFor(taskRows, 'agent');
    out.push({
      task,
      windowDays: KILL_KEEP_WINDOW_DAYS,
      singleShot: single,
      agent,
      verdict: verdictFor(single, agent),
    });
  }
  return out.sort((a, b) => a.task.localeCompare(b.task));
}

function fmtPct(x: number | null): string {
  return x == null ? '—' : `${(x * 100).toFixed(1)}%`;
}

function fmtVerdict(v: Verdict): string {
  switch (v.state) {
    case 'insufficient_data':
      return `⚪ insufficient data (${v.reason})`;
    case 'keep_agent':
      return `🟢 keep agent (+${(v.deltaPctPoints * 100).toFixed(1)} pp)`;
    case 'kill_agent':
      return `🔴 KILL agent (${(v.deltaPctPoints * 100).toFixed(1)} pp)`;
    case 'no_signal':
      return `🟡 no signal (Δ ${(v.deltaPctPoints * 100).toFixed(1)} pp)`;
  }
}

/**
 * Render the production-outcomes report in the same markdown shape as
 * `evals/reports/latest.md` so it slots into the existing eval workflow.
 */
export function renderProductionOutcomesMarkdown(rows: SuggestionWithOutcome[]): string {
  const reports = buildTaskReports(rows);
  const now = new Date().toISOString();
  const lines: string[] = [];
  lines.push('# LifeOS Production Outcomes Report');
  lines.push('');
  lines.push(`- Generated: ${now}`);
  lines.push(`- Source: \`ai_suggestions\` + \`suggestion_outcomes\` (see migration 0004)`);
  lines.push(`- Window: ${KILL_KEEP_WINDOW_DAYS} days`);
  lines.push(`- Kill threshold: agent completion-rate < baseline − ${(KILL_KEEP_THRESHOLD * 100).toFixed(1)} pp`);
  lines.push(`- Min arm size: ${MIN_ARM_SIZE} suggestions with outcome`);
  lines.push('');
  lines.push('## Verdict by task');
  lines.push('');
  lines.push('| Task | Single-shot n / rate | Agent n / rate | Verdict |');
  lines.push('|---|---|---|---|');
  if (reports.length === 0) {
    lines.push('| _(no data)_ | — | — | ⚪ no suggestions logged yet |');
  } else {
    for (const r of reports) {
      lines.push(
        `| \`${r.task}\` | ${r.singleShot.nWithOutcome}/${r.singleShot.n} · ${fmtPct(r.singleShot.meanCompletionRate)} | ${r.agent.nWithOutcome}/${r.agent.n} · ${fmtPct(r.agent.meanCompletionRate)} | ${fmtVerdict(r.verdict)} |`,
      );
    }
  }
  lines.push('');
  lines.push('## Notes');
  lines.push('');
  lines.push(
    '- `domain_score_delta` is captured in `suggestion_outcomes` for context but is NOT the kill/keep metric — it is too noisy at the individual level.',
  );
  lines.push(
    '- Suggestions without a 14-day outcome row are counted in `n` but excluded from `n / rate`.',
  );
  return lines.join('\n') + '\n';
}
