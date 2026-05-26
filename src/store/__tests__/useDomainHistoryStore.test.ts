import { useDomainHistoryStore } from '../useDomainHistoryStore';
import type { DomainScores } from '@/utils/gamification';

const scores = (over: Partial<DomainScores> = {}): DomainScores => ({
  goals: 50, health: 50, finance: 50, career: 50, social: 50, mind: 50, ...over,
});

// The store records under "today" (UTC). To exercise multi-day behaviour we
// reach into the entries directly with synthetic dates, then assert the pure
// selectors. record()'s same-day idempotency is tested against real "today".
function reset() {
  useDomainHistoryStore.setState({ entries: {} });
}

beforeEach(reset);

describe('useDomainHistoryStore.record', () => {
  it('appends one entry per domain on first record', () => {
    useDomainHistoryStore.getState().record(scores({ goals: 60 }));
    const hist = useDomainHistoryStore.getState().historyFor('goals');
    expect(hist).toEqual([60]);
  });

  it('is idempotent within the same UTC day but refreshes a changed score', () => {
    const { record } = useDomainHistoryStore.getState();
    record(scores({ goals: 60 }));
    record(scores({ goals: 70 })); // same day → replaces, not appends
    const hist = useDomainHistoryStore.getState().historyFor('goals');
    expect(hist).toEqual([70]);
  });
});

describe('useDomainHistoryStore selectors over synthetic history', () => {
  it('historyFor returns only the most recent 7 entries', () => {
    const entries = {
      goals: Array.from({ length: 10 }, (_, i) => ({
        date: `2026-01-${String(i + 1).padStart(2, '0')}`,
        score: i, // 0..9
      })),
    };
    useDomainHistoryStore.setState({ entries });
    // last 7 of 0..9 → 3..9
    expect(useDomainHistoryStore.getState().historyFor('goals')).toEqual([3, 4, 5, 6, 7, 8, 9]);
  });

  it('fullHistoryFor returns the entire retained window', () => {
    const entries = {
      health: [
        { date: '2026-01-01', score: 10 },
        { date: '2026-02-01', score: 20 },
      ],
    };
    useDomainHistoryStore.setState({ entries });
    expect(useDomainHistoryStore.getState().fullHistoryFor('health')).toHaveLength(2);
  });

  it('deltaFor with no arg compares newest to oldest', () => {
    const entries = {
      finance: [
        { date: '2026-01-01', score: 30 },
        { date: '2026-01-10', score: 55 },
      ],
    };
    useDomainHistoryStore.setState({ entries });
    expect(useDomainHistoryStore.getState().deltaFor('finance')).toBe(25);
  });

  it('deltaFor(days) compares newest to the entry N positions back', () => {
    const entries = {
      career: Array.from({ length: 5 }, (_, i) => ({
        date: `2026-03-0${i + 1}`,
        score: i * 10, // 0,10,20,30,40
      })),
    };
    useDomainHistoryStore.setState({ entries });
    // newest = 40; 2 positions back (index len-1-2 = 2) = 20 → delta 20
    expect(useDomainHistoryStore.getState().deltaFor('career', 2)).toBe(20);
  });

  it('deltaFor returns 0 when fewer than 2 entries exist', () => {
    useDomainHistoryStore.setState({ entries: { mind: [{ date: '2026-01-01', score: 42 }] } });
    expect(useDomainHistoryStore.getState().deltaFor('mind')).toBe(0);
  });
});
