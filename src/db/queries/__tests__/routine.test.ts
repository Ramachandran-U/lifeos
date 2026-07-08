/**
 * Write-path tests for src/db/queries/routine.ts (web branch).
 *
 * Forces the web branch (Platform.OS === 'web') so the queries delegate to the
 * in-memory localStorage-backed webStorage helpers. Asserts the
 * {entity, op, before, after} snapshot recordMutation receives, plus the
 * (date, startTime) read ordering and status transitions.
 *
 * Echo-safety: webUpsertRoutineBlockById (the sync reducer's apply path) must
 * NEVER fire recordMutation.
 */

jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('@/sync/runtime', () => ({ recordMutation: jest.fn() }));

beforeAll(() => {
  const store: Record<string, string> = {};
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  };
});

import {
  createRoutineBlock,
  createRoutineBlocks,
  getRoutineBlocksByDate,
  getRoutineBlocksInRange,
  updateRoutineBlockStatus,
  updateRoutineBlock,
  setRoutineBlockCalendarEventId,
  deleteRoutineBlocksByDate,
  deleteRoutineBlock,
} from '../routine';
import { webUpsertRoutineBlockById, type WebRoutineBlock } from '../../webStorage';
import { recordMutation } from '@/sync/runtime';
import { format, subDays } from 'date-fns';

const recordMutationMock = recordMutation as jest.MockedFunction<typeof recordMutation>;

// Relative to "now" (not a hardcoded date) so it always falls inside the ~31-day
// window readBlockSnapshot scans on web. A fixed past date is a time-bomb: once
// it ages out of that window, the by-id snapshot reads null and the
// update/delete/calendar tests fail with no code change (previously 2026-05-27).
// Anchored a few days back — not exactly today — because readBlockSnapshot bounds
// its window with toISOString() (UTC) while blocks store local dates, so a
// local "today" can sort past the UTC window end near midnight in +UTC zones.
const DATE = format(subDays(new Date(), 3), 'yyyy-MM-dd');

function insert(over: Partial<{
  date: string; startTime: string; endTime: string; title: string;
  module: string; linkedEntityId: string; energyRequired: string; notes: string;
}> = {}): string {
  return createRoutineBlock({
    date: DATE,
    startTime: '09:00',
    endTime: '10:00',
    title: 'Block',
    module: 'goal',
    ...over,
  });
}

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

describe('createRoutineBlock (web)', () => {
  it('persists with status default "upcoming" and maps fields', () => {
    const id = createRoutineBlock({
      date: DATE,
      startTime: '07:00',
      endTime: '08:00',
      title: 'Morning run',
      module: 'health',
      linkedEntityId: 'goal-xyz',
      energyRequired: 'high',
      notes: 'easy pace',
    });

    const blocks = getRoutineBlocksByDate(DATE);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      id,
      title: 'Morning run',
      module: 'health',
      linkedEntityId: 'goal-xyz',
      status: 'upcoming',
      energyRequired: 'high',
      notes: 'easy pace',
    });
  });

  it('logs one insert mutation with before:null and the full row in after', () => {
    const id = insert({ title: 'Focus block' });

    expect(recordMutationMock).toHaveBeenCalledTimes(1);
    expect(recordMutationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'routine_blocks',
        entityId: id,
        op: 'insert',
        before: null,
        after: expect.objectContaining({ id, title: 'Focus block', status: 'upcoming' }),
      }),
    );
  });
});

describe('createRoutineBlocks (web — batch)', () => {
  it('inserts all blocks and logs one insert mutation per block', () => {
    const ids = createRoutineBlocks([
      { date: DATE, startTime: '09:00', endTime: '10:00', title: 'One', module: 'goal' },
      { date: DATE, startTime: '11:00', endTime: '12:00', title: 'Two', module: 'work' },
    ]);

    expect(ids).toHaveLength(2);
    expect(getRoutineBlocksByDate(DATE)).toHaveLength(2);
    expect(recordMutationMock).toHaveBeenCalledTimes(2);
    expect(recordMutationMock.mock.calls.every((c) => c[0].op === 'insert')).toBe(true);
    expect(recordMutationMock.mock.calls.map((c) => c[0].entityId).sort()).toEqual([...ids].sort());
  });
});

describe('getRoutineBlocksByDate (web — ordering)', () => {
  it('returns blocks ascending by startTime regardless of insert order', () => {
    insert({ startTime: '17:00' });
    insert({ startTime: '06:30' });
    insert({ startTime: '12:15' });
    const times = getRoutineBlocksByDate(DATE).map((b) => b.startTime);
    expect(times).toEqual(['06:30', '12:15', '17:00']);
  });
});

describe('getRoutineBlocksInRange (web — ordering)', () => {
  it('sorts by date then startTime across the range', () => {
    insert({ date: '2026-05-28', startTime: '08:00' });
    insert({ date: '2026-05-27', startTime: '20:00' });
    insert({ date: '2026-05-27', startTime: '07:00' });
    const out = getRoutineBlocksInRange('2026-05-27', '2026-05-28').map((b) => `${b.date} ${b.startTime}`);
    expect(out).toEqual(['2026-05-27 07:00', '2026-05-27 20:00', '2026-05-28 08:00']);
  });

  it('excludes dates outside the range', () => {
    insert({ date: '2026-05-26' });
    insert({ date: '2026-05-27' });
    insert({ date: '2026-05-30' });
    const dates = getRoutineBlocksInRange('2026-05-27', '2026-05-28').map((b) => b.date);
    expect(dates).toEqual(['2026-05-27']);
  });
});

describe('updateRoutineBlockStatus (web — transitions)', () => {
  it('moves upcoming → completed and logs before/after', () => {
    const id = insert();
    recordMutationMock.mockClear();

    updateRoutineBlockStatus(id, 'completed');

    expect(getRoutineBlocksByDate(DATE)[0].status).toBe('completed');
    const call = recordMutationMock.mock.calls[0][0];
    expect(call.op).toBe('update');
    expect(call.entity).toBe('routine_blocks');
    expect((call.before as Record<string, unknown>).status).toBe('upcoming');
    expect((call.after as Record<string, unknown>).status).toBe('completed');
  });

  it('supports a skipped transition too', () => {
    const id = insert();
    updateRoutineBlockStatus(id, 'skipped');
    expect(getRoutineBlocksByDate(DATE)[0].status).toBe('skipped');
  });
});

describe('updateRoutineBlock (web — patch)', () => {
  it('applies a partial patch (title/time) and logs the patched fields in after', () => {
    const id = insert({ title: 'Old', startTime: '09:00' });
    recordMutationMock.mockClear();

    updateRoutineBlock(id, { title: 'New', startTime: '10:30' });

    const block = getRoutineBlocksByDate(DATE)[0];
    expect(block.title).toBe('New');
    expect(block.startTime).toBe('10:30');
    const call = recordMutationMock.mock.calls[0][0];
    expect(call.op).toBe('update');
    expect((call.after as Record<string, unknown>).title).toBe('New');
    expect((call.after as Record<string, unknown>).startTime).toBe('10:30');
  });
});

describe('setRoutineBlockCalendarEventId (web)', () => {
  it('sets then clears the calendar event id, logging both', () => {
    const id = insert();
    recordMutationMock.mockClear();

    setRoutineBlockCalendarEventId(id, 'cal-evt-1');
    expect(getRoutineBlocksByDate(DATE)[0].calendarEventId).toBe('cal-evt-1');

    setRoutineBlockCalendarEventId(id, null);
    expect(getRoutineBlocksByDate(DATE)[0].calendarEventId).toBeUndefined();

    expect(recordMutationMock).toHaveBeenCalledTimes(2);
    expect((recordMutationMock.mock.calls[0][0].after as Record<string, unknown>).calendarEventId).toBe('cal-evt-1');
    expect((recordMutationMock.mock.calls[1][0].after as Record<string, unknown>).calendarEventId).toBeNull();
  });
});

describe('deleteRoutineBlocksByDate (web)', () => {
  it('purges every block on the date and logs a delete tombstone per row', () => {
    insert({ startTime: '08:00' });
    insert({ startTime: '09:00' });
    insert({ date: '2026-05-28', startTime: '10:00' }); // different date — untouched
    recordMutationMock.mockClear();

    deleteRoutineBlocksByDate(DATE);

    expect(getRoutineBlocksByDate(DATE)).toHaveLength(0);
    expect(getRoutineBlocksByDate('2026-05-28')).toHaveLength(1);
    expect(recordMutationMock).toHaveBeenCalledTimes(2);
    expect(recordMutationMock.mock.calls.every((c) => c[0].op === 'delete' && c[0].after === null)).toBe(true);
    expect(recordMutationMock.mock.calls.every((c) => (c[0].before as Record<string, unknown>).date === DATE)).toBe(true);
  });

  it('is a no-op (no mutation) for an empty day', () => {
    deleteRoutineBlocksByDate('2099-01-01');
    expect(recordMutationMock).not.toHaveBeenCalled();
  });
});

describe('deleteRoutineBlock (web — single)', () => {
  it('removes the block and logs a delete with before populated, after:null', () => {
    const id = insert();
    recordMutationMock.mockClear();

    deleteRoutineBlock(id);

    expect(getRoutineBlocksByDate(DATE)).toHaveLength(0);
    const call = recordMutationMock.mock.calls[0][0];
    expect(call.op).toBe('delete');
    expect(call.after).toBeNull();
    expect((call.before as Record<string, unknown>).id).toBe(id);
  });
});

describe('echo-safety: webUpsertRoutineBlockById (sync reducer path)', () => {
  it('does NOT record a mutation when applying a remote routine block', () => {
    const remote: WebRoutineBlock = {
      id: 'remote-block-1',
      date: DATE,
      startTime: '06:00',
      endTime: '07:00',
      title: 'Synced block',
      module: 'goal',
      status: 'upcoming',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    webUpsertRoutineBlockById(remote);

    expect(recordMutationMock).not.toHaveBeenCalled();
    expect(getRoutineBlocksByDate(DATE).map((b) => b.id)).toContain('remote-block-1');
  });
});
