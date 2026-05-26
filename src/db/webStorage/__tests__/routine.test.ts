/**
 * BUG-014 regression — web routine getters must return blocks in ascending
 * (date, startTime) order regardless of insertion order.
 */

// Minimal in-memory localStorage shim for the node test env (the _io layer
// reads/writes window.localStorage on web).
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
  webInsertRoutineBlock,
  webGetRoutineBlocksByDate,
  webGetRoutineBlocksInRange,
  type WebRoutineBlock,
} from '../routine';

function block(over: Partial<WebRoutineBlock>): WebRoutineBlock {
  return {
    id: Math.random().toString(36).slice(2),
    date: '2026-05-27',
    startTime: '09:00',
    endTime: '10:00',
    title: 'Block',
    module: 'goal',
    status: 'upcoming',
    createdAt: '', updatedAt: '',
    ...over,
  };
}

beforeEach(() => { localStorage.clear(); });

describe('webGetRoutineBlocksByDate', () => {
  it('returns blocks sorted ascending by startTime regardless of insert order', () => {
    webInsertRoutineBlock(block({ startTime: '17:00' }));
    webInsertRoutineBlock(block({ startTime: '06:30' }));
    webInsertRoutineBlock(block({ startTime: '12:15' }));
    const times = webGetRoutineBlocksByDate('2026-05-27').map((b) => b.startTime);
    expect(times).toEqual(['06:30', '12:15', '17:00']);
  });
});

describe('webGetRoutineBlocksInRange', () => {
  it('sorts by date then startTime across the range', () => {
    webInsertRoutineBlock(block({ date: '2026-05-28', startTime: '08:00' }));
    webInsertRoutineBlock(block({ date: '2026-05-27', startTime: '20:00' }));
    webInsertRoutineBlock(block({ date: '2026-05-27', startTime: '07:00' }));
    const out = webGetRoutineBlocksInRange('2026-05-27', '2026-05-28')
      .map((b) => `${b.date} ${b.startTime}`);
    expect(out).toEqual(['2026-05-27 07:00', '2026-05-27 20:00', '2026-05-28 08:00']);
  });
});
