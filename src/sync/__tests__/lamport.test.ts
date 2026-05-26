import { LamportClock, compareLamport } from '../lamport';

describe('LamportClock', () => {
  it('starts at 0 and ticks monotonically', () => {
    const c = new LamportClock();
    expect(c.current).toBe(0);
    expect(c.tick()).toBe(1);
    expect(c.tick()).toBe(2);
    expect(c.current).toBe(2);
  });

  it('resumes from an initial value', () => {
    const c = new LamportClock(42);
    expect(c.current).toBe(42);
    expect(c.tick()).toBe(43);
  });

  it('rejects invalid initial values', () => {
    expect(() => new LamportClock(-1)).toThrow(RangeError);
    expect(() => new LamportClock(1.5)).toThrow(RangeError);
  });

  it('observe() advances past a higher remote time', () => {
    const c = new LamportClock(5);
    c.observe(10);
    expect(c.current).toBe(10);
    expect(c.tick()).toBe(11); // next local event strictly after remote
  });

  it('observe() never moves backwards or accepts garbage', () => {
    const c = new LamportClock(10);
    c.observe(3);
    expect(c.current).toBe(10);
    c.observe(-5);
    c.observe(NaN);
    c.observe(2.7);
    expect(c.current).toBe(10);
  });
});

describe('compareLamport', () => {
  it('orders by lamport time first', () => {
    expect(compareLamport({ lamport: 1, deviceId: 'z' }, { lamport: 2, deviceId: 'a' })).toBeLessThan(0);
    expect(compareLamport({ lamport: 3, deviceId: 'a' }, { lamport: 2, deviceId: 'z' })).toBeGreaterThan(0);
  });

  it('breaks ties deterministically by deviceId', () => {
    expect(compareLamport({ lamport: 5, deviceId: 'aaa' }, { lamport: 5, deviceId: 'bbb' })).toBeLessThan(0);
    expect(compareLamport({ lamport: 5, deviceId: 'bbb' }, { lamport: 5, deviceId: 'aaa' })).toBeGreaterThan(0);
  });

  it('returns 0 only for identical (lamport, deviceId)', () => {
    expect(compareLamport({ lamport: 7, deviceId: 'x' }, { lamport: 7, deviceId: 'x' })).toBe(0);
  });

  it('produces a stable total order when sorting concurrent mutations', () => {
    const muts = [
      { lamport: 2, deviceId: 'b' },
      { lamport: 1, deviceId: 'b' },
      { lamport: 2, deviceId: 'a' },
      { lamport: 1, deviceId: 'a' },
    ];
    const sorted = [...muts].sort(compareLamport);
    expect(sorted).toEqual([
      { lamport: 1, deviceId: 'a' },
      { lamport: 1, deviceId: 'b' },
      { lamport: 2, deviceId: 'a' },
      { lamport: 2, deviceId: 'b' },
    ]);
  });
});
