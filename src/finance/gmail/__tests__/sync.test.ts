import { syncFinanceFromGmail } from '../sync';
import { syncRecentEmails } from '../fetcher';
import { parseTransactionEmail } from '../../parsers/emailParsers';
import { categorizeBatch } from '../../categorizer';
import { upsertTransactions } from '../../db/transactionDb';

// Every stage of the pipeline is mocked: this spec verifies the ORCHESTRATION
// (single-pass parse, the categorize call shape, the record mapping, the
// summary), not the individual stages (those have their own specs).
jest.mock('../fetcher', () => ({ syncRecentEmails: jest.fn() }));
jest.mock('../../parsers/emailParsers', () => ({ parseTransactionEmail: jest.fn() }));
jest.mock('../../categorizer', () => ({ categorizeBatch: jest.fn() }));
jest.mock('../../db/transactionDb', () => ({ upsertTransactions: jest.fn() }));

const mockFetch = syncRecentEmails as jest.Mock;
const mockParse = parseTransactionEmail as jest.Mock;
const mockCategorize = categorizeBatch as jest.Mock;
const mockUpsert = upsertTransactions as jest.Mock;

function msg(id: string, over: Record<string, unknown> = {}) {
  return { id, subject: `subject-${id}`, from: `${id}@bank.com`, body: `body-${id}`, date: '2026-06-10', ...over };
}
function tx(over: Record<string, unknown> = {}) {
  return { amount: 10000, direction: 'debit', merchant: 'Acme', confidence: 0.8, source: 'hdfc', ...over };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('syncFinanceFromGmail', () => {
  it('fetches → parses → categorizes → upserts and returns a summary', async () => {
    mockFetch.mockResolvedValue([msg('m1'), msg('m2'), msg('m3')]);
    mockParse.mockImplementation((from: string) => {
      if (from.startsWith('m1')) return tx({ merchant: 'Acme' });
      if (from.startsWith('m2')) return tx({ merchant: 'Beta', channel: 'p2m' });
      return null; // m3 is not a transaction email
    });
    mockCategorize.mockResolvedValue(['food', 'transfers']);
    mockUpsert.mockResolvedValue(2);

    const result = await syncFinanceFromGmail('client-1');

    expect(result).toEqual({ total: 3, parsed: 2, skipped: 1, ingested: 2 });

    // categorize gets exactly the parsed transactions' classify inputs + options.
    expect(mockCategorize).toHaveBeenCalledTimes(1);
    expect(mockCategorize).toHaveBeenCalledWith(
      [
        { merchant: 'Acme', amount: 10000, direction: 'debit', channel: undefined },
        { merchant: 'Beta', amount: 10000, direction: 'debit', channel: 'p2m' },
      ],
      { maxAiItems: 50, batchSize: 25 },
    );

    // Records map message.id → id/rawEmailId, category by index, no channel field.
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledWith([
      {
        id: 'm1', date: '2026-06-10', amount: 10000, direction: 'debit', merchant: 'Acme',
        category: 'food', source: 'hdfc', rawEmailId: 'm1', confidence: 0.8, userCorrected: false,
      },
      {
        id: 'm2', date: '2026-06-10', amount: 10000, direction: 'debit', merchant: 'Beta',
        category: 'transfers', source: 'hdfc', rawEmailId: 'm2', confidence: 0.8, userCorrected: false,
      },
    ]);
  });

  it('parses each email exactly once (single pass — no double parse)', async () => {
    mockFetch.mockResolvedValue([msg('m1'), msg('m2'), msg('m3')]);
    mockParse.mockReturnValue(null);
    mockCategorize.mockResolvedValue([]);
    mockUpsert.mockResolvedValue(0);

    const result = await syncFinanceFromGmail('client-1');

    expect(mockParse).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ total: 3, parsed: 0, skipped: 3, ingested: 0 });
    // Nothing to categorize / upsert when nothing parses.
    expect(mockCategorize).toHaveBeenCalledWith([], { maxAiItems: 50, batchSize: 25 });
    expect(mockUpsert).toHaveBeenCalledWith([]);
  });

  it('falls back to category "other" when the categorizer returns fewer entries', async () => {
    mockFetch.mockResolvedValue([msg('m1'), msg('m2')]);
    mockParse.mockReturnValue(tx());
    mockCategorize.mockResolvedValue(['food']); // only one category for two txns
    mockUpsert.mockResolvedValue(2);

    await syncFinanceFromGmail('client-1');

    const records = mockUpsert.mock.calls[0][0] as Array<{ category: string }>;
    expect(records[0].category).toBe('food');
    expect(records[1].category).toBe('other');
  });

  it('falls back to today when the email has no date', async () => {
    mockFetch.mockResolvedValue([msg('m1', { date: '' })]);
    mockParse.mockReturnValue(tx());
    mockCategorize.mockResolvedValue(['food']);
    mockUpsert.mockResolvedValue(1);

    await syncFinanceFromGmail('client-1');

    const records = mockUpsert.mock.calls[0][0] as Array<{ date: string }>;
    expect(records[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
