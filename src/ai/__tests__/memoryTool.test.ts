/**
 * The flag-gated getMemories agent tool (memory-loop PR).
 *
 * `agent_memory_tool` OFF (the shipped default) ⇒ buildLifeOsTools is
 * byte-identical to before — no getMemories declaration, so what-next / coach /
 * voice behave exactly as they did. ON ⇒ the tool appears and reads the
 * memory store: topic ⇒ relevance search, no topic ⇒ strongest live facts.
 */
jest.mock('@/db/queries/goals', () => ({ getGoalsByUser: jest.fn(() => []) }));
jest.mock('@/db/queries/routine', () => ({ getRoutineBlocksByDate: jest.fn(() => []) }));
jest.mock('@/db/queries/health', () => ({ getLatestSleepHours: jest.fn(() => null) }));
jest.mock('@/db/queries/gamification', () => ({ getOrCreateGamification: jest.fn(() => ({ domainScores: '{}', streaks: '{}', totalXP: 0 })) }));
jest.mock('@/db/queries/social', () => ({ getContactsByUser: jest.fn(() => []), computeOverdue: jest.fn() }));
jest.mock('@/ai/calendarContext', () => ({ fetchTodayCalendarEvents: jest.fn(async () => null) }));
jest.mock('@/ai/billsContext', () => ({ getUpcomingBillsForAgent: jest.fn(async () => []) }));
jest.mock('@/ai/rag/memoryStore', () => ({
  searchFacts: jest.fn(),
  getFactsByUser: jest.fn(() => []),
  isFactLive: jest.fn(() => true),
  effectiveSalience: jest.fn((f: { salience: number }) => f.salience),
  relativeSince: jest.fn(() => '3 days ago'),
}));

let flagEnabled = false;
let trendsEnabled = false;
jest.mock('@/store/useFlagStore', () => ({
  useFlagStore: {
    getState: () => ({
      isEnabled: (key: string) =>
        (key === 'agent_memory_tool' && flagEnabled) || (key === 'agent_trend_tools' && trendsEnabled),
    }),
  },
}));
jest.mock('@/db/queries/daySummaries', () => ({ getRecentDaySummaries: jest.fn(async () => []) }));
jest.mock('../agent/trends', () => ({
  buildSleepTrend: jest.fn(() => ({ count: 0, average: null, direction: 'flat', changePct: null, series: [] })),
  buildMoodTrend: jest.fn(() => ({ count: 0, average: null, direction: 'flat', changePct: null, series: [] })),
  buildCompletionTrend: jest.fn(() => ({ weekly: [], totalCompleted: 0, direction: 'flat' })),
}));

import { buildLifeOsTools } from '../agent/tools';
import { searchFacts, getFactsByUser } from '../rag/memoryStore';

const mSearch = searchFacts as jest.Mock;
const mGetFacts = getFactsByUser as jest.Mock;

const fact = (id: string, text: string, salience = 1) => ({
  id,
  userId: 'u1',
  kind: 'pattern',
  text,
  salience,
  sourceWindow: null,
  createdAt: '2026-07-01T00:00:00.000Z',
  lastSeenAt: '2026-07-04T00:00:00.000Z',
  expiresAt: null,
  embedding: [1, 0],
});

beforeEach(() => {
  jest.clearAllMocks();
  flagEnabled = false;
  trendsEnabled = false;
});

describe('buildLifeOsTools × agent_memory_tool', () => {
  it('flag OFF (default): no getMemories tool — the shipped tool set is unchanged', () => {
    const names = buildLifeOsTools({ userId: 'u1' }).map((t) => t.declaration.name);
    expect(names).not.toContain('getMemories');
  });

  it('flag ON: getMemories joins the read-only tool set', () => {
    flagEnabled = true;
    const names = buildLifeOsTools({ userId: 'u1' }).map((t) => t.declaration.name);
    expect(names).toContain('getMemories');
  });

  it('with a topic, ranks by relevance via searchFacts', async () => {
    flagEnabled = true;
    mSearch.mockResolvedValue([fact('f1', 'runs before work')]);
    const tool = buildLifeOsTools({ userId: 'u1' }).find((t) => t.declaration.name === 'getMemories')!;
    const rows = (await tool.execute({ topic: 'exercise' })) as Array<{ text: string; lastSeen: string }>;
    expect(mSearch).toHaveBeenCalledWith('u1', 'exercise', 6, expect.any(Number));
    expect(rows).toEqual([{ kind: 'pattern', text: 'runs before work', lastSeen: '3 days ago' }]);
  });

  it('without a topic, returns the strongest live facts (salience order, max 8)', async () => {
    flagEnabled = true;
    mGetFacts.mockReturnValue([
      fact('weak', 'weak fact', 0.2),
      ...Array.from({ length: 9 }, (_, i) => fact(`s${i}`, `strong ${i}`, 1 - i * 0.01)),
    ]);
    const tool = buildLifeOsTools({ userId: 'u1' }).find((t) => t.declaration.name === 'getMemories')!;
    const rows = (await tool.execute({})) as Array<{ text: string }>;
    expect(mSearch).not.toHaveBeenCalled();
    expect(rows).toHaveLength(8);
    expect(rows[0]!.text).toBe('strong 0');
    expect(rows.map((r) => r.text)).not.toContain('weak fact');
  });
});


describe('buildLifeOsTools × agent_trend_tools', () => {
  const TREND_NAMES = ['getSleepTrend', 'getMoodTrend', 'getCompletionTrend', 'getRecentDays'];

  it('flag OFF (default): no trend tools in the set', () => {
    const names = buildLifeOsTools({ userId: 'u1' }).map((t) => t.declaration.name);
    for (const n of TREND_NAMES) expect(names).not.toContain(n);
  });

  it('flag ON: all four trend tools join, independently of the memory flag', () => {
    trendsEnabled = true;
    const names = buildLifeOsTools({ userId: 'u1' }).map((t) => t.declaration.name);
    for (const n of TREND_NAMES) expect(names).toContain(n);
    expect(names).not.toContain('getMemories'); // memory flag still off
  });

  it('getSleepTrend clamps the days window and delegates to the assembler', async () => {
    trendsEnabled = true;
    const { buildSleepTrend } = require('../agent/trends') as { buildSleepTrend: jest.Mock };
    const tool = buildLifeOsTools({ userId: 'u1' }).find((t) => t.declaration.name === 'getSleepTrend')!;
    await tool.execute({ days: 500 });
    expect(buildSleepTrend).toHaveBeenCalledWith(90); // clamped to max
    await tool.execute({});
    expect(buildSleepTrend).toHaveBeenCalledWith(14); // default
  });

  it('getRecentDays maps summaries to compact rows', async () => {
    trendsEnabled = true;
    const { getRecentDaySummaries } = require('@/db/queries/daySummaries') as {
      getRecentDaySummaries: jest.Mock;
    };
    getRecentDaySummaries.mockResolvedValue([
      {
        date: '2026-07-05',
        summary: 'They ran and worked.',
        stats: { mood: 4, blocksCompleted: 3, blocksTotal: 4, blocksSkipped: 1, decisions: [], journalExcerpt: null },
      },
    ]);
    const tool = buildLifeOsTools({ userId: 'u1' }).find((t) => t.declaration.name === 'getRecentDays')!;
    const rows = (await tool.execute({})) as Array<Record<string, unknown>>;
    expect(getRecentDaySummaries).toHaveBeenCalledWith('u1', 7);
    expect(rows).toEqual([
      { date: '2026-07-05', summary: 'They ran and worked.', mood: 4, blocksCompleted: 3, blocksTotal: 4 },
    ]);
  });
});
