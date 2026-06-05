/**
 * proxyGeminiLive — the standalone WebSocket voice proxy. (NOTE: currently
 * imported but not called by index.ts, which inlines its own /gemini-live state
 * machine; kept covered as an exported surface.) Drives it with a stubbed
 * WebSocketPair + a fetch that returns a fake upstream socket: the per-user
 * lock (429 when held), the upstream-handshake failure (502 + lock release),
 * and the happy path (accept + lock + bidirectional pipe + teardown). The CF-
 * only 101 Response throws under undici, so the happy path asserts the
 * side-effects that ran before that final line.
 */
import { proxyGeminiLive } from '../gemini';
import type { Env } from '../index';

interface FakeSocket {
  accept: jest.Mock; send: jest.Mock; close: jest.Mock; addEventListener: jest.Mock;
  listeners: Record<string, Array<(e: unknown) => void>>;
}
function makeSocket(): FakeSocket {
  const listeners: Record<string, Array<(e: unknown) => void>> = {};
  return {
    listeners,
    accept: jest.fn(),
    send: jest.fn(),
    close: jest.fn(),
    addEventListener: jest.fn((type: string, cb: (e: unknown) => void) => { (listeners[type] ??= []).push(cb); }),
  };
}

function makeKv(seed: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(seed));
  const get = jest.fn((k: string) => Promise.resolve(store.get(k) ?? null));
  const put = jest.fn((k: string, v: string, _opts?: unknown) => { store.set(k, v); return Promise.resolve(); });
  const del = jest.fn((k: string) => { store.delete(k); return Promise.resolve(); });
  const kv = {
    get: ((k: string) => get(k)) as KVNamespace['get'],
    put: ((k: string, v: string, opts?: unknown) => put(k, v, opts)) as KVNamespace['put'],
    delete: ((k: string) => { del(k); return Promise.resolve(); }) as KVNamespace['delete'],
  } as Pick<KVNamespace, 'get' | 'put' | 'delete'> as KVNamespace;
  return { store, get, put, delete: del, kv };
}

const makeEnv = (kv: KVNamespace): Env => ({ RATE_LIMIT: kv, GEMINI_API_KEY: 'g' } as Partial<Env> as Env);
const req = (): Request => new Request('https://w.test/gemini-live', { method: 'GET', headers: { Upgrade: 'websocket' } });

let serverSocket: FakeSocket;
let clientSocket: FakeSocket;
let upstream: FakeSocket;
let fetchBehavior: 'ok' | 'reject' | 'nullws';
const realFetch = globalThis.fetch;
const g = globalThis as { WebSocketPair?: unknown };
const prevPair = g.WebSocketPair;

const fetchImpl = (): Promise<Response> => {
  if (fetchBehavior === 'reject') return Promise.reject(new Error('no upgrade'));
  const r = new Response(null, { status: 200 });
  (r as { webSocket?: unknown }).webSocket = fetchBehavior === 'nullws' ? null : upstream;
  return Promise.resolve(r);
};

beforeEach(() => {
  serverSocket = makeSocket(); clientSocket = makeSocket(); upstream = makeSocket();
  fetchBehavior = 'ok';
  g.WebSocketPair = function () { return { 0: clientSocket, 1: serverSocket }; };
  globalThis.fetch = fetchImpl as typeof globalThis.fetch;
});
afterEach(() => { g.WebSocketPair = prevPair; globalThis.fetch = realFetch; });

describe('proxyGeminiLive', () => {
  it('returns 429 when a voice session is already locked for the user', async () => {
    const kv = makeKv({ 'voice-lock:user-1': '1' });
    const res = await proxyGeminiLive(req(), makeEnv(kv.kv), 'user-1');
    expect(res.status).toBe(429);
    expect(kv.put).not.toHaveBeenCalled();
  });

  it('returns 502 and releases the lock when the upstream does not upgrade', async () => {
    const kv = makeKv();
    fetchBehavior = 'reject';
    const res = await proxyGeminiLive(req(), makeEnv(kv.kv), 'user-2');
    expect(res.status).toBe(502);
    expect(kv.delete).toHaveBeenCalledWith('voice-lock:user-2');
  });

  it('returns 502 when the upstream response carries no webSocket', async () => {
    const kv = makeKv();
    fetchBehavior = 'nullws';
    const res = await proxyGeminiLive(req(), makeEnv(kv.kv), 'user-3');
    expect(res.status).toBe(502);
    expect(kv.delete).toHaveBeenCalledWith('voice-lock:user-3');
  });

  it('accepts both sockets, sets the lock, pipes both ways, and tears down on close', async () => {
    const kv = makeKv();
    // The final `new Response(null, {status:101,...})` throws under undici; the
    // wiring we assert all ran before it.
    await proxyGeminiLive(req(), makeEnv(kv.kv), 'user-4').catch(() => undefined);

    expect(upstream.accept).toHaveBeenCalled();
    expect(serverSocket.accept).toHaveBeenCalled();
    expect(kv.put).toHaveBeenCalledWith('voice-lock:user-4', '1', { expirationTtl: 60 });

    // client → upstream
    serverSocket.listeners['message'][0]({ data: 'audio-chunk' });
    expect(upstream.send).toHaveBeenCalledWith('audio-chunk');
    // upstream → client
    upstream.listeners['message'][0]({ data: 'model-reply' });
    expect(serverSocket.send).toHaveBeenCalledWith('model-reply');

    // teardown closes both + frees the lock
    await serverSocket.listeners['close'][0]({});
    expect(upstream.close).toHaveBeenCalled();
    expect(serverSocket.close).toHaveBeenCalled();
    expect(kv.delete).toHaveBeenCalledWith('voice-lock:user-4');
  });
});
