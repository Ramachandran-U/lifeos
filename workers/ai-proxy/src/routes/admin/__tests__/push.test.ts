/**
 * Admin push handler — device-token stats + Expo broadcast. Covers the
 * platform stats rollup, the support-role send block, body validation
 * (required / title-len / body-len), the empty-token short-circuit, a real
 * batched send (sent/failed/invalid accounting + DeviceNotRegistered cleanup +
 * audit), and the Expo-fetch failure path. Supabase REST + global fetch mocked.
 */
import { handleAdminPush } from '../push';
import type { AdminClaims } from '../../../lib/adminAuth';
import type { SupabaseEnv } from '../../../lib/supabase';

interface TokenRow { id: string; token: string; platform: string | null; }
interface ExpoTicket { status: 'ok' | 'error'; details?: { error?: string }; }

let tokenRows: TokenRow[] = [];
const pgSelect = jest.fn(async (): Promise<unknown[]> => tokenRows);
const pgUpdate = jest.fn(async (): Promise<unknown[]> => []);
const pgInsert = jest.fn(async (): Promise<void> => undefined);
jest.mock('../../../lib/supabase', () => ({
  pgSelect: (e: unknown, t: string, q: string) => pgSelect(e, t, q),
  pgUpdate: (e: unknown, t: string, q: string, p: unknown) => pgUpdate(e, t, q, p),
  pgInsert: (e: unknown, t: string, r: unknown) => pgInsert(e, t, r),
}));

// Expo push API is the one outbound fetch this handler makes.
let expoTickets: ExpoTicket[] = [];
let expoShouldThrow = false;
const realFetch = globalThis.fetch;
const fetchImpl = (): Promise<Response> =>
  expoShouldThrow ? Promise.reject(new Error('network down')) : Promise.resolve(new Response(JSON.stringify({ data: expoTickets })));

const CORS: HeadersInit = { 'Access-Control-Allow-Origin': '*' };
const ENV = {} as SupabaseEnv;
const owner: AdminClaims = { email: 'owner@x.test', role: 'owner' };
const support: AdminClaims = { email: 'support@x.test', role: 'support' };
const req = (method: string, path: string, body?: unknown): Request =>
  new Request('https://w.test' + path, { method, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const body = async <T>(r: Response): Promise<T> => (await r.json()) as T;

beforeEach(() => {
  tokenRows = []; expoTickets = []; expoShouldThrow = false; jest.clearAllMocks();
  globalThis.fetch = fetchImpl as typeof globalThis.fetch;
});
afterEach(() => { globalThis.fetch = realFetch; });

describe('handleAdminPush', () => {
  it('GET stats counts active tokens by platform', async () => {
    tokenRows = [
      { id: '1', token: 't1', platform: 'ios' }, { id: '2', token: 't2', platform: 'ios' },
      { id: '3', token: 't3', platform: 'android' }, { id: '4', token: 't4', platform: null },
    ];
    const b = await body<{ total: number; by_platform: Record<string, number> }>(
      await handleAdminPush(req('GET', '/v1/admin/push/stats'), ENV, owner, CORS));
    expect(b.total).toBe(4);
    expect(b.by_platform).toMatchObject({ ios: 2, android: 1, unknown: 1 });
  });

  it('POST broadcast is forbidden for support (403) — no send', async () => {
    const res = await handleAdminPush(req('POST', '/v1/admin/push/broadcast', { body: 'hi' }), ENV, support, CORS);
    expect(res.status).toBe(403);
  });

  it('POST broadcast requires a non-empty body (400)', async () => {
    const res = await handleAdminPush(req('POST', '/v1/admin/push/broadcast', { body: '   ' }), ENV, owner, CORS);
    expect(res.status).toBe(400);
  });

  it('POST broadcast rejects an over-long title or body (400)', async () => {
    const longTitle = await handleAdminPush(req('POST', '/v1/admin/push/broadcast', { title: 'x'.repeat(201), body: 'hi' }), ENV, owner, CORS);
    expect(longTitle.status).toBe(400);
    const longBody = await handleAdminPush(req('POST', '/v1/admin/push/broadcast', { body: 'x'.repeat(1001) }), ENV, owner, CORS);
    expect(longBody.status).toBe(400);
  });

  it('POST broadcast short-circuits when there are no active tokens', async () => {
    tokenRows = [];
    const b = await body<{ sent: number; message: string }>(
      await handleAdminPush(req('POST', '/v1/admin/push/broadcast', { body: 'hi' }), ENV, owner, CORS));
    expect(b).toMatchObject({ sent: 0, message: 'no active tokens' });
  });

  it('POST broadcast sends, counts tickets, marks DeviceNotRegistered invalid, and audits', async () => {
    tokenRows = [{ id: 'a', token: 't1', platform: 'ios' }, { id: 'b', token: 't2', platform: 'ios' }];
    expoTickets = [{ status: 'ok' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }];
    const b = await body<{ sent: number; failed: number; invalid: number }>(
      await handleAdminPush(req('POST', '/v1/admin/push/broadcast', { title: 'Hi', body: 'hello' }), ENV, owner, CORS));
    expect(b).toEqual({ sent: 1, failed: 1, invalid: 1 });
    expect(pgUpdate).toHaveBeenCalledWith(ENV, 'expo_push_tokens', 'id=eq.b', expect.objectContaining({ invalid_at: expect.any(String) }));
    expect(pgInsert).toHaveBeenCalledWith(ENV, 'audit_log', expect.objectContaining({ action: 'push_broadcast' }));
  });

  it('POST broadcast counts the whole batch as failed when Expo errors', async () => {
    tokenRows = [{ id: 'a', token: 't1', platform: 'ios' }, { id: 'b', token: 't2', platform: 'ios' }];
    expoShouldThrow = true;
    const warn = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const b = await body<{ sent: number; failed: number; invalid: number }>(
      await handleAdminPush(req('POST', '/v1/admin/push/broadcast', { body: 'hello' }), ENV, owner, CORS));
    expect(b).toEqual({ sent: 0, failed: 2, invalid: 0 });
    warn.mockRestore();
  });

  it('returns 404 for an unknown sub-route', async () => {
    const res = await handleAdminPush(req('GET', '/v1/admin/push/bogus'), ENV, owner, CORS);
    expect(res.status).toBe(404);
  });
});
