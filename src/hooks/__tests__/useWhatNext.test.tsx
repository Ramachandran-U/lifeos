import { renderHook, act } from '@testing-library/react-native';
import { useWhatNext } from '../useWhatNext';

const mockWhatShouldIDoNext = jest.fn();
jest.mock('@/ai/agent/whatNext', () => ({
  whatShouldIDoNext: (...args: unknown[]) => mockWhatShouldIDoNext(...args),
}));

beforeEach(() => jest.clearAllMocks());

describe('useWhatNext', () => {
  it('starts idle with null answer and null error', () => {
    const { result } = renderHook(() => useWhatNext('u1'));
    expect(result.current.status).toBe('idle');
    expect(result.current.answer).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('run() transitions idle → loading → done and sets answer', async () => {
    mockWhatShouldIDoNext.mockResolvedValue({ answer: 'Go for a walk.' });
    const { result } = renderHook(() => useWhatNext('u1'));

    await act(async () => { await result.current.run(); });

    expect(result.current.status).toBe('done');
    expect(result.current.answer).toBe('Go for a walk.');
  });

  it('run() transitions to error and sets error message on rejection', async () => {
    mockWhatShouldIDoNext.mockRejectedValue(new Error('proxy timeout'));
    const { result } = renderHook(() => useWhatNext('u1'));

    await act(async () => { await result.current.run(); });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('proxy timeout');
  });

  it('uses fallback error text when rejection is not an Error', async () => {
    mockWhatShouldIDoNext.mockRejectedValue('unknown');
    const { result } = renderHook(() => useWhatNext('u1'));
    await act(async () => { await result.current.run(); });
    expect(result.current.error).toBe('Could not work that out right now.');
  });

  it('run() no-ops when userId is null', async () => {
    const { result } = renderHook(() => useWhatNext(null));
    await act(async () => { await result.current.run(); });
    expect(mockWhatShouldIDoNext).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('run() no-ops while already loading (prevents double-fire)', async () => {
    let resolveFirst!: (v: { answer: string }) => void;
    mockWhatShouldIDoNext.mockReturnValueOnce(
      new Promise<{ answer: string }>((r) => { resolveFirst = r; }),
    );

    const { result } = renderHook(() => useWhatNext('u1'));

    // Start first run without awaiting
    act(() => { void result.current.run(); });
    expect(result.current.status).toBe('loading');

    // Second run should be ignored
    await act(async () => { await result.current.run(); });
    expect(mockWhatShouldIDoNext).toHaveBeenCalledTimes(1);

    // Resolve to clean up
    await act(async () => { resolveFirst({ answer: 'done' }); });
  });

  it('reset() returns the hook to idle state', async () => {
    mockWhatShouldIDoNext.mockResolvedValue({ answer: 'Something.' });
    const { result } = renderHook(() => useWhatNext('u1'));
    await act(async () => { await result.current.run(); });
    expect(result.current.status).toBe('done');

    act(() => { result.current.reset(); });
    expect(result.current.status).toBe('idle');
    expect(result.current.answer).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
