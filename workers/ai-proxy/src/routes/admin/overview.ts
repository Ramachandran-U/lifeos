/**
 * Admin operator dashboard — single aggregation endpoint that powers the
 * landing page. Every card on the dashboard reads from this one response so
 * one page-load = one network round-trip.
 *
 * GET /v1/admin/overview?days=7
 *
 * Aggregates over `telemetry_events`, `feedback`, `eval_reports`:
 *   - users.dau / wau          (distinct device_ids)
 *   - funnel                   (v2 activation, 7-day window)
 *   - engagement               (blocks/day, evening_reflect adoption)
 *   - ai                       (call volume, schema-failure rate, est. ₹ cost)
 *   - feedback.new_count       (open inbox)
 *
 * Cost figure uses hardcoded Gemini per-Mtok prices below. These drift —
 * update GEMINI_PRICE_INR when Google ships new SKUs.
 */

import { pgSelect, type SupabaseEnv } from '../../lib/supabase';
import { type AdminClaims } from '../../lib/adminAuth';

interface TelemetryRow {
  device_id: string;
  event: string;
  props: Record<string, unknown>;
  ts: string;
}

interface FeedbackCountRow { id: number }

interface EvalRow {
  branch: string;
  commit_sha: string;
  generated_at: string;
  mode: 'MOCK' | 'LIVE';
  total_cases: number;
  passed_cases: number;
}

// Gemini pricing, ₹ per million tokens (input / output). USD prices from
// ai.google.dev/gemini-api/docs/pricing; INR conversion at ₹96.10/USD as of
// 2026-05-29. Refresh both when Google reprices or the rupee swings >5%.
//
//   2.5 Flash:      $0.30 in / $2.50 out  →  ₹28.83 / ₹240.25
//   2.5 Flash-Lite: $0.10 in / $0.40 out  →  ₹9.61  / ₹38.44
//   3.5 Flash:      $1.50 in / $9.00 out  →  ₹144.15 / ₹864.90
const GEMINI_PRICE_INR: Record<string, { in: number; out: number }> = {
  'gemini-2.5-flash-lite':  { in:   9.61, out:  38.44 },
  'gemini-2.5-flash':       { in:  28.83, out: 240.25 },
  'gemini-3.5-flash':       { in: 144.15, out: 864.90 },
  'gemini-flash-latest':    { in: 144.15, out: 864.90 },  // aliases to 3.5 currently
};
const FALLBACK_PRICE = { in: 144.15, out: 864.90 };

// Funnel definition mirrors the v2 stages in admin/telemetry — keep in sync.
const FUNNEL_V2 = [
  { key: 'v2_started',        label: 'Started',            events: ['onboarding_v2_started'] },
  { key: 'v2_slot_filled',    label: 'First slot filled',  events: ['slot_filled'] },
  { key: 'v2_chat_completed', label: 'Discovery done',     events: ['discovery_chat_completed'] },
  { key: 'v2_routine',        label: 'Routine generated',  events: ['routine_generated'] },
  { key: 'v2_first_block',    label: 'First block done',   events: ['first_block_completed'] },
] as const;

export async function handleAdminOverview(
  req: Request,
  env: SupabaseEnv,
  _admin: AdminClaims,
  cors: HeadersInit,
): Promise<Response> {
  const url = new URL(req.url);
  const days = clampInt(url.searchParams.get('days'), 1, 30, 7);
  const now = Date.now();
  const since7 = new Date(now - days * 86_400_000).toISOString();
  const since1 = new Date(now - 86_400_000).toISOString();
  const yesterdayStart = new Date(now - 2 * 86_400_000).toISOString();

  // One window covers everything; we slice client-side in the Worker.
  const [events, feedbackNew, latestEval] = await Promise.all([
    pgSelect<TelemetryRow>(
      env,
      'telemetry_events',
      `ts=gte.${encodeURIComponent(since7)}&select=device_id,event,props,ts&limit=50000`,
    ),
    pgSelect<FeedbackCountRow>(
      env,
      'feedback',
      `select=id&status=eq.new&limit=1000`,
    ),
    pgSelect<EvalRow>(
      env,
      'eval_reports',
      `select=branch,commit_sha,generated_at,mode,total_cases,passed_cases&order=generated_at.desc&limit=20`,
    ),
  ]);

  // ── users: distinct device_ids in 1d / 7d windows ─────────────────────
  const dau = new Set<string>();
  const wau = new Set<string>();
  for (const e of events) {
    wau.add(e.device_id);
    if (e.ts >= since1) dau.add(e.device_id);
  }

  // ── funnel: stage-wise distinct devices over the window ───────────────
  const stageSets = FUNNEL_V2.map(() => new Set<string>());
  for (const e of events) {
    for (let i = 0; i < FUNNEL_V2.length; i++) {
      if (FUNNEL_V2[i].events.includes(e.event as never)) stageSets[i].add(e.device_id);
    }
  }
  const top = stageSets[0].size;
  const stages = FUNNEL_V2.map((s, i) => ({
    key: s.key,
    label: s.label,
    devices: stageSets[i].size,
    conversion_from_top: top > 0 ? stageSets[i].size / top : 0,
  }));

  // ── engagement ────────────────────────────────────────────────────────
  let blocksYesterday = 0;
  let blocks7d = 0;
  const reflectDevices = new Set<string>();
  for (const e of events) {
    if (e.event === 'routine_block_completed') {
      blocks7d += 1;
      if (e.ts >= yesterdayStart && e.ts < since1) blocksYesterday += 1;
    }
    if (e.event === 'evening_reflect_completed') reflectDevices.add(e.device_id);
  }
  const eveningReflectRate7d = wau.size > 0 ? reflectDevices.size / wau.size : 0;

  // ── AI: call count, schema failures, est. cost ────────────────────────
  let aiCalls7d = 0;
  let aiSchemaFailures7d = 0;
  let costInr7d = 0;
  for (const e of events) {
    if (e.event === 'ai_call') {
      aiCalls7d += 1;
      const model = String(e.props.model ?? 'unknown');
      const inTok = Number(e.props.input_tokens ?? 0) || 0;
      const outTok = Number(e.props.output_tokens ?? 0) || 0;
      const price = pickPrice(model);
      costInr7d += (inTok * price.in + outTok * price.out) / 1_000_000;
    } else if (e.event === 'ai_schema_failure') {
      aiSchemaFailures7d += 1;
    }
  }
  const schemaFailureRate = aiCalls7d > 0 ? aiSchemaFailures7d / aiCalls7d : 0;

  // Latest LIVE eval (preferred) or MOCK fallback.
  const live = latestEval.find((r) => r.mode === 'LIVE') ?? latestEval[0] ?? null;
  const latestEvalSummary = live
    ? {
        branch: live.branch,
        commit_sha: live.commit_sha.slice(0, 7),
        mode: live.mode,
        pass_rate: live.total_cases > 0 ? live.passed_cases / live.total_cases : 0,
        generated_at: live.generated_at,
      }
    : null;

  return json({
    generated_at: new Date(now).toISOString(),
    window_days: days,
    users: { dau: dau.size, wau: wau.size },
    funnel: { stages, top_devices: top },
    engagement: {
      blocks_completed_yesterday: blocksYesterday,
      blocks_completed_7d: blocks7d,
      evening_reflect_rate_7d: eveningReflectRate7d,
    },
    ai: {
      calls_7d: aiCalls7d,
      schema_failures_7d: aiSchemaFailures7d,
      schema_failure_rate_7d: schemaFailureRate,
      est_cost_inr_7d: Math.round(costInr7d * 100) / 100,
      latest_eval: latestEvalSummary,
    },
    feedback: { new_count: feedbackNew.length },
    sample_size: events.length,
  }, cors);
}

function pickPrice(model: string) {
  // Match longest prefix; falls back if unknown.
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
