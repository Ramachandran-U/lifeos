import { measureDueOutcomes, DEFAULT_WINDOW_DAYS, type MeasureDeps } from '../outcomes/measure';
import type { SuggestionWithOutcome, RecordOutcomeInput } from '@/db/queries/aiSuggestions';

const TODAY = '2026-05-30';

function suggestion(over: Partial<SuggestionWithOutcome> = {}): SuggestionWithOutcome {
  return {
    id: 's1',
    userId: 'u1',
    task: 'what_next',
    variant: 'agent',
    model: null,
    inputHash: 'h',
    outputSummary: null,
    outputRef: null,
    createdAt: '2026-05-16T09:00:00.000Z', // 14 days before TODAY
    ...over,
  };
}

function harness(over: Partial<MeasureDeps> = {}) {
  const recorded: RecordOutcomeInput[] = [];
  const deps: MeasureDeps = {
    today: TODAY,
    listSuggestions: () => [suggestion()],
    countBlocks: () => ({ total: 10, completed: 7 }),
    record: (i) => recorded.push(i),
    ...over,
  };
  return { recorded, deps };
}

describe('measureDueOutcomes', () => {
  it('records an outcome for a suggestion whose window has elapsed', () => {
    const { recorded, deps } = harness();
    const n = measureDueOutcomes(deps);
    expect(n).toBe(1);
    expect(recorded).toEqual([
      { suggestionId: 's1', windowDays: DEFAULT_WINDOW_DAYS, blocksTotal: 10, blocksCompleted: 7 },
    ]);
  });

  it('skips suggestions that already have an outcome (idempotent)', () => {
    const { recorded, deps } = harness({
      listSuggestions: () => [
        suggestion({
          outcome: {
            windowDays: 14,
            blocksTotal: 5,
            blocksCompleted: 5,
            completionRate: 1,
            domainScoreDelta: null,
            measuredAt: '2026-05-30T00:00:00.000Z',
          },
        }),
      ],
    });
    expect(measureDueOutcomes(deps)).toBe(0);
    expect(recorded).toHaveLength(0);
  });

  it('skips suggestions younger than the window (too soon to judge)', () => {
    const { recorded, deps } = harness({
      listSuggestions: () => [suggestion({ createdAt: '2026-05-25T09:00:00.000Z' })], // 5 days ago
    });
    expect(measureDueOutcomes(deps)).toBe(0);
    expect(recorded).toHaveLength(0);
  });

  it('passes the window date range [createdDate, createdDate+windowDays] to countBlocks', () => {
    const ranges: Array<[string, string, string]> = [];
    const { deps } = harness({
      countBlocks: (userId, start, end) => {
        ranges.push([userId, start, end]);
        return { total: 0, completed: 0 };
      },
    });
    measureDueOutcomes(deps);
    expect(ranges).toEqual([['u1', '2026-05-16', '2026-05-30']]);
  });

  it('honours a custom window length', () => {
    const { recorded, deps } = harness({
      windowDays: 7,
      listSuggestions: () => [suggestion({ createdAt: '2026-05-23T09:00:00.000Z' })], // 7 days ago
    });
    expect(measureDueOutcomes(deps)).toBe(1);
    expect(recorded[0].windowDays).toBe(7);
  });
});
