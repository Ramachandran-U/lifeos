/**
 * Admin telemetry queries. Read-only over the `telemetry_events` table.
 *
 * Endpoints:
 *   GET /v1/admin/telemetry/funnel?days=7
 *      Onboarding funnel: distinct devices at each stage in the trailing window.
 *
 *   GET /v1/admin/telemetry/recent?limit=100
 *      Last N events for raw inspection / debugging.
 */

import { pgSelect, type SupabaseEnv } from '../../lib/supabase';
import { type AdminClaims } from '../../lib/adminAuth';

interface EventRow {
  device_id: string;
  event: string;
  props: Record<string, unknown>;
  app_version: string | null;
  platform: string | null;
  ts: string;
}

// Stages in funnel order. Each stage's count = distinct devices that fired
// the stage's event (or any later stage) in the window.
const FUNNEL_STAGES = [
  { key: 'app_open',            label: 'App open',            events: ['ai_call', 'goal_created', 'onboarding_step_completed', 'onboarding_finished', 'routine_block_completed'] },
  { key: 'onboarding_finished', label: 'Onboarding complete', events: ['onboarding_finished', 'goal_created', 'routine_block_completed'] },
  { key: 'goal_created',        label: 'Goal created',        events: ['goal_created'] },
  { key: 'block_completed',     label: 'Block completed',     events: ['routine_block_completed'] },
  { key: 'evening_reflect',     label: 'Evening reflect',     events: ['evening_reflect_completed'] },
] as const;

export async function handleAdminTelemetry(
  req: Request,
  env: SupabaseEnv,
  _admin: AdminClaims,
  cors: HeadersInit,
): Promise<Response> {
  const url = new URL(req.url);
  const segments = url.pathname.split('/').filter(Boolean); // ['v1', 'admin', 'telemetry', ...]
  const action = segments[3] ?? '';

  if (req.method === 'GET' && action === 'funnel') {
    const days = clampInt(url.searchParams.get('days'), 1, 90, 7);
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const rows = await pgSelect<EventRow>(
      env,
      'telemetry_events',
      `ts=gte.${encodeURIComponent(since)}&select=device_id,event,ts&limit=50000`,
    );

    // For each stage, count distinct devices that fired any of its events.
    const stageDevices = FUNNEL_STAGES.map(() => new Set<string>());
    for (const row of rows) {
      for (let i = 0; i < FUNNEL_STAGES.length; i++) {
        if ((FUNNEL_STAGES[i].events as readonly string[]).includes(row.event)) {
          stageDevices[i].add(row.device_id);
        }
      }
    }

    const stages = FUNNEL_STAGES.map((s, i) => ({
      key: s.key,
      label: s.label,
      devices: stageDevices[i].size,
    }));
    return json({ days, stages, sample_size: rows.length }, cors);
  }

  if (req.method === 'GET' && action === 'recent') {
    const limit = clampInt(url.searchParams.get('limit'), 1, 500, 100);
    const rows = await pgSelect<EventRow>(
      env,
      'telemetry_events',
      `select=*&order=ts.desc&limit=${limit}`,
    );
    return json({ events: rows }, cors);
  }

  // GET /v1/admin/telemetry/schema-failures?days=7
  // Returns AI schema failures grouped by (task, schema) with count and a
  // sample of recent raw outputs. Used by the admin to find regressions and
  // seed eval fixtures (Phase 4).
  if (req.method === 'GET' && action === 'schema-failures') {
    const days = clampInt(url.searchParams.get('days'), 1, 90, 7);
    const since = new Date(Date.now() - days * 86_400_000).toISOString();

    // We fetch raw events instead of asking Postgres to group, because the
    // group keys live inside the `props` jsonb. Bounded by `days` window.
    const rows = await pgSelect<EventRow>(
      env,
      'telemetry_events',
      `event=eq.ai_schema_failure&ts=gte.${encodeURIComponent(since)}&order=ts.desc&limit=2000`,
    );

    interface Bucket {
      task: string;
      schema: string;
      count: number;
      last_seen: string;
      first_seen: string;
      samples: Array<{ ts: string; error: string; raw_preview: string; app_version: string | null; platform: string | null }>;
    }

    const buckets = new Map<string, Bucket>();
    for (const row of rows) {
      const task = String(row.props.task ?? 'unknown');
      const schema = String(row.props.schema ?? 'unknown');
      const key = `${task}::${schema}`;
      let b = buckets.get(key);
      if (!b) {
        b = { task, schema, count: 0, last_seen: row.ts, first_seen: row.ts, samples: [] };
        buckets.set(key, b);
      }
      b.count += 1;
      if (row.ts > b.last_seen) b.last_seen = row.ts;
      if (row.ts < b.first_seen) b.first_seen = row.ts;
      if (b.samples.length < 3) {
        b.samples.push({
          ts: row.ts,
          error: String(row.props.error ?? ''),
          raw_preview: String(row.props.raw_preview ?? ''),
          app_version: row.app_version,
          platform: row.platform,
        });
      }
    }

    const groups = Array.from(buckets.values()).sort((a, b) => b.count - a.count);
    return json({ days, groups, sample_size: rows.length }, cors);
  }

  return json({ error: 'telemetry route not found' }, cors, 404);
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
