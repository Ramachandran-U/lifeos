/**
 * Admin reads on eval_reports.
 *
 * Routes:
 *   GET /v1/admin/evals/latest                  → latest run per (branch, mode)
 *   GET /v1/admin/evals/branch/:branch?limit=N  → history for a branch
 */

import { pgSelect, type SupabaseEnv } from '../../lib/supabase';
import { type AdminClaims } from '../../lib/adminAuth';

interface ReportRow {
  id: number;
  branch: string;
  commit_sha: string;
  generated_at: string;
  mode: 'MOCK' | 'LIVE';
  suites: Array<{ name: string; passRate: number; threshold: number; status: string; cases: number }>;
  workflow_url: string | null;
  total_cases: number;
  passed_cases: number;
}

export async function handleAdminEvals(
  req: Request,
  env: SupabaseEnv,
  _admin: AdminClaims,
  cors: HeadersInit,
): Promise<Response> {
  const url = new URL(req.url);
  const segments = url.pathname.split('/').filter(Boolean); // [v1, admin, evals, ...]
  const action = segments[3] ?? '';

  if (req.method === 'GET' && action === 'latest') {
    // Fetch a window of recent reports and pick the most recent per
    // (branch, mode) on the server side. Postgres-side DISTINCT ON would
    // be cleaner; doing it here keeps the helper minimal.
    const rows = await pgSelect<ReportRow>(
      env,
      'eval_reports',
      'select=*&order=generated_at.desc&limit=100',
    );
    const seen = new Set<string>();
    const latest: ReportRow[] = [];
    for (const r of rows) {
      const key = `${r.branch}::${r.mode}`;
      if (seen.has(key)) continue;
      seen.add(key);
      latest.push(r);
    }
    return json({ latest }, cors);
  }

  if (req.method === 'GET' && action === 'branch') {
    const branch = segments[4];
    if (!branch) return json({ error: 'branch required' }, cors, 400);
    const limit = clampInt(url.searchParams.get('limit'), 1, 200, 50);
    const rows = await pgSelect<ReportRow>(
      env,
      'eval_reports',
      `branch=eq.${encodeURIComponent(branch)}&select=*&order=generated_at.desc&limit=${limit}`,
    );
    return json({ reports: rows }, cors);
  }

  return json({ error: 'evals route not found' }, cors, 404);
}

function clampInt(raw: string | null, min: number, max: number, fallback: number): number {
  const n = raw === null ? NaN : Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function json(body: unknown, cors: HeadersInit, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}
