/**
 * Pure selectors/formatters plus the defensive async fetch. `react-native` is
 * forced to the web platform here so fetchActiveRecurring exercises the real
 * path; the finance DB accessor is mocked so we control the data.
 */

jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('@/finance/db/transactionDb', () => ({ getActiveRecurringItems: jest.fn() }));

import {
  selectUpcomingRecurring,
  recurringToRagItems,
  buildBillsContext,
  getUpcomingBillsForAgent,
} from '../billsContext';
import { getActiveRecurringItems } from '@/finance/db/transactionDb';
import type { RecurringItemRecord } from '@/finance/db/transactionDb';

const fetchMock = getActiveRecurringItems as jest.MockedFunction<typeof getActiveRecurringItems>;

function item(over: Partial<RecurringItemRecord>): RecurringItemRecord {
  return {
    id: 'i1',
    kind: 'bill',
    merchant: 'Airtel',
    amount: 99900,
    dueDate: '2026-06-12',
    cadence: null,
    rawEmailId: 'i1',
    confidence: 0.9,
    dismissed: false,
    detectedAt: '2026-06-01T00:00:00.000Z',
    ...over,
  };
}

const TODAY = '2026-06-10';

describe('selectUpcomingRecurring', () => {
  it('keeps overdue + due-within-window items, sorted soonest first', () => {
    const out = selectUpcomingRecurring(
      [
        item({ id: 'soon', dueDate: '2026-06-12' }),
        item({ id: 'overdue', dueDate: '2026-06-08' }),
        item({ id: 'far', dueDate: '2026-06-30' }), // outside 7-day window
      ],
      TODAY,
    );
    expect(out.map((i) => i.id)).toEqual(['overdue', 'soon']);
  });

  it('drops items without a due date', () => {
    const out = selectUpcomingRecurring([item({ id: 'nodate', dueDate: null })], TODAY);
    expect(out).toEqual([]);
  });

  it('honours a custom window', () => {
    const out = selectUpcomingRecurring([item({ id: 'd20', dueDate: '2026-06-25' })], TODAY, 30);
    expect(out.map((i) => i.id)).toEqual(['d20']);
  });

  it('ages out items overdue beyond the grace window', () => {
    const out = selectUpcomingRecurring(
      [
        item({ id: 'stale', dueDate: '2026-05-01' }), // ~40 days overdue → dropped
        item({ id: 'recent', dueDate: '2026-06-08' }), // 2 days overdue → kept
      ],
      TODAY,
    );
    expect(out.map((i) => i.id)).toEqual(['recent']);
  });
});

describe('recurringToRagItems', () => {
  it('returns [] when nothing is upcoming', () => {
    expect(recurringToRagItems([], TODAY)).toEqual([]);
  });

  it('builds one consolidated sentence with amounts and due labels', () => {
    const [ragItem] = recurringToRagItems(
      [
        item({ kind: 'bill', merchant: 'Airtel', amount: 99900, dueDate: '2026-06-12' }),
        item({ kind: 'subscription', merchant: 'Netflix', amount: 64900, dueDate: '2026-06-15' }),
      ],
      TODAY,
    );
    expect(ragItem.id).toBe('bills:upcoming:2026-06-10');
    expect(ragItem.text).toContain('Airtel ₹999 (Due in 2 days)');
    expect(ragItem.text).toContain('Netflix ₹649 renews (Due in 5 days)');
    expect(ragItem.metadata).toMatchObject({ kind: 'bills', count: 2 });
  });
});

describe('buildBillsContext (defensive)', () => {
  beforeEach(() => fetchMock.mockReset());

  it('returns [] when the store read fails', async () => {
    fetchMock.mockRejectedValue(new Error('no indexeddb'));
    await expect(buildBillsContext(TODAY)).resolves.toEqual([]);
  });

  it('summarises upcoming items when available', async () => {
    fetchMock.mockResolvedValue([
      item({ merchant: 'Airtel', dueDate: '2026-06-12' }),
      item({ id: 'far', merchant: 'Annual', dueDate: '2026-12-01' }), // filtered out (far)
    ]);
    const out = await buildBillsContext(TODAY);
    expect(out).toHaveLength(1);
    expect(out[0].text).toContain('Airtel');
    expect(out[0].text).not.toContain('Annual');
  });
});

describe('getUpcomingBillsForAgent', () => {
  beforeEach(() => fetchMock.mockReset());

  it('returns [] when unavailable', async () => {
    fetchMock.mockRejectedValue(new Error('unavailable'));
    await expect(getUpcomingBillsForAgent(TODAY)).resolves.toEqual([]);
  });

  it('maps upcoming items to a compact view', async () => {
    fetchMock.mockResolvedValue([
      item({ kind: 'bill', merchant: 'Airtel', amount: 99900, dueDate: '2026-06-12' }),
      item({ kind: 'subscription', merchant: 'Gym', amount: 0, dueDate: '2026-06-11' }),
    ]);
    const out = await getUpcomingBillsForAgent(TODAY);
    expect(out).toEqual([
      { kind: 'subscription', merchant: 'Gym', amount: null, due: 'Due tomorrow' },
      { kind: 'bill', merchant: 'Airtel', amount: '₹999', due: 'Due in 2 days' },
    ]);
  });
});
