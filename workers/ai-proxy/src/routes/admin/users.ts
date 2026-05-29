/**
 * Admin Users tab — anonymous, behaviour-only. Aggregates per device_id
 * across the trailing window. NO email / user_id join: the only identifier
 * is the device-scoped UUID the consumer SDK already sends.
 *
 * GET /v1/admin/users?days=30&filter=all|stuck|active|superuser
 *   →  one row per device_id with first/last seen, event count, onboarding
 *      stage reached, feedback submitted, platform.
 *
 * Buckets:
 *   stuck     — entered onboarding but never fired `onboarding_finished`
 *               AND no events in the last 3 days.
 *   active    — fired at least 1 event in the last 3 days.
 *   superuser — ≥30 events AND fired `evening_reflect_completed` in the
 *               last 3 days.
 */

import { pgSelect, type SupabaseEnv } from '../../lib/supabase';
import { type AdminClaims } from '../../lib/adminAuth';

interface EventRow {
  device_id: string;
  event: string;
  ts: string;
  app_version: string | null;
  platform: string | null;
}

interface FeedbackRow {
  device_id: string | null;
}

const ONBOARDING_STAGES = [
  'onboarding_v2_started',
  'slot_filled',
  'discovery_chat_completed',
  'routine_generated',
  'first_block_completed',
  'onboarding_finished',
] as const;

const STAGE_LABEL: Record<string, string> = {
  onboarding_v2_started:    'Started',
  slot_filled:              'Slot filled',
  discovery_chat_completed: 'Discovery done',
  routine_generated:        'Routine made',
  first_block_completed:    'First block',
  onboarding_finished:      'Finished',
};

export async function handleAdminUsers(
  req: Request,
  env: SupabaseEnv,
  _admin: AdminClaims,
  cors: HeadersInit,
): Promise<Response> {
  const url = new URL(req.url);
  const days = clampInt(url.searchParams.get('days'), 1, 90, 30);
  const filter = (url.searchParams.get('filter') ?? 'all') as 'all' | 'stuck' | 'active' | 'superuser';
  const now = Date.now();
  const since = new Date(now - days * 86_400_000).toISOString();
  const recentCutoff = new Date(now - 3 * 86_400_000).toISOString();

  const [events, feedback] = await Promise.all([
    pgSelect<EventRow>(
      env,
      'telemetry_events',
      `ts=gte.${encodeURIComponent(since)}&select=device_id,event,ts,app_version,platform&limit=80000`,
    ),
    pgSelect<FeedbackRow>(
      env,
      'feedback',
      `received_at=gte.${encodeURIComponent(since)}&select=device_id&limit=5000`,
    ),
  ]);

  interface DeviceBucket {
    device_id: string;
    first_seen: string;
    last_seen: string;
    event_count: number;
    onboarding_stage_index: number;
    finished_onboarding: boolean;
    reflected_recently: boolean;
    feedback_count: number;
    app_version: string | null;
    platform: string | null;
  }

  const devices = new Map<string, DeviceBucket>();
  const ensure = (id: string, ts: string, ver: string | null, plat: string | null): DeviceBucket => {
    let d = devices.get(id);
    if (!d) {
      d = {
        device_id: id,
        first_seen: ts,
        last_seen: ts,
        event_count: 0,
        onboarding_stage_index: -1,
        finished_onboarding: false,
        reflected_recently: false,
        feedback_count: 0,
        app_version: ver,
        platform: plat,
      };
      devices.set(id, d);
    }
    return d;
  };

  for (const e of events) {
    const d = ensure(e.device_id, e.ts, e.app_version, e.platform);
    d.event_count += 1;
    if (e.ts < d.first_seen) d.first_seen = e.ts;
    if (e.ts > d.last_seen) {
      d.last_seen = e.ts;
      // Use the latest event's app_version / platform.
      if (e.app_version) d.app_version = e.app_version;
      if (e.platform) d.platform = e.platform;
    }
    const stageIdx = ONBOARDING_STAGES.indexOf(e.event as never);
    if (stageIdx > d.onboarding_stage_index) d.onboarding_stage_index = stageIdx;
    if (e.event === 'onboarding_finished') d.finished_onboarding = true;
    if (e.event === 'evening_reflect_completed' && e.ts >= recentCutoff) d.reflected_recently = true;
  }
  for (const f of feedback) {
    if (!f.device_id) continue;
    const d = devices.get(f.device_id);
    if (d) d.feedback_count += 1;
  }

  let rows = Array.from(devices.values()).map((d) => {
    const isActive = d.last_seen >= recentCutoff;
    const isStuck = !d.finished_onboarding && d.onboarding_stage_index >= 0 && !isActive;
    const isSuper = d.event_count >= 30 && d.reflected_recently;
    return {
      device_id: d.device_id,
      first_seen: d.first_seen,
      last_seen: d.last_seen,
      event_count: d.event_count,
      onboarding_stage:
        d.onboarding_stage_index >= 0
          ? STAGE_LABEL[ONBOARDING_STAGES[d.onboarding_stage_index]] ?? ONBOARDING_STAGES[d.onboarding_stage_index]
          : null,
      finished_onboarding: d.finished_onboarding,
      feedback_count: d.feedback_count,
      app_version: d.app_version,
      platform: d.platform,
      bucket: isSuper ? 'superuser' : isActive ? 'active' : isStuck ? 'stuck' : 'inactive',
    };
  });

  if (filter !== 'all') {
    rows = rows.filter((r) => r.bucket === filter);
  }
  rows.sort((a, b) => (a.last_seen < b.last_seen ? 1 : -1));

  const totals = {
    all: devices.size,
    active: 0,
    stuck: 0,
    superuser: 0,
    inactive: 0,
  };
  for (const r of Array.from(devices.values())) {
    const isActive = r.last_seen >= recentCutoff;
    const isStuck = !r.finished_onboarding && r.onboarding_stage_index >= 0 && !isActive;
    const isSuper = r.event_count >= 30 && r.reflected_recently;
    if (isSuper) totals.superuser += 1;
    else if (isActive) totals.active += 1;
    else if (isStuck) totals.stuck += 1;
    else totals.inactive += 1;
  }

  return json({
    window_days: days,
    filter,
    totals,
    users: rows.slice(0, 500),  // hard cap for UI sanity
    truncated: rows.length > 500,
  }, cors);
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
