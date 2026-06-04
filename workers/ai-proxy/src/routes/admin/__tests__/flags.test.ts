/**
 * Admin flags handler — the feature-flag kill-switch surface. The /v1/admin/
 * gate (requireAdmin) is covered in index.router.test.ts; this covers the
 * HANDLER's own logic: role-based authz, validation, and the audit write.
 * Supabase REST is mocked at pgSelect/pgUpdate/pgInsert.
 */
import { handleAdminFlags } from '../flags';
import type { AdminClaims } from '../../../lib/adminAuth';
import type { SupabaseEnv } from '../../../lib/supabase';

interface FlagRow { key: string; status?: 'active' | 'killed'; }

let flagRows: FlagRow[] = [];
let updateResult: FlagRow[] = [];
const pgSelect = jest.fn(async (_e: unknown, _t: string, _q: string): Promise<unknown[]> => flagRows);
const pgUpdate = jest.fn(async (_e: unknown, _t: string, _q: string, _patch: unknown): Promise<unknown[]> => updateResult);
const pgInsert = jest.fn(async (_e: unknown, _t: string, _row: unknown): Promise<void> => undefined);

jest.mock('../../../lib/supabase', () => ({
  pgSelect: (e: unknown, t: string, q: string) => pgSelect(e, t, q),
  pgUpdate: (e: unknown, t: string, q: string, p: unknown) => pgUpdate(e, t, q, p),
  pgInsert: (e: unknown, t: string, r: unknown) => pgInsert(e, t, r),
}));

const CORS: HeadersInit = { 'Access-Control-Allow-Origin': '*' };
const ENV = {} as SupabaseEnv;
const owner: AdminClaims = { email: 'owner@x.test', role: 'owner' };
const support: AdminClaims = { email: 'support@x.test', role: 'support' };
const req = (method: string, path = '/v1/admin/flags', body?: unknown): Request =>
  new Request('https://w.test' + path, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

beforeEach(() => { flagRows = []; updateResult = []; jest.clearAllMocks(); });

describe('handleAdminFlags', () => {
  it('GET returns the flag list', async () => {
    flagRows = [{ key: 'a' }, { key: 'b' }];
    const res = await handleAdminFlags(req('GET'), ENV, owner, CORS);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { flags: FlagRow[] }).flags).toHaveLength(2);
  });

  it('PATCH is forbidden for the support role (403) — no write attempted', async () => {
    const res = await handleAdminFlags(req('PATCH', '/v1/admin/flags/myflag', { status: 'killed' }), ENV, support, CORS);
    expect(res.status).toBe(403);
    expect(pgUpdate).not.toHaveBeenCalled();
  });

  it('PATCH returns 404 when the flag does not exist', async () => {
    flagRows = []; // before-select is empty
    const res = await handleAdminFlags(req('PATCH', '/v1/admin/flags/missing', { status: 'killed' }), ENV, owner, CORS);
    expect(res.status).toBe(404);
    expect(pgUpdate).not.toHaveBeenCalled();
  });

  it('PATCH returns 400 on an unparseable body', async () => {
    const res = await handleAdminFlags(
      new Request('https://w.test/v1/admin/flags/x', { method: 'PATCH', body: 'not json' }),
      ENV, owner, CORS,
    );
    expect(res.status).toBe(400);
  });

  it('PATCH updates the flag and writes an audit row', async () => {
    flagRows = [{ key: 'k', status: 'active' }];
    updateResult = [{ key: 'k', status: 'killed' }];
    const res = await handleAdminFlags(req('PATCH', '/v1/admin/flags/k', { status: 'killed' }), ENV, owner, CORS);
    expect(res.status).toBe(200);
    expect(pgUpdate).toHaveBeenCalledTimes(1);
    expect(pgInsert).toHaveBeenCalledWith(
      ENV, 'audit_log',
      expect.objectContaining({ action: 'flag.update', target_type: 'flag', target_id: 'k', actor_email: owner.email }),
    );
  });

  it('rejects an unsupported method (405)', async () => {
    const res = await handleAdminFlags(req('DELETE'), ENV, owner, CORS);
    expect(res.status).toBe(405);
  });
});
