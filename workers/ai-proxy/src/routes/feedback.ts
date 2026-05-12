/**
 * Public feedback ingest. Anonymous; no Bearer required (most users who hit
 * a sharp edge aren't going to sign in just to complain).
 *
 * Caps:
 *   - body ≤ 4 KB
 *   - subject ≤ 200 chars
 *   - from_email ≤ 254 chars (RFC 5321)
 *   - 10 submissions per device per day (KV-backed, shared namespace)
 */

import type { Env } from '../index';
import { pgInsert } from '../lib/supabase';

const MAX_BODY = 4 * 1024;
const MAX_SUBJECT = 200;
const MAX_EMAIL = 254;
const PER_DEVICE_DAILY_CAP = 10;

interface Body {
  device_id?: string;
  from_email?: string;
  subject?: string;
  body?: string;
  app_version?: string;
  platform?: string;
}

export async function handleFeedback(
  req: Request,
  env: Env,
  cors: HeadersInit,
): Promise<Response> {
  if (req.method !== 'POST') return resp({ error: 'method not allowed' }, 405, cors);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return resp({ error: 'invalid JSON' }, 400, cors);
  }

  const message = (body.body ?? '').trim();
  if (!message) return resp({ error: 'body is required' }, 400, cors);
  if (message.length > MAX_BODY) return resp({ error: 'body too large' }, 413, cors);

  const subject = (body.subject ?? '').slice(0, MAX_SUBJECT) || null;
  const fromEmail = (body.from_email ?? '').slice(0, MAX_EMAIL) || null;
  const deviceId = (body.device_id ?? '').slice(0, 64) || null;

  if (deviceId) {
    const day = new Date().toISOString().slice(0, 10);
    const counterKey = `feedback:${deviceId}:${day}`;
    const current = Number((await env.RATE_LIMIT.get(counterKey)) ?? '0');
    if (current >= PER_DEVICE_DAILY_CAP) {
      return resp({ error: 'daily feedback cap reached' }, 429, cors);
    }
    await env.RATE_LIMIT.put(counterKey, String(current + 1), { expirationTtl: 60 * 60 * 36 });
  }

  try {
    await pgInsert(env, 'feedback', {
      from_email: fromEmail,
      subject,
      body: message,
      source: 'app',
      status: 'new',
      device_id: deviceId,
      app_version: body.app_version ?? null,
      platform: body.platform ?? null,
    });
  } catch (e) {
    console.error('feedback insert failed:', e);
    return resp({ error: 'insert failed' }, 500, cors);
  }

  return resp({ ok: true }, 202, cors);
}

function resp(body: unknown, status: number, cors: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}
