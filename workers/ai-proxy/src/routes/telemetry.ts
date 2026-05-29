/**
 * Anonymous opt-in telemetry ingest.
 *
 * Design rules (enforced here, not at the database level):
 *   1. Event name MUST be on the server-side allowlist below. Unknown names
 *      → 400. This is the single point that controls vocabulary.
 *   2. Props are a free-form JSON bag but capped at 4 KB after stringify.
 *      Reject anything larger to keep PII drift in check.
 *   3. No auth required (anonymous). `device_id` is the only identifier.
 *      Per-device-per-day rate cap to discourage spam.
 *
 * If you need to add a new event, append it to ALLOWED_EVENTS and ship.
 * No migration needed; the table is schema-on-read for props.
 */

import type { Env } from '../index';
import { pgInsert } from '../lib/supabase';

// Kept in sync with `EVENTS` in src/utils/telemetry.ts on the client. Any
// event the client emits MUST appear here or the worker will 400 it.
const ALLOWED_EVENTS = new Set([
  // AI / quality
  'ai_call',
  'ai_schema_failure',
  // Onboarding
  'onboarding_finished',
  'onboarding_v2_started',
  'discovery_chat_completed',
  'discovery_chat_abandoned',
  'slot_filled',
  // Core feature usage
  'goal_created',
  'routine_generated',
  'routine_edited',
  'routine_replanned',
  'routine_block_completed',
  'first_block_completed',
  'tomorrow_routine_generated',
  'tomorrow_routine_failed',
  'evening_reflect_completed',
  'profile_inference_run',
  // Reliability
  'ui_crash',
  'storage_usage',
  // Retention — fires once per UTC day per device on first Today focus.
  // Props: { days_since_install: number }
  'app_opened',
]);

const MAX_PROPS_BYTES = 4 * 1024;
const PER_DEVICE_DAILY_CAP = 5_000;

interface IngestBody {
  device_id?: string;
  event?: string;
  props?: Record<string, unknown>;
  app_version?: string;
  platform?: string;
}

export async function handleTelemetry(
  req: Request,
  env: Env,
  cors: HeadersInit,
): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonResp({ error: 'method not allowed' }, 405, cors);
  }

  let body: IngestBody;
  try {
    body = (await req.json()) as IngestBody;
  } catch {
    return jsonResp({ error: 'invalid JSON body' }, 400, cors);
  }

  const deviceId = (body.device_id ?? '').trim();
  const event = (body.event ?? '').trim();

  if (!deviceId || deviceId.length > 64) {
    return jsonResp({ error: 'missing or invalid device_id' }, 400, cors);
  }
  if (!event || !ALLOWED_EVENTS.has(event)) {
    return jsonResp({ error: 'event not on allowlist' }, 400, cors);
  }

  const props = body.props && typeof body.props === 'object' ? body.props : {};
  let propsJson: string;
  try {
    propsJson = JSON.stringify(props);
  } catch {
    return jsonResp({ error: 'props not serializable' }, 400, cors);
  }
  if (propsJson.length > MAX_PROPS_BYTES) {
    return jsonResp({ error: 'props too large' }, 413, cors);
  }

  // Per-device daily cap (shared KV namespace with the main rate limiter).
  // Cheap insurance against runaway event loops or hostile clients.
  const day = new Date().toISOString().slice(0, 10);
  const counterKey = `telemetry:${deviceId}:${day}`;
  const current = Number((await env.RATE_LIMIT.get(counterKey)) ?? '0');
  if (current >= PER_DEVICE_DAILY_CAP) {
    return jsonResp({ error: 'daily telemetry cap reached' }, 429, cors);
  }
  await env.RATE_LIMIT.put(counterKey, String(current + 1), { expirationTtl: 60 * 60 * 36 });

  try {
    await pgInsert(env, 'telemetry_events', {
      device_id: deviceId,
      event,
      props,
      app_version: body.app_version ?? null,
      platform: body.platform ?? null,
    });
  } catch (e) {
    // Don't leak DB error details to anonymous clients.
    console.error('telemetry insert failed:', e);
    return jsonResp({ error: 'insert failed' }, 500, cors);
  }

  return jsonResp({ ok: true }, 202, cors);
}

function jsonResp(body: unknown, status: number, cors: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}
