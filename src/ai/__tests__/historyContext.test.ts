/**
 * Unit tests for buildHistoryContext.
 *
 * buildHistoryContext is sync where the DB layer is sync. All four external
 * dependencies (behaviour events, reflections, blood reports, memory store +
 * user store) are mocked so no SQLite or Supabase I/O runs.
 *
 * Private helpers (summarizeBlockReviews, groupEventsByDay) are exercised
 * indirectly through buildHistoryContext.
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGetRecentReflections = jest.fn();
const mockGetEventsLastNDays = jest.fn();
const mockGetBloodReports = jest.fn();
const mockGetFactsByUser = jest.fn();
const mockIsFactLive = jest.fn();
const mockGetState = jest.fn();

jest.mock('@/db/queries/reflections', () => ({
  getRecentReflections: (...args: unknown[]) => mockGetRecentReflections(...args),
}));
jest.mock('@/db/queries/behaviour', () => ({
  getEventsLastNDays: (...args: unknown[]) => mockGetEventsLastNDays(...args),
}));
jest.mock('@/db/queries/health', () => ({
  getBloodReports: (...args: unknown[]) => mockGetBloodReports(...args),
}));
jest.mock('@/ai/rag/memoryStore', () => ({
  getFactsByUser: (...args: unknown[]) => mockGetFactsByUser(...args),
  isFactLive: (...args: unknown[]) => mockIsFactLive(...args),
}));
jest.mock('@/store/useUserStore', () => ({
  useUserStore: { getState: (...args: unknown[]) => mockGetState(...args) },
}));

// ─── System under test ────────────────────────────────────────────────────────

import { buildHistoryContext } from '../historyContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function silentSources() {
  mockGetRecentReflections.mockReturnValue([]);
  mockGetEventsLastNDays.mockReturnValue([]);
  mockGetBloodReports.mockReturnValue([]);
  mockGetState.mockReturnValue({ userId: null });
  mockGetFactsByUser.mockReturnValue([]);
  mockIsFactLive.mockReturnValue(true);
}

beforeEach(() => {
  jest.clearAllMocks();
  silentSources();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildHistoryContext', () => {
  it('returns an empty array when all sources are empty', () => {
    expect(buildHistoryContext()).toEqual([]);
  });

  describe('reflections source', () => {
    it('converts a reflection into a RagItem sentence', () => {
      mockGetRecentReflections.mockReturnValue([
        { date: '2026-06-01', mood: 4, blockReviews: { blk1: 'did', blk2: 'skipped' } },
      ]);

      const items = buildHistoryContext();
      const text = items.find((i) => i.id.startsWith('reflect:'))?.text;
      expect(text).toContain('2026-06-01');
      expect(text).toContain('good');
      expect(text).toContain('completed 1 block');
      expect(text).toContain('skipped 1');
    });

    it('uses id reflect:<date>', () => {
      mockGetRecentReflections.mockReturnValue([
        { date: '2026-06-02', mood: 3, blockReviews: {} },
      ]);
      const items = buildHistoryContext();
      expect(items.some((i) => i.id === 'reflect:2026-06-02')).toBe(true);
    });

    it('pluralises block counts correctly', () => {
      mockGetRecentReflections.mockReturnValue([
        { date: '2026-06-03', mood: 5, blockReviews: { a: 'did', b: 'did', c: 'rescheduled' } },
      ]);
      const text = buildHistoryContext().find((i) => i.id.startsWith('reflect:'))?.text ?? '';
      expect(text).toContain('completed 2 blocks');
      expect(text).toContain('rescheduled 1');
    });

    it('still emits a reflection item with only the date when mood and reviews are absent', () => {
      mockGetRecentReflections.mockReturnValue([
        { date: '2026-06-04', mood: null, blockReviews: {} },
      ]);
      const items = buildHistoryContext();
      const item = items.find((i) => i.id === 'reflect:2026-06-04');
      expect(item).toBeDefined();
      expect(item?.text).toContain('2026-06-04');
    });

    it('skips reflections gracefully when the source throws', () => {
      mockGetRecentReflections.mockImplementation(() => { throw new Error('db error'); });
      expect(() => buildHistoryContext()).not.toThrow();
    });
  });

  describe('behaviour events source', () => {
    it('groups events by day into a single RagItem per day', () => {
      mockGetEventsLastNDays.mockReturnValue([
        { eventType: 'block_completed', module: 'health', createdAt: '2026-06-05T08:00:00Z' },
        { eventType: 'block_completed', module: 'health', createdAt: '2026-06-05T09:00:00Z' },
      ]);
      const items = buildHistoryContext();
      const dayItem = items.find((i) => i.id === 'behaviour:2026-06-05');
      expect(dayItem).toBeDefined();
      expect(dayItem?.text).toContain('2× block_completed (health)');
    });

    it('caps each day summary at 5 event-type keys', () => {
      const events = ['a', 'b', 'c', 'd', 'e', 'f'].map((mod) => ({
        eventType: 'block_completed',
        module: mod,
        createdAt: '2026-06-06T08:00:00Z',
      }));
      mockGetEventsLastNDays.mockReturnValue(events);
      const text = buildHistoryContext().find((i) => i.id.startsWith('behaviour:'))?.text ?? '';
      const commaCount = (text.match(/,/g) ?? []).length;
      // At most 4 commas = at most 5 parts
      expect(commaCount).toBeLessThanOrEqual(4);
    });

    it('skips behaviour events gracefully when the source throws', () => {
      mockGetEventsLastNDays.mockImplementation(() => { throw new Error('boom'); });
      expect(() => buildHistoryContext()).not.toThrow();
    });
  });

  describe('blood report source', () => {
    it('appends a blood report RagItem from the most recent report', () => {
      mockGetBloodReports.mockReturnValue([
        { id: 'rpt1', date: '2026-05-01T00:00:00Z', aiSummary: 'Iron slightly low.' },
      ]);
      const items = buildHistoryContext();
      const rpt = items.find((i) => i.id === 'blood:rpt1');
      expect(rpt?.text).toContain('Iron slightly low.');
      expect(rpt?.text).toContain('2026-05-01');
    });

    it('truncates long summaries at 200 chars', () => {
      const longSummary = 'x'.repeat(300);
      mockGetBloodReports.mockReturnValue([
        { id: 'rpt2', date: '2026-05-10T00:00:00Z', aiSummary: longSummary },
      ]);
      const text = buildHistoryContext().find((i) => i.id === 'blood:rpt2')?.text ?? '';
      // Summary is sliced to 200 chars
      const inText = text.split(': ')[1] ?? '';
      expect(inText.length).toBeLessThanOrEqual(200);
    });

    it('skips when the report has no aiSummary', () => {
      mockGetBloodReports.mockReturnValue([{ id: 'rpt3', date: '2026-05-15', aiSummary: null }]);
      const items = buildHistoryContext();
      expect(items.some((i) => i.id.startsWith('blood:'))).toBe(false);
    });

    it('skips blood reports gracefully when the source throws', () => {
      mockGetBloodReports.mockImplementation(() => { throw new Error('boom'); });
      expect(() => buildHistoryContext()).not.toThrow();
    });
  });

  describe('memory facts source', () => {
    it('prepends live memory facts when userId is present', () => {
      mockGetState.mockReturnValue({ userId: 'u1' });
      mockGetFactsByUser.mockReturnValue([
        { id: 'f1', text: 'User is vegetarian', kind: 'habit', salience: 0.9 },
      ]);
      mockIsFactLive.mockReturnValue(true);

      const items = buildHistoryContext();
      expect(items[0]?.id).toBe('memory:f1');
      expect(items[0]?.text).toBe('User is vegetarian');
    });

    it('filters out dead facts (isFactLive returns false)', () => {
      mockGetState.mockReturnValue({ userId: 'u2' });
      mockGetFactsByUser.mockReturnValue([
        { id: 'f2', text: 'Old fact', kind: 'habit', salience: 0.5 },
      ]);
      mockIsFactLive.mockReturnValue(false);

      const items = buildHistoryContext();
      expect(items.some((i) => i.id === 'memory:f2')).toBe(false);
    });

    it('caps memory facts at 12', () => {
      mockGetState.mockReturnValue({ userId: 'u3' });
      const facts = Array.from({ length: 20 }, (_, i) => ({
        id: `f${i}`,
        text: `fact ${i}`,
        kind: 'habit',
        salience: 1 - i * 0.01,
      }));
      mockGetFactsByUser.mockReturnValue(facts);
      mockIsFactLive.mockReturnValue(true);

      const memItems = buildHistoryContext().filter((i) => i.id.startsWith('memory:'));
      expect(memItems.length).toBeLessThanOrEqual(12);
    });

    it('sorts memory facts by descending salience', () => {
      mockGetState.mockReturnValue({ userId: 'u4' });
      mockGetFactsByUser.mockReturnValue([
        { id: 'low',  text: 'low salience',  kind: 'habit', salience: 0.2 },
        { id: 'high', text: 'high salience', kind: 'habit', salience: 0.9 },
      ]);
      mockIsFactLive.mockReturnValue(true);

      const memItems = buildHistoryContext().filter((i) => i.id.startsWith('memory:'));
      expect(memItems[0]?.id).toBe('memory:high');
      expect(memItems[1]?.id).toBe('memory:low');
    });

    it('skips memory facts gracefully when the source throws', () => {
      mockGetState.mockReturnValue({ userId: 'u5' });
      mockGetFactsByUser.mockImplementation(() => { throw new Error('boom'); });
      expect(() => buildHistoryContext()).not.toThrow();
    });

    it('skips memory facts when userId is null', () => {
      mockGetState.mockReturnValue({ userId: null });
      mockGetFactsByUser.mockReturnValue([{ id: 'f9', text: 'x', kind: 'habit', salience: 1 }]);
      const items = buildHistoryContext();
      expect(items.some((i) => i.id.startsWith('memory:'))).toBe(false);
    });
  });

  describe('recent item cap', () => {
    it('caps recent items at 30 before prepending memory facts', () => {
      // 35 reflections — only 30 should survive the cap
      const reflections = Array.from({ length: 35 }, (_, i) => ({
        date: `2026-05-${String(i + 1).padStart(2, '0')}`,
        mood: 3,
        blockReviews: { a: 'did' },
      }));
      mockGetRecentReflections.mockReturnValue(reflections);

      const items = buildHistoryContext().filter((i) => i.id.startsWith('reflect:'));
      expect(items.length).toBeLessThanOrEqual(30);
    });
  });
});
