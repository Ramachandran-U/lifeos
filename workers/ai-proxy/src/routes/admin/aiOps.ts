/**
 * Admin AI operations — per-task aggregation that combines call volume,
 * token spend, schema-failure rate, and cost in one view. Replaces having
 * to mentally join three separate tabs (telemetry, schema-failures, evals)
 * to know "is the AI healthy and which function is the weakest link".
 *
 * GET /v1/admin/ai-ops?days=7
 *   →  per-task stats sorted by failure rate desc, plus the latest 3
 *      eval reports for context.
 *
 * GET /v1/admin/ai-ops/failures?task=NAME&days=7
 *   →  drill-down: recent schema-failure samples for a specific task.
 */

import { pgSelect, type SupabaseEnv } from '../../lib/supabase';
import { type AdminClaims } from '../../lib/adminAuth';

interface EventRow {
  device_id: string;
  event: string;
  props: Record<string, unknown>;
  ts: string;
  app_version: string | null;
  platform: string | null;
}

interface EvalRow {
  branch: string;
  commit_sha: string;
  generated_at: string;
  mode: 'MOCK' | 'LIVE';
  total_cases: number;
  passed_cases: number;
  suites: Array<{ name: string; passRate: number; status: string; cases: number }>;
}

// Mirror of overview.ts pricing. Refresh both files together.
const GEMINI_PRICE_INR: Record<string, { in: number; out: number }> = {
  'gemini-2.5-flash-lite':  { in:   9.61, out:  38.44 },
  'gemini-2.5-flash':       { in:  28.83, out: 240.25 },
  'gemini-3.5-flash':       { in: 144.15, out: 864.90 },
  'gemini-flash-latest':    { in: 144.15, out: 864.90 },
};
const FALLBACK_PRICE = { in: 144.15, out: 864.90 };

export async function handleAdminAiOps(
  req: Request,
  env: SupabaseEnv,
  _admin: AdminClaims,
  cors: HeadersInit,
): Promise<Response> {
  const url = new URL(req.url);
  const segments = url.pathname.split('/').filter(Boolean); // [v1, admin, ai-ops, maybe 'failures']
  const action = segments[3] ?? '';
  const days = clampInt(url.searchParams.get('days'), 1, 30, 7);
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  if (req.method === 'GET' && action === '') {
    const [callRows, failureRows, latestEvals] = await Promise.all([
      pgSelect<EventRow>(
        env,
        'telemetry_events',
        `event=eq.ai_call&ts=gte.${encodeURIComponent(since)}&select=props,ts&limit=50000`,
      ),
      pgSelect<EventRow>(
        env,
        'telemetry_events',
        `event=eq.ai_schema_failure&ts=gte.${encodeURIComponent(since)}&select=props,ts&limit=10000`,
      ),
      pgSelect<EvalRow>(
        env,
        'eval_reports',
        `select=branch,commit_sha,generated_at,mode,total_cases,passed_cases,suites&order=generated_at.desc&limit=10`,
      ),
    ]);

    interface TaskBucket {
      task: string;
      calls: number;
      failures: number;
      input_tokens: number;
      output_tokens: number;
      cost_inr: number;
      models: Set<string>;
    }
    const buckets = new Map<string, TaskBucket>();
    const ensure = (task: string): TaskBucket => {
      let b = buckets.get(task);
      if (!b) {
        b = { task, calls: 0, failures: 0, input_tokens: 0, output_tokens: 0, cost_inr: 0, models: new Set() };
        buckets.set(task, b);
      }
      return b;
    };

    for (const r of callRows) {
      const task = String(r.props.task ?? 'unknown');
      const b = ensure(task);
      const model = String(r.props.model ?? 'unknown');
      const inTok = Number(r.props.input_tokens ?? 0) || 0;
      const outTok = Number(r.props.output_tokens ?? 0) || 0;
      const price = pickPrice(model);
      b.calls += 1;
      b.input_tokens += inTok;
      b.output_tokens += outTok;
      b.cost_inr += (inTok * price.in + outTok * price.out) / 1_000_000;
      b.models.add(model);
    }
    for (const r of failureRows) {
      const task = String(r.props.task ?? 'unknown');
      ensure(task).failures += 1;
    }

    const tasks = Array.from(buckets.values())
      .map((b) => ({
        task: b.task,
        calls: b.calls,
        failures: b.failures,
        failure_rate: b.calls > 0 ? b.failures / b.calls : 0,
        avg_input_tokens: b.calls > 0 ? Math.round(b.input_tokens / b.calls) : 0,
        avg_output_tokens: b.calls > 0 ? Math.round(b.output_tokens / b.calls) : 0,
        est_cost_inr: Math.round(b.cost_inr * 100) / 100,
        models: Array.from(b.models),
      }))
      .sort((a, b) => b.failure_rate - a.failure_rate || b.calls - a.calls);

    const evals = latestEvals.map((e) => ({
      branch: e.branch,
      commit_sha: e.commit_sha.slice(0, 7),
      generated_at: e.generated_at,
      mode: e.mode,
      pass_rate: e.total_cases > 0 ? e.passed_cases / e.total_cases : 0,
      total_cases: e.total_cases,
      passed_cases: e.passed_cases,
      weakest_suite:
        e.suites && e.suites.length > 0
          ? e.suites.slice().sort((a, b) => a.passRate - b.passRate)[0]
          : null,
    }));

    return json({
      window_days: days,
      tasks,
      evals,
      totals: {
        calls: callRows.length,
        failures: failureRows.length,
        failure_rate: callRows.length > 0 ? failureRows.length / callRows.length : 0,
        cost_inr: Math.round(tasks.reduce((s, t) => s + t.est_cost_inr, 0) * 100) / 100,
      },
    }, cors);
  }

  if (req.method === 'GET' && action === 'failures') {
    const task = url.searchParams.get('task');
    if (!task) return json({ error: 'task param required' }, cors, 400);
    const rows = await pgSelect<EventRow>(
      env,
      'telemetry_events',
      `event=eq.ai_schema_failure&ts=gte.${encodeURIComponent(since)}&order=ts.desc&limit=200&select=props,ts,app_version,platform`,
    );
    const samples = rows
      .filter((r) => String(r.props.task ?? '') === task)
      .slice(0, 25)
      .map((r) => ({
        ts: r.ts,
        error: String(r.props.error ?? ''),
        raw_preview: String(r.props.raw_preview ?? ''),
        schema: String(r.props.schema ?? ''),
        app_version: r.app_version,
        platform: r.platform,
      }));
    return json({ task, days, samples }, cors);
  }

  return json({ error: 'ai-ops route not found' }, cors, 404);
}

function pickPrice(model: string) {
  const m = model.toLowerCase();
  for (const key of Object.keys(GEMINI_PRICE_INR)) {
    if (m.startsWith(key)) return GEMINI_PRICE_INR[key];
  }
  return FALLBACK_PRICE;
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
