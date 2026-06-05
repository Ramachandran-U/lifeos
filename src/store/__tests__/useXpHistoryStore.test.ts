import { useXpHistoryStore } from '../useXpHistoryStore';

beforeEach(() => {
  useXpHistoryStore.setState({ entries: [] });
});

describe('useXpHistoryStore.record', () => {
  it('records once per UTC day, refreshing the value if XP grows', () => {
    const { record } = useXpHistoryStore.getState();
    record(100);
    record(150); // same day → refresh in place, not a new entry
    const entries = useXpHistoryStore.getState().entries;
    expect(entries).toHaveLength(1);
    expect(entries[0].totalXP).toBe(150);
  });

  it('is a no-op when the same value is recorded again the same day', () => {
    const { record } = useXpHistoryStore.getState();
    record(100);
    record(100);
    expect(useXpHistoryStore.getState().entries).toHaveLength(1);
  });
});

describe('useXpHistoryStore.dailyGains / gainedInWindow', () => {
  it('derives daily gains by differencing consecutive cumulative snapshots', () => {
    useXpHistoryStore.setState({
      entries: [
        { date: '2026-06-01', totalXP: 100 },
        { date: '2026-06-02', totalXP: 130 }, // +30
        { date: '2026-06-03', totalXP: 130 }, // +0
        { date: '2026-06-04', totalXP: 200 }, // +70
      ],
    });
    expect(useXpHistoryStore.getState().dailyGains()).toEqual([30, 0, 70]);
    expect(useXpHistoryStore.getState().gainedInWindow()).toBe(100);
  });

  it('returns an empty series with fewer than 2 snapshots (new user)', () => {
    useXpHistoryStore.setState({ entries: [{ date: '2026-06-01', totalXP: 50 }] });
    expect(useXpHistoryStore.getState().dailyGains()).toEqual([]);
  });

  it('windows the gains to the requested day count', () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
      date: `2026-06-${String(i + 1).padStart(2, '0')}`,
      totalXP: i * 10,
    }));
    useXpHistoryStore.setState({ entries });
    const gains = useXpHistoryStore.getState().dailyGains(7);
    expect(gains).toHaveLength(7); // 9 gains exist; last 7 returned
    expect(gains.every((g) => g === 10)).toBe(true);
  });

  it('never returns a negative gain even if a snapshot regressed', () => {
    useXpHistoryStore.setState({
      entries: [
        { date: '2026-06-01', totalXP: 200 },
        { date: '2026-06-02', totalXP: 150 }, // regression guard → 0
      ],
    });
    expect(useXpHistoryStore.getState().dailyGains()).toEqual([0]);
  });
});
