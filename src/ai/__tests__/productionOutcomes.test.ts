import {
  buildTaskReports,
  renderProductionOutcomesMarkdown,
  KILL_KEEP_THRESHOLD,
  KILL_KEEP_WINDOW_DAYS,
  MIN_ARM_SIZE,
} from '../productionOutcomes';
import type { SuggestionWithOutcome, SuggestionVariant } from '@/db/queries/aiSuggestions';

let idCounter = 0;
function row(
  task: string,
  variant: SuggestionVariant,
  completionRate: number | null,
  windowDays = KILL_KEEP_WINDOW_DAYS,
): SuggestionWithOutcome {
  idCounter += 1;
  return {
    id: `s${idCounter}`,
    userId: 'u1',
    task,
    variant,
    model: 'claude-sonnet-4-6',
    inputHash: 'h',
    outputSummary: null,
    outputRef: null,
    createdAt: '2026-05-01T00:00:00Z',
    outcome:
      completionRate == null
        ? undefined
        : {
            windowDays,
            blocksTotal: 10,
            blocksCompleted: Math.round(completionRate * 10),
            completionRate,
            domainScoreDelta: null,
            measuredAt: '2026-05-15T00:00:00Z',
          },
  };
}

function manyRows(
  task: string,
  variant: SuggestionVariant,
  count: number,
  rate: number,
): SuggestionWithOutcome[] {
  return Array.from({ length: count }, () => row(task, variant, rate));
}

describe('productionOutcomes', () => {
  beforeEach(() => {
    idCounter = 0;
  });

  test('returns insufficient_data when below MIN_ARM_SIZE', () => {
    const reports = buildTaskReports([
      ...manyRows('routine.generate', 'single_shot', 5, 0.7),
      ...manyRows('routine.generate', 'agent', 5, 0.7),
    ]);
    expect(reports).toHaveLength(1);
    expect(reports[0].verdict.state).toBe('insufficient_data');
  });

  test('flags KILL when agent is worse than baseline by more than threshold', () => {
    const reports = buildTaskReports([
      ...manyRows('routine.generate', 'single_shot', MIN_ARM_SIZE, 0.7),
      ...manyRows('routine.generate', 'agent', MIN_ARM_SIZE, 0.7 - KILL_KEEP_THRESHOLD - 0.01),
    ]);
    expect(reports[0].verdict.state).toBe('kill_agent');
  });

  test('flags KEEP when agent beats baseline by more than threshold', () => {
    const reports = buildTaskReports([
      ...manyRows('routine.generate', 'single_shot', MIN_ARM_SIZE, 0.6),
      ...manyRows('routine.generate', 'agent', MIN_ARM_SIZE, 0.6 + KILL_KEEP_THRESHOLD + 0.01),
    ]);
    expect(reports[0].verdict.state).toBe('keep_agent');
  });

  test('flags no_signal when delta is within the threshold band', () => {
    const reports = buildTaskReports([
      ...manyRows('routine.generate', 'single_shot', MIN_ARM_SIZE, 0.7),
      ...manyRows('routine.generate', 'agent', MIN_ARM_SIZE, 0.71),
    ]);
    expect(reports[0].verdict.state).toBe('no_signal');
  });

  test('ignores outcomes outside the kill/keep window', () => {
    const reports = buildTaskReports([
      ...manyRows('routine.generate', 'single_shot', MIN_ARM_SIZE, 0.7),
      ...Array.from({ length: MIN_ARM_SIZE }, () =>
        row('routine.generate', 'agent', 0.99, 7), // 7-day window — should be excluded
      ),
    ]);
    expect(reports[0].agent.nWithOutcome).toBe(0);
    expect(reports[0].verdict.state).toBe('insufficient_data');
  });

  test('markdown renders empty-state row when no data', () => {
    const md = renderProductionOutcomesMarkdown([]);
    expect(md).toContain('no suggestions logged yet');
    expect(md).toContain('LifeOS Production Outcomes Report');
  });

  test('markdown includes per-task row with verdict emoji', () => {
    const md = renderProductionOutcomesMarkdown([
      ...manyRows('routine.generate', 'single_shot', MIN_ARM_SIZE, 0.7),
      ...manyRows('routine.generate', 'agent', MIN_ARM_SIZE, 0.6),
    ]);
    expect(md).toContain('routine.generate');
    expect(md).toContain('KILL');
  });
});
