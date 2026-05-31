import { formatDuration } from '../duration';

describe('formatDuration', () => {
  it('shows plain minutes under an hour', () => {
    expect(formatDuration(0)).toBe('0 min');
    expect(formatDuration(1)).toBe('1 min');
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(59)).toBe('59 min');
  });

  it('shows hours and minutes from an hour up', () => {
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(125)).toBe('2h 5min');
    expect(formatDuration(215)).toBe('3h 35min');
  });

  it('drops the minute part when it is zero', () => {
    expect(formatDuration(120)).toBe('2h');
    expect(formatDuration(180)).toBe('3h');
  });

  it('clamps negatives and rounds fractional inputs', () => {
    expect(formatDuration(-10)).toBe('0 min');
    expect(formatDuration(44.6)).toBe('45 min');
    expect(formatDuration(59.6)).toBe('1h');
  });
});
