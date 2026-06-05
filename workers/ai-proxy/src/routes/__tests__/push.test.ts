/**
 * Push-token registration. Covers method + token validation, the upsert
 * branches (existing token → update + invalid_at reset; new token → insert),
 * and the DB-failure 500. Supabase REST mocked at pgSelect/pgUpdate/pgInsert.
 */
import { handlePushRegister } from '../push';
import type { Env } from '../../index';

interface TokenRow { id: string; token: string; }

let existing: TokenRow[] = [];
let selectThrows = false;
const pgSelect = jest.fn(async (): Promise<unknown[]> => { if (selectThrows) throw new Error('db down'); return existing; });
const pgUpdate = jest.fn(async (): Promise<unknown[]> => []);
const pgInsert = jest.fn(async (): Promise<void> => undefined);
jest.mock('../../lib/supabase', () => ({
  pgSelect: (e: unknown, t: string, q: string) => pgSelect(e, t, q),
  pgUpdate: (e: unknown, t: string, q: string, p: unknown) => pgUpdate(e, t, q, p),
  pgInsert: (e: unknown, t: string, r: unknown) => pgInsert(e, t, r),
}));

const CORS: HeadersInit = { 'Access-Control-Allow-Origin': '*' };
const ENV = {} as Env;
const req = (method: string, body?: unknown): Request =>
  new Request('https://w.test/v1/push/register', {
    method,
    ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
  });

beforeEach(() => { existing = []; selectThrows = false; jest.clearAllMocks(); });

describe('handlePushRegister', () => {
  it('rejects a non-POST method (405)', async () => {
    const res = await handlePushRegister(req('GET'), ENV, CORS);
    expect(res.status).toBe(405);
  });

  it('rejects an unparseable body (400)', async () => {
    const res = await handlePushRegister(req('POST', 'not json'), ENV, CORS);
    expect(res.status).toBe(400);
  });

  it('rejects a missing or over-long token (400)', async () => {
    expect((await handlePushRegister(req('POST', { token: '' }), ENV, CORS)).status).toBe(400);
    expect((await handlePushRegister(req('POST', { token: 'x'.repeat(257) }), ENV, CORS)).status).toBe(400);
  });

  it('updates an existing token (resets invalid_at) without inserting', async () => {
    existing = [{ id: 'tok-1', token: 'ExponentPushToken[abc]' }];
    const res = await handlePushRegister(req('POST', { token: 'ExponentPushToken[abc]', platform: 'ios' }), ENV, CORS);
    expect(res.status).toBe(200);
    expect((await res.json() as { ok: boolean }).ok).toBe(true);
    expect(pgUpdate).toHaveBeenCalledWith(ENV, 'expo_push_tokens', 'id=eq.tok-1', expect.objectContaining({ invalid_at: null, platform: 'ios' }));
    expect(pgInsert).not.toHaveBeenCalled();
  });

  it('inserts a brand-new token', async () => {
    existing = [];
    const res = await handlePushRegister(req('POST', { token: 'ExponentPushToken[new]', platform: 'android', device_id: 'd9' }), ENV, CORS);
    expect(res.status).toBe(200);
    expect(pgInsert).toHaveBeenCalledWith(ENV, 'expo_push_tokens', expect.objectContaining({ token: 'ExponentPushToken[new]', platform: 'android', device_id: 'd9' }));
    expect(pgUpdate).not.toHaveBeenCalled();
  });

  it('returns 500 when the store throws', async () => {
    selectThrows = true;
    const warn = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await handlePushRegister(req('POST', { token: 'ExponentPushToken[x]' }), ENV, CORS);
    expect(res.status).toBe(500);
    warn.mockRestore();
  });
});
