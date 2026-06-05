/**
 * Admin feedback triage handler. Covers the GET list (status filter + limit
 * clamp), and the PATCH path: invalid-body 400, invalid-status 400, not-found
 * 404, the owner update (status + notes + assigned_to) with its audit write,
 * and the support-role restriction (cannot set assigned_to). Supabase REST
 * mocked at pgSelect/pgUpdate; writeAudit runs for real onto the mocked pgInsert.
 */
import { handleAdminFeedback } from '../feedback';
import type { AdminClaims } from '../../../lib/adminAuth';
import type { SupabaseEnv } from '../../../lib/supabase';

interface FeedbackRow { id: number; status: string; assigned_to: string | null; notes: string | null; }

let listRows: FeedbackRow[] = [];
let beforeRows: FeedbackRow[] = [];
let afterRows: FeedbackRow[] = [];
let lastListQuery = '';
let lastPatch: Record<string, unknown> = {};
const pgSelect = jest.fn(async (_e: unknown, _t: string, query: string): Promise<unknown[]> => {
  if (query.includes('id=eq.')) return beforeRows;
  lastListQuery = query;
  return listRows;
});
const pgUpdate = jest.fn(async (_e: unknown, _t: string, _q: string, patch: Record<string, unknown>): Promise<unknown[]> => { lastPatch = patch; return afterRows; });
const pgInsert = jest.fn(async (): Promise<void> => undefined);
jest.mock('../../../lib/supabase', () => ({
  pgSelect: (e: unknown, t: string, q: string) => pgSelect(e, t, q),
  pgUpdate: (e: unknown, t: string, q: string, p: Record<string, unknown>) => pgUpdate(e, t, q, p),
  pgInsert: (e: unknown, t: string, r: unknown) => pgInsert(e, t, r),
}));

const CORS: HeadersInit = { 'Access-Control-Allow-Origin': '*' };
const ENV = {} as SupabaseEnv;
const owner: AdminClaims = { email: 'owner@x.test', role: 'owner' };
const support: AdminClaims = { email: 'support@x.test', role: 'support' };
const req = (method: string, path: string, body?: unknown): Request =>
  new Request('https://w.test' + path, { method, ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) });

beforeEach(() => { listRows = []; beforeRows = []; afterRows = []; lastListQuery = ''; lastPatch = {}; jest.clearAllMocks(); });

describe('handleAdminFeedback', () => {
  it('GET lists feedback and applies a valid status filter + limit clamp', async () => {
    listRows = [{ id: 1, status: 'new', assigned_to: null, notes: null }];
    const res = await handleAdminFeedback(req('GET', '/v1/admin/feedback?status=triaged&limit=9999'), ENV, owner, CORS);
    expect(res.status).toBe(200);
    expect(lastListQuery).toContain('limit=500');
    expect(lastListQuery).toContain('status=eq.triaged');
  });

  it('GET ignores an invalid status value (no filter applied)', async () => {
    await handleAdminFeedback(req('GET', '/v1/admin/feedback?status=bogus'), ENV, owner, CORS);
    expect(lastListQuery).not.toContain('status=eq.');
  });

  it('PATCH rejects an unparseable body (400)', async () => {
    const res = await handleAdminFeedback(req('PATCH', '/v1/admin/feedback/5', 'not json'), ENV, owner, CORS);
    expect(res.status).toBe(400);
  });

  it('PATCH rejects an invalid status (400)', async () => {
    const res = await handleAdminFeedback(req('PATCH', '/v1/admin/feedback/5', { status: 'bogus' }), ENV, owner, CORS);
    expect(res.status).toBe(400);
    expect(pgUpdate).not.toHaveBeenCalled();
  });

  it('PATCH returns 404 when the row does not exist', async () => {
    beforeRows = [];
    const res = await handleAdminFeedback(req('PATCH', '/v1/admin/feedback/5', { status: 'closed' }), ENV, owner, CORS);
    expect(res.status).toBe(404);
    expect(pgUpdate).not.toHaveBeenCalled();
  });

  it('PATCH (owner) updates status/notes/assigned_to and writes an audit row', async () => {
    beforeRows = [{ id: 5, status: 'new', assigned_to: null, notes: null }];
    afterRows = [{ id: 5, status: 'closed', assigned_to: 'eng@x.test', notes: 'fixed' }];
    const res = await handleAdminFeedback(req('PATCH', '/v1/admin/feedback/5', { status: 'closed', notes: 'fixed', assigned_to: 'eng@x.test' }), ENV, owner, CORS);
    expect(res.status).toBe(200);
    expect(lastPatch).toMatchObject({ status: 'closed', notes: 'fixed', assigned_to: 'eng@x.test' });
    expect(pgInsert).toHaveBeenCalledWith(ENV, 'audit_log', expect.objectContaining({ action: 'patch_feedback', target_type: 'feedback' }));
  });

  it('PATCH (support) cannot set assigned_to', async () => {
    beforeRows = [{ id: 5, status: 'new', assigned_to: null, notes: null }];
    afterRows = [{ id: 5, status: 'triaged', assigned_to: null, notes: null }];
    await handleAdminFeedback(req('PATCH', '/v1/admin/feedback/5', { status: 'triaged', assigned_to: 'eng@x.test' }), ENV, support, CORS);
    expect(lastPatch.status).toBe('triaged');
    expect(lastPatch).not.toHaveProperty('assigned_to');
  });
});
