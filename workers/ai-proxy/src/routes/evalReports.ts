/**
 * Eval report ingest endpoint — called by the GitHub Action at the end of
 * an evals run. Authenticated via a shared bearer token (NOT a Supabase
 * JWT — CI has no human session). The token is configured as the
 * `EVAL_REPORTER_TOKEN` Wrangler secret.
 *
 * POST /v1/evals/report
 *   body: {
 *     branch: string,
 *     commit_sha: string,
 *     mode: 'MOCK' | 'LIVE',
 *     suites: Array<{name, passRate, threshold, status, cases: number}>,
 *     workflow_url?: string,
 *   }
 *   header: `Authorization: Bearer <EVAL_REPORTER_TOKEN>`
 *
 * Upsert semantics on (branch, commit_sha, mode): re-running CI for the
 * same commit overwrites the previous row instead of accumulating.
 */

import type { Env } from '../index';
import { pgSelect, pgUpdate, pgInsert } from '../lib/supabase';

interface ReportBody {
  branch?: string;
  commit_sha?: string;
  mode?: 'MOCK' | 'LIVE';
  suites?: Array<{ name: string; passRate: number; threshold: number; status: 'pass' | 'fail'; cases: number }>;
  workflow_url?: string;
}

interface ExistingRow {
  id: number;
}

export async function handleEvalReport(
  req: Request,
  env: Env,
  cors: HeadersInit,
): Promise<Response> {
  if (req.method !== 'POST') return resp({ error: 'method not allowed' }, 405, cors);

  const expected = env.EVAL_REPORTER_TOKEN;
  if (!expected) return resp({ error: 'eval reporter not configured' }, 500, cors);

  const auth = req.headers.get('Authorization') ?? '';
  const match = auth.match(/^Bearer\s+(.+)$/);
  if (!match || match[1] !== expected) return resp({ error: 'unauthorized' }, 401, cors);

  let body: ReportBody;
  try {
    body = (await req.json()) as ReportBody;
  } catch {
    return resp({ error: 'invalid JSON' }, 400, cors);
  }

  if (!body.branch || !body.commit_sha || !body.mode || !Array.isArray(body.suites)) {
    return resp({ error: 'missing required fields' }, 400, cors);
  }
  if (body.mode !== 'MOCK' && body.mode !== 'LIVE') {
    return resp({ error: 'mode must be MOCK or LIVE' }, 400, cors);
  }

  const totalCases = body.suites.reduce((n, s) => n + (s.cases ?? 0), 0);
  const passedCases = body.suites.reduce(
    (n, s) => n + Math.round((s.passRate ?? 0) * (s.cases ?? 0)),
    0,
  );

  // Upsert by (branch, commit_sha, mode).
  const existing = await pgSelect<ExistingRow>(
    env,
    'eval_reports',
    `branch=eq.${encodeURIComponent(body.branch)}&commit_sha=eq.${encodeURIComponent(body.commit_sha)}&mode=eq.${encodeURIComponent(body.mode)}&select=id&limit=1`,
  );

  const payload = {
    branch: body.branch,
    commit_sha: body.commit_sha,
    mode: body.mode,
    suites: body.suites,
    workflow_url: body.workflow_url ?? null,
    total_cases: totalCases,
    passed_cases: passedCases,
    generated_at: new Date().toISOString(),
  };

  try {
    if (existing.length > 0) {
      await pgUpdate(env, 'eval_reports', `id=eq.${existing[0].id}`, payload);
    } else {
      await pgInsert(env, 'eval_reports', payload);
    }
  } catch (e) {
    console.error('eval report upsert failed:', e);
    return resp({ error: 'upsert failed' }, 500, cors);
  }

  return resp({ ok: true, total: totalCases, passed: passedCases }, 200, cors);
}

function resp(body: unknown, status: number, cors: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}
