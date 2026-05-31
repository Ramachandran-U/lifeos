import { increment, gauge, getCounter, getMetrics, resetMetrics } from '../metrics';

afterEach(() => resetMetrics());

describe('metrics counters', () => {
  test('increment accumulates on a series', () => {
    increment('sync.mutations.pushed');
    increment('sync.mutations.pushed');
    expect(getCounter('sync.mutations.pushed')).toBe(2);
  });

  test('increment by a custom amount', () => {
    increment('sync.mutations.pushed', {}, 5);
    increment('sync.mutations.pushed', {}, 3);
    expect(getCounter('sync.mutations.pushed')).toBe(8);
  });

  test('tags create distinct series; tag order does not matter', () => {
    increment('sync.push', { result: 'ok' });
    increment('sync.push', { result: 'fail' });
    increment('sync.push', { result: 'ok' });
    expect(getCounter('sync.push', { result: 'ok' })).toBe(2);
    expect(getCounter('sync.push', { result: 'fail' })).toBe(1);

    // Same tags in different key order collapse to one series.
    increment('x', { a: 1, b: 2 });
    increment('x', { b: 2, a: 1 });
    expect(getCounter('x', { a: 1, b: 2 })).toBe(2);
  });

  test('unknown counter reads as 0', () => {
    expect(getCounter('never.touched')).toBe(0);
  });
});

describe('metrics gauges', () => {
  test('gauge records the latest value, not a sum', () => {
    gauge('sync.outbox.depth', 10);
    gauge('sync.outbox.depth', 3);
    const snap = getMetrics();
    const g = snap.gauges.find((x) => x.name === 'sync.outbox.depth');
    expect(g?.value).toBe(3);
  });
});

describe('metrics snapshot + reset', () => {
  test('getMetrics returns a copy and resetMetrics clears all series', () => {
    increment('a');
    gauge('b', 1);
    expect(getMetrics().counters).toHaveLength(1);
    expect(getMetrics().gauges).toHaveLength(1);

    resetMetrics();
    expect(getMetrics().counters).toHaveLength(0);
    expect(getMetrics().gauges).toHaveLength(0);
  });
});
