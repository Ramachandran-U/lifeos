/**
 * Boot must survive an unreachable auth backend.
 *
 * Regression context: the Supabase host in the production bundle stopped
 * resolving. `app/_layout.tsx` awaited `supabase.auth.getSession()` before
 * flipping `dbReady`, and renders `null` until it does — so the app showed a
 * blank screen for as long as the network layer took to give up. The symptom
 * reported was "it takes too long to load", with no error anywhere.
 *
 * These pin the contract that makes that impossible: the read is raced against
 * a deadline, a miss or a rejection resolves to `null` ("no session, carry on"),
 * and nothing is left pending afterwards.
 */
import { withAuthDeadline, AUTH_BOOT_TIMEOUT_MS } from '../bootSession';

describe('withAuthDeadline', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns the value when the read settles in time', async () => {
    const result = await withAuthDeadline(async () => ({ data: { session: { user: 'u1' } } }), 50);
    expect(result).toEqual({ data: { session: { user: 'u1' } } });
  });

  it('resolves null when the read hangs past the deadline — the outage case', async () => {
    // A promise that never settles: the dead-host behaviour.
    const neverSettles = () => new Promise<never>(() => {});

    const started = Date.now();
    const result = await withAuthDeadline(neverSettles, 60);

    expect(result).toBeNull();
    expect(Date.now() - started).toBeGreaterThanOrEqual(50);
  });

  it('resolves null when the read rejects (DNS / network error)', async () => {
    const result = await withAuthDeadline(async () => {
      throw new Error('getaddrinfo ENOTFOUND izojsgzlaehodwlqwyvf.supabase.co');
    }, 50);

    expect(result).toBeNull();
  });

  it('does not reject — boot must never be broken by this call', async () => {
    await expect(withAuthDeadline(async () => {
      throw new Error('boom');
    }, 20)).resolves.toBeNull();
  });

  it('clears its timer when the read wins, leaving nothing pending', async () => {
    jest.useFakeTimers();
    const clearSpy = jest.spyOn(global, 'clearTimeout');

    await withAuthDeadline(async () => 'ok', 10_000);

    expect(clearSpy).toHaveBeenCalled();
    // A lingering 10s timer would keep a Node process (and a test run) alive.
    expect(jest.getTimerCount()).toBe(0);
    clearSpy.mockRestore();
  });

  it('defaults to a bounded deadline rather than waiting forever', () => {
    expect(AUTH_BOOT_TIMEOUT_MS).toBeGreaterThan(0);
    expect(AUTH_BOOT_TIMEOUT_MS).toBeLessThanOrEqual(5_000);
  });
});
