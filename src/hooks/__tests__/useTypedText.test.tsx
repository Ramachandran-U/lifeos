import { renderHook, act } from '@testing-library/react-native';
import { useTypedText } from '../useTypedText';

// Control motion scale from tests.
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

describe('useTypedText', () => {
  it('returns empty string initially when motion is on', () => {
    const { result } = renderHook(() => useTypedText('Hello'));
    expect(result.current).toBe('');
  });

  it('reveals characters progressively via setInterval', () => {
    const { result } = renderHook(() => useTypedText('Hi', { charsPerSecond: 10 }));
    // interval = 100ms per char
    act(() => { jest.advanceTimersByTime(100); });
    expect(result.current).toBe('H');
    act(() => { jest.advanceTimersByTime(100); });
    expect(result.current).toBe('Hi');
  });

  it('completes the full text after enough time', () => {
    const { result } = renderHook(() => useTypedText('ABC', { charsPerSecond: 100 }));
    act(() => { jest.advanceTimersByTime(1000); });
    expect(result.current).toBe('ABC');
  });

  it('returns full text immediately when motionScale is 0 (reduce-motion)', () => {
    mockMotionScale = 0;
    const { result } = renderHook(() => useTypedText('Hello'));
    expect(result.current).toBe('Hello');
  });

  it('respects startDelay before typing begins', () => {
    const { result } = renderHook(() =>
      useTypedText('A', { charsPerSecond: 100, startDelay: 500 }),
    );
    // Before the delay: nothing
    act(() => { jest.advanceTimersByTime(400); });
    expect(result.current).toBe('');
    // After the delay + one interval: first char
    act(() => { jest.advanceTimersByTime(200); });
    expect(result.current).toBe('A');
  });

  it('resets and restarts when text changes', () => {
    let text = 'AB';
    const { result, rerender } = renderHook(() => useTypedText(text, { charsPerSecond: 100 }));
    act(() => { jest.advanceTimersByTime(500); });
    expect(result.current).toBe('AB');

    text = 'XY';
    rerender({});
    // After rerender with new text, visible should reset and start re-typing.
    // At 100 chars/sec the interval is 10ms — advance exactly one tick.
    act(() => { jest.advanceTimersByTime(10); });
    expect(result.current).toBe('X');
  });

  it('clears timers on unmount without errors', () => {
    const { unmount } = renderHook(() => useTypedText('Hello', { charsPerSecond: 10 }));
    expect(() => {
      act(() => { jest.advanceTimersByTime(50); });
      unmount();
      act(() => { jest.advanceTimersByTime(500); });
    }).not.toThrow();
  });
});
