import { renderHook, act } from '@testing-library/react-native';
import { useRotatingPlaceholder } from '../useRotatingPlaceholder';

let mockMotionScale = 1;
jest.mock('@/theme/motion', () => ({
  useMotionScale: () => mockMotionScale,
}));

beforeEach(() => {
  mockMotionScale = 1;
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('useRotatingPlaceholder', () => {
  it('returns empty string when phrases array is empty', () => {
    const { result } = renderHook(() => useRotatingPlaceholder([]));
    expect(result.current).toBe('');
  });

  it('returns the only phrase when array has one item', () => {
    const { result } = renderHook(() => useRotatingPlaceholder(['only']));
    expect(result.current).toBe('only');
  });

  it('starts on the first phrase', () => {
    const { result } = renderHook(() =>
      useRotatingPlaceholder(['first', 'second'], { intervalMs: 1000 }),
    );
    expect(result.current).toBe('first');
  });

  it('advances to the next phrase after the interval', () => {
    const { result } = renderHook(() =>
      useRotatingPlaceholder(['a', 'b', 'c'], { intervalMs: 500 }),
    );
    act(() => { jest.advanceTimersByTime(500); });
    expect(result.current).toBe('b');
    act(() => { jest.advanceTimersByTime(500); });
    expect(result.current).toBe('c');
  });

  it('wraps back to the first phrase after the last', () => {
    const { result } = renderHook(() =>
      useRotatingPlaceholder(['x', 'y'], { intervalMs: 200 }),
    );
    act(() => { jest.advanceTimersByTime(400); });
    // x → y → x
    expect(result.current).toBe('x');
  });

  it('stays on first phrase when active is false', () => {
    const { result } = renderHook(() =>
      useRotatingPlaceholder(['alpha', 'beta'], { active: false, intervalMs: 100 }),
    );
    act(() => { jest.advanceTimersByTime(500); });
    expect(result.current).toBe('alpha');
  });

  it('stays on first phrase when motionScale is 0 (reduce-motion)', () => {
    mockMotionScale = 0;
    const { result } = renderHook(() =>
      useRotatingPlaceholder(['p1', 'p2'], { intervalMs: 100 }),
    );
    act(() => { jest.advanceTimersByTime(500); });
    expect(result.current).toBe('p1');
  });

  it('clears the interval on unmount', () => {
    const { unmount } = renderHook(() =>
      useRotatingPlaceholder(['a', 'b'], { intervalMs: 200 }),
    );
    expect(() => {
      unmount();
      act(() => { jest.advanceTimersByTime(1000); });
    }).not.toThrow();
  });
});
