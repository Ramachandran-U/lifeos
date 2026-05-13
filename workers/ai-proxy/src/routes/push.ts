/**
 * Push token registration. Bearer-auth'd (only signed-in users register
 * tokens — anonymous push wouldn't be addressable anyway).
 *
 * Upsert semantics: same `token` value just bumps `last_seen` and resets
 * `invalid_at` so a reinstalled device works again.
 */

import type { Env } from '../index';
import { pgSelect, pgUpdate, pgInsert } from '../lib/supabase';

interface RegisterBody {
  token?: string;
  platform?: string;
  app_version?: string;
  device_id?: string;
}

interface TokenRow {
  id: string;
  token: string;
}

export async function handlePushRegister(
  req: Request,
  env: Env,
  cors: HeadersInit,
): Promise<Response> {
  if (req.method !== 'POST') return resp({ error: 'method not allowed' }, 405, cors);

  let body: RegisterBody;
  try {
    body = (await req.json()) as RegisterBody;
  } catch {
    return resp({ error: 'invalid JSON' }, 400, cors);
  }

  const token = (body.token ?? '').trim();
  // Expo push tokens look like `ExponentPushToken[…]` or FCM-style. We
  // do a sanity length check rather than format validation — Expo's
  // own push API will reject bad tokens at send time and that's the
  // signal to mark invalid_at.
  if (!token || token.length > 256) {
    return resp({ error: 'invalid token' }, 400, cors);
  }

  try {
    const existing = await pgSelect<TokenRow>(
      env,
      'expo_push_tokens',
      `token=eq.${encodeURIComponent(token)}&select=id,token&limit=1`,
    );
    if (existing.length > 0) {
      await pgUpdate(env, 'expo_push_tokens', `id=eq.${existing[0].id}`, {
        last_seen: new Date().toISOString(),
        platform: body.platform ?? null,
        app_version: body.app_version ?? null,
        device_id: body.device_id ?? null,
        invalid_at: null,
      });
    } else {
      await pgInsert(env, 'expo_push_tokens', {
        token,
        platform: body.platform ?? null,
        app_version: body.app_version ?? null,
        device_id: body.device_id ?? null,
      });
    }
  } catch (e) {
    console.error('push register failed:', e);
    return resp({ error: 'register failed' }, 500, cors);
  }

  return resp({ ok: true }, 200, cors);
}

function resp(body: unknown, status: number, cors: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}
