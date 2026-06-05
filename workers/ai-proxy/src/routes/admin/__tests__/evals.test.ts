/**
 * Admin evals handler — reads over eval_reports. Covers the `latest` dedupe
 * (most recent per branch::mode), the per-branch history with limit clamp, the
 * missing-branch guard, and the 404. Supabase REST mocked at pgSelect.
 */
import { handleAdminEvals } from '../evals';
import type { AdminClaims } from '../../../lib/adminAuth';
import type { SupabaseEnv } from '../../../lib/supabase';

interface ReportRow { id: number; branch: string; mode: 'MOCK' | 'LIVE'; generated_at: string; }

let rows: ReportRow[] = [];
let lastQuery = '';
const pgSelect = jest.fn(async (_e: unknown, _t: string, query: string): Promise<unknown[]> => { lastQuery = query; return rows; });
jest.mock('../../../lib/supabase', () => ({ pgSelect: (e: unknown, t: string, q: string) => pgSelect(e, t, q) }));

const CORS: HeadersInit = { 'Access-Control-Allow-Origin': '*' };
const ENV = {} as SupabaseEnv;
const admin: AdminClaims = { email: 'owner@x.test', role: 'owner' };
const req = (path: string): Request => new Request('https://w.test' + path, { method: 'GET' });

beforeEach(() => { rows = []; lastQuery = ''; jest.clearAllMocks(); });

describe('handleAdminEvals', () => {
  it('latest keeps only the most recent report per (branch, mode)', async () => {
    rows = [
      { id: 4, branch: 'main', mode: 'LIVE', generated_at: '2026-06-04' },  // newest main/LIVE
      { id: 3, branch: 'main', mode: 'LIVE', generated_at: '2026-06-01' },  // dropped (dupe)
      { id: 2, branch: 'main', mode: 'MOCK', generated_at: '2026-06-03' },  // distinct mode
      { id: 1, branch: 'dev', mode: 'LIVE', generated_at: '2026-06-02' },   // distinct branch
    ];
    const b = (await (await handleAdminEvals(req('/v1/admin/evals/latest'), ENV, admin, CORS)).json()) as { latest: ReportRow[] };
    expect(b.latest.map((r) => r.id)).toEqual([4, 2, 1]);
  });

  it('branch history clamps the limit to [1,200] and filters by branch', async () => {
    rows = [{ id: 1, branch: 'lifeosv1', mode: 'LIVE', generated_at: '2026-06-04' }];
    const res = await handleAdminEvals(req('/v1/admin/evals/branch/lifeosv1?limit=999'), ENV, admin, CORS);
    expect(res.status).toBe(200);
    expect(lastQuery).toContain('limit=200');
    expect(lastQuery).toContain('branch=eq.lifeosv1');
  });

  it('returns 400 when the branch segment is missing', async () => {
    const res = await handleAdminEvals(req('/v1/admin/evals/branch'), ENV, admin, CORS);
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown sub-route', async () => {
    const res = await handleAdminEvals(req('/v1/admin/evals/bogus'), ENV, admin, CORS);
    expect(res.status).toBe(404);
  });
});
