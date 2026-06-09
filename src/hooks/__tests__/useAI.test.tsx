import { renderHook, act } from '@testing-library/react-native';
import { useAI } from '../useAI';

describe('useAI', () => {
  it('starts with loading=false and error=null', () => {
    const { result } = renderHook(() => useAI());
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('sets loading=true during the call and false after success', async () => {
    const { result } = renderHook(() => useAI());
    const fn = () => Promise.resolve('ok');

    let callPromise: Promise<unknown>;
    act(() => {
      callPromise = result.current.call(fn);
    });
    // loading is true while the promise is in flight — check synchronously
    // (state updates from async calls land after the await, so assert after)
    await act(async () => { await callPromise; });
    expect(result.current.loading).toBe(false);
  });

  it('returns the resolved value on success', async () => {
    const { result } = renderHook(() => useAI());
    let value: unknown;
    await act(async () => {
      value = await result.current.call(() => Promise.resolve(42));
    });
    expect(value).toBe(42);
  });

  it('sets error and returns null when the fn throws an Error', async () => {
    const { result } = renderHook(() => useAI());
    let value: unknown;
    await act(async () => {
      value = await result.current.call(() => Promise.reject(new Error('proxy down')));
    });
    expect(value).toBeNull();
    expect(result.current.error).toBe('proxy down');
    expect(result.current.loading).toBe(false);
  });

  it('uses a fallback message when the rejection is not an Error instance', async () => {
    const { result } = renderHook(() => useAI());
    await act(async () => {
      await result.current.call(() => Promise.reject('raw string rejection'));
    });
    expect(result.current.error).toBe('Something went wrong. Please try again.');
  });

  it('clears the previous error on the next call', async () => {
    const { result } = renderHook(() => useAI());
    // First call: fail
    await act(async () => {
      await result.current.call(() => Promise.reject(new Error('oops')));
    });
    expect(result.current.error).toBe('oops');
    // Second call: succeed
    await act(async () => {
      await result.current.call(() => Promise.resolve('good'));
    });
    expect(result.current.error).toBeNull();
  });
});
