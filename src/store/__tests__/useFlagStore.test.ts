/**
 * useFlagStore — remote feature-flag store with a local FALLBACK baseline.
 *
 *   - No EXPO_PUBLIC_AI_PROXY_URL  → serves FALLBACK_FLAGS, never fetches.
 *   - isEnabled / getFlag         → read against the live flag map.
 *   - STALE_MS                    → a fresh fetch is skipped inside the window,
 *                                   but `force` bypasses it.
 *   - fetch error                 → keeps the prior flags, records `error`.
 *   - success                     → FALLBACK ∪ server flags (server wins on key).
 *
 * PROXY_URL is read at module-load time, so every case that depends on it sets
 * (or clears) the env var, resets the module registry, and re-imports the store.
 */

type FlagStoreModule = typeof import('../useFlagStore');

const ORIGINAL_PROXY = process.env.EXPO_PUBLIC_AI_PROXY_URL;
// `global.fetch` is assigned directly (not via jest.spyOn), so restoreAllMocks
// won't undo it — snapshot and restore it ourselves so the worker route suites
// (which use the real fetch/Request) aren't poisoned by a leaked mock.
const ORIGINAL_FETCH = (global as { fetch?: unknown }).fetch;

interface MockResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

function mockFetchOnce(res: MockResponse): jest.Mock {
  const fn = jest.fn<Promise<MockResponse>, [string]>().mockResolvedValue(res);
  (global as { fetch: unknown }).fetch = fn;
  return fn;
}

function mockFetchReject(err: Error): jest.Mock {
  const fn = jest.fn<Promise<MockResponse>, [string]>().mockRejectedValue(err);
  (global as { fetch: unknown }).fetch = fn;
  return fn;
}

/** Load a fresh copy of the store with the given proxy URL in scope. */
function loadStore(proxyUrl: string | undefined): FlagStoreModule {
  if (proxyUrl === undefined) delete process.env.EXPO_PUBLIC_AI_PROXY_URL;
  else process.env.EXPO_PUBLIC_AI_PROXY_URL = proxyUrl;
  let mod!: FlagStoreModule;
  jest.isolateModules(() => {
    mod = require('../useFlagStore') as FlagStoreModule;
  });
  return mod;
}

afterEach(() => {
  if (ORIGINAL_PROXY === undefined) delete process.env.EXPO_PUBLIC_AI_PROXY_URL;
  else process.env.EXPO_PUBLIC_AI_PROXY_URL = ORIGINAL_PROXY;
  if (ORIGINAL_FETCH === undefined) delete (global as { fetch?: unknown }).fetch;
  else (global as { fetch?: unknown }).fetch = ORIGINAL_FETCH;
  jest.restoreAllMocks();
});

describe('FALLBACK_FLAGS baseline', () => {
  it('exposes the documented defaults on a fresh store', () => {
    const { useFlagStore } = loadStore(undefined);
    const { flags } = useFlagStore.getState();
    expect(flags.polymath_enabled).toBe(true);
    expect(flags.onboarding_v2).toBe(true);
    expect(flags.mutation_log_enabled).toBe(true);
    expect(flags.sync_engine_enabled).toBe(false);
    expect(flags.agent_what_next).toBe(false);
  });

  it('cold_start_v1 defaults ON in the fallback baseline (AC-11)', () => {
    const { useFlagStore } = loadStore(undefined);
    expect(useFlagStore.getState().flags.cold_start_v1).toBe(true);
    expect(useFlagStore.getState().isEnabled('cold_start_v1')).toBe(true);
  });
});

describe('persist key (AC-11)', () => {
  it('the store persists under lifeos_flags_v4 — bumped when cold_start_v1 landed default-on', () => {
    const { useFlagStore } = loadStore(undefined);
    expect(useFlagStore.persist.getOptions().name).toBe('lifeos_flags_v4');
  });
});

describe('isEnabled / getFlag', () => {
  it('isEnabled coerces truthiness; getFlag returns the fallback for unknown keys', () => {
    const { useFlagStore } = loadStore(undefined);
    const s = useFlagStore.getState();
    expect(s.isEnabled('polymath_enabled')).toBe(true);
    expect(s.isEnabled('chatbot_beta')).toBe(false);
    expect(s.isEnabled('totally_unknown_flag')).toBe(false);
    expect(s.getFlag('totally_unknown_flag', 'def')).toBe('def');
    expect(s.getFlag('sync_engine_enabled', true)).toBe(false);
  });
});

describe('fetchFlags with no proxy configured', () => {
  it('serves FALLBACK without ever calling fetch', async () => {
    const fetchSpy = mockFetchOnce({ ok: true, status: 200, json: async () => ({ flags: {} }) });
    const { useFlagStore } = loadStore(undefined);
    await useFlagStore.getState().fetchFlags();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(useFlagStore.getState().flags.polymath_enabled).toBe(true);
    expect(useFlagStore.getState().fetchedAt).not.toBeNull();
  });
});

describe('fetchFlags against a proxy', () => {
  it('merges server flags over FALLBACK (server wins on conflicting keys)', async () => {
    const fetchSpy = mockFetchOnce({
      ok: true,
      status: 200,
      json: async () => ({ flags: { sync_engine_enabled: true, brand_new_flag: 42 } }),
    });
    const { useFlagStore } = loadStore('https://proxy.example');
    await useFlagStore.getState().fetchFlags({ email: 'fake.user@example.test' });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain('https://proxy.example/v1/config');
    expect(url).toContain('email=fake.user%40example.test');

    const { flags } = useFlagStore.getState();
    // server override
    expect(flags.sync_engine_enabled).toBe(true);
    // server-only key
    expect(flags.brand_new_flag).toBe(42);
    // untouched fallback survives the merge
    expect(flags.polymath_enabled).toBe(true);
    expect(useFlagStore.getState().loading).toBe(false);
    expect(useFlagStore.getState().error).toBeNull();
  });

  it('skips a fetch inside the STALE_MS window, but force bypasses it', async () => {
    const fetchSpy = mockFetchOnce({
      ok: true,
      status: 200,
      json: async () => ({ flags: { chatbot_beta: true } }),
    });
    const { useFlagStore } = loadStore('https://proxy.example');

    await useFlagStore.getState().fetchFlags(); // first fetch sets fetchedAt
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await useFlagStore.getState().fetchFlags(); // within STALE_MS → skipped
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await useFlagStore.getState().fetchFlags({ force: true }); // bypass
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('keeps the prior flags and records an error on a non-ok response', async () => {
    const fetchSpy = mockFetchOnce({ ok: false, status: 503, json: async () => ({}) });
    const { useFlagStore } = loadStore('https://proxy.example');
    const before = { ...useFlagStore.getState().flags };

    await useFlagStore.getState().fetchFlags();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(useFlagStore.getState().flags).toEqual(before);
    expect(useFlagStore.getState().error).toBe('config 503');
    expect(useFlagStore.getState().loading).toBe(false);
  });

  it('keeps the prior flags and records an error when fetch rejects', async () => {
    const fetchSpy = mockFetchReject(new Error('network down'));
    const { useFlagStore } = loadStore('https://proxy.example');
    const before = { ...useFlagStore.getState().flags };

    await useFlagStore.getState().fetchFlags({ force: true });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(useFlagStore.getState().flags).toEqual(before);
    expect(useFlagStore.getState().error).toBe('network down');
  });
});
