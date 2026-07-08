/**
 * Day-summary generation (episodic memory WRITE side): signal gathering,
 * stats, the deterministic fallback, and the AI/fallback persistence paths.
 * The AI client and all storage reads are mocked; assertions run against what
 * gets upserted.
 */
jest.mock('@/db/queries/routine', () => ({ getRoutineBlocksByDate: jest.fn(() => []) }));
jest.mock('@/db/queries/reflections', () => ({ getReflectionByDate: jest.fn(() => undefined) }));
jest.mock('@/db/queries/behaviour', () => ({ getEventsLastNDays: jest.fn(() => []) }));
jest.mock('@/db/queries/daySummaries', () => ({ upsertDaySummary: jest.fn(async () => 'row-id') }));
jest.mock('../client', () => ({ callAI: jest.fn() }));
jest.mock('@/store/useFlagStore', () => ({
  useFlagStore: { getState: () => ({ isEnabled: () => false }) },
}));

import {
  gatherDaySignal,
  buildStats,
  hasSignal,
  fallbackSummary,
  formatSignal,
  generateDaySummary,
  runDaySummaryForToday,
  type DaySignal,
} from '../episodic/daySummary';
import { getRoutineBlocksByDate } from '@/db/queries/routine';
import { getReflectionByDate } from '@/db/queries/reflections';
import { getEventsLastNDays } from '@/db/queries/behaviour';
import { upsertDaySummary } from '@/db/queries/daySummaries';
import { callAI } from '../client';

const mBlocks = getRoutineBlocksByDate as jest.Mock;
const mReflection = getReflectionByDate as jest.Mock;
const mEvents = getEventsLastNDays as jest.Mock;
const mUpsert = upsertDaySummary as jest.Mock;
const mCallAI = callAI as jest.Mock;

const DATE = '2026-07-06';

function signal(over: Partial<DaySignal> = {}): DaySignal {
  return {
    date: DATE,
    blocks: [
      { title: 'Morning run', module: 'health', status: 'completed' },
      { title: 'Deep work', module: 'career', status: 'completed' },
      { title: 'Guitar', module: 'polymath', status: 'skipped' },
    ],
    mood: 4,
    journal: 'Long day but the run reset me.',
    decisions: ['tweak_accepted'],
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.EXPO_PUBLIC_USE_AI_MOCK;
  delete process.env.USE_AI_MOCK;
});

describe('gatherDaySignal', () => {
  it('collects blocks, reflection mood/journal, and same-day decisions only', () => {
    mBlocks.mockReturnValue([{ title: 'A', module: 'goal', status: 'completed' }]);
    mReflection.mockReturnValue({ mood: 3, notes: '  a note  ' });
    mEvents.mockReturnValue([
      { eventType: 'decision', metadata: '{"action":"goal_paused"}', createdAt: `${DATE}T20:00:00.000Z` },
      { eventType: 'decision', metadata: '{"action":"other_day"}', createdAt: '2026-07-05T20:00:00.000Z' },
      { eventType: 'block_completed', metadata: null, createdAt: `${DATE}T10:00:00.000Z` },
    ]);
    const s = gatherDaySignal(DATE);
    expect(s.blocks).toHaveLength(1);
    expect(s.mood).toBe(3);
    expect(s.journal).toBe('a note');
    expect(s.decisions).toEqual(['goal_paused']);
  });

  it('is empty-safe when every store throws', () => {
    mBlocks.mockImplementation(() => { throw new Error('boom'); });
    mReflection.mockImplementation(() => { throw new Error('boom'); });
    mEvents.mockImplementation(() => { throw new Error('boom'); });
    const s = gatherDaySignal(DATE);
    expect(hasSignal(s)).toBe(false);
  });
});

describe('stats + fallback', () => {
  it('buildStats counts statuses and excerpts the journal', () => {
    const stats = buildStats(signal());
    expect(stats).toMatchObject({ blocksTotal: 3, blocksCompleted: 2, blocksSkipped: 1, mood: 4 });
    expect(stats.journalExcerpt).toBe('Long day but the run reset me.');
  });

  it('fallbackSummary is grounded, third-person, and never empty', () => {
    const text = fallbackSummary(signal());
    expect(text).toContain('completed 2 of 3');
    expect(text).toContain('felt good');
    expect(text).toContain('tweak accepted');
    expect(fallbackSummary(signal({ blocks: [], mood: null, journal: null, decisions: [] })))
      .toBe('A quiet day with no recorded activity.');
  });

  it('formatSignal renders one line per fact for the prompt', () => {
    const text = formatSignal(signal());
    expect(text).toContain(`Date: ${DATE}`);
    expect(text).toContain('Block: Morning run (health) — completed');
    expect(text).toContain('Mood: 4/5');
    expect(text).toContain('Journal: Long day');
    expect(text).toContain('Decision: tweak_accepted');
  });
});

describe('generateDaySummary', () => {
  it('writes nothing for an empty day', async () => {
    const res = await generateDaySummary('u1', DATE);
    expect(res.written).toBe(false);
    expect(mUpsert).not.toHaveBeenCalled();
  });

  it('persists the AI summary when the call succeeds (source: ai)', async () => {
    mBlocks.mockReturnValue([{ title: 'A', module: 'goal', status: 'completed' }]);
    mCallAI.mockResolvedValue('{"summary":"They completed their focus block."}');
    const res = await generateDaySummary('u1', DATE);
    expect(res).toEqual({ written: true, source: 'ai' });
    expect(mUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', date: DATE, summary: 'They completed their focus block.', source: 'ai' }),
    );
  });

  it('falls back deterministically when the AI fails (source: fallback)', async () => {
    mBlocks.mockReturnValue([
      { title: 'A', module: 'goal', status: 'completed' },
      { title: 'B', module: 'goal', status: 'skipped' },
    ]);
    mCallAI.mockRejectedValue(new Error('proxy down'));
    const res = await generateDaySummary('u1', DATE);
    expect(res).toEqual({ written: true, source: 'fallback' });
    const arg = mUpsert.mock.calls[0]![0];
    expect(arg.summary).toContain('completed 1 of 2');
  });

  it('mock mode short-circuits without a live call', async () => {
    process.env.EXPO_PUBLIC_USE_AI_MOCK = 'true';
    mBlocks.mockReturnValue([{ title: 'A', module: 'goal', status: 'completed' }]);
    const res = await generateDaySummary('u1', DATE);
    expect(res.source).toBe('ai');
    expect(mCallAI).not.toHaveBeenCalled();
  });
});

describe('runDaySummaryForToday (flag gate)', () => {
  it('is a silent no-op while episodic_memory is off (the shipped default)', async () => {
    mBlocks.mockReturnValue([{ title: 'A', module: 'goal', status: 'completed' }]);
    await runDaySummaryForToday('u1', DATE);
    expect(mUpsert).not.toHaveBeenCalled();
    expect(mCallAI).not.toHaveBeenCalled();
  });
});
