/**
 * Admin push composer + broadcast. Owner/editor only — support role can
 * see device counts but not send.
 *
 * Routes:
 *   GET   /v1/admin/push/stats           → { total, by_platform: {ios, android, web} }
 *   POST  /v1/admin/push/broadcast       body: { title, body, data?, platform? }
 *
 * Broadcast uses Expo's Push API (https://exp.host/--/api/v2/push/send).
 * Expo accepts batched arrays — we chunk at 100 per call (Expo's documented
 * batch limit). Failed/invalid tokens are marked `invalid_at` for cleanup.
 */

import { pgSelect, pgUpdate, type SupabaseEnv } from '../../lib/supabase';
import { type AdminClaims, writeAudit } from '../../lib/adminAuth';

interface TokenRow {
  id: string;
  token: string;
  platform: string | null;
}

interface BroadcastBody {
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  platform?: 'ios' | 'android' | 'web';
}

interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100;

export async function handleAdminPush(
  req: Request,
  env: SupabaseEnv,
  admin: AdminClaims,
  cors: HeadersInit,
): Promise<Response> {
  const url = new URL(req.url);
  const segments = url.pathname.split('/').filter(Boolean);
  const action = segments[3] ?? '';

  if (req.method === 'GET' && action === 'stats') {
    const rows = await pgSelect<TokenRow>(
      env,
      'expo_push_tokens',
      'invalid_at=is.null&select=id,platform&limit=10000',
    );
    const stats: { total: number; by_platform: Record<string, number> } = {
      total: rows.length,
      by_platform: {},
    };
    for (const row of rows) {
      const p = row.platform ?? 'unknown';
      stats.by_platform[p] = (stats.by_platform[p] ?? 0) + 1;
    }
    return json(stats, cors);
  }

  if (req.method === 'POST' && action === 'broadcast') {
    if (admin.role === 'support') {
      return json({ error: 'forbidden — support role cannot send' }, cors, 403);
    }

    const body = (await req.json().catch(() => null)) as BroadcastBody | null;
    if (!body || typeof body.body !== 'string' || !body.body.trim()) {
      return json({ error: 'body is required' }, cors, 400);
    }
    if (body.title && body.title.length > 200) return json({ error: 'title too long' }, cors, 400);
    if (body.body.length > 1000) return json({ error: 'body too long' }, cors, 400);

    let query = 'invalid_at=is.null&select=id,token,platform&limit=10000';
    if (body.platform) query += `&platform=eq.${encodeURIComponent(body.platform)}`;
    const rows = await pgSelect<TokenRow>(env, 'expo_push_tokens', query);

    if (rows.length === 0) {
      return json({ sent: 0, failed: 0, invalid: 0, message: 'no active tokens' }, cors);
    }

    let sent = 0;
    let failed = 0;
    const invalidTokenIds: string[] = [];

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const messages = batch.map((r) => ({
        to: r.token,
        title: body.title,
        body: body.body,
        data: body.data,
        sound: 'default',
      }));

      try {
        const res = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(messages),
        });
        const payload = (await res.json()) as { data?: ExpoTicket[] };
        const tickets = payload.data ?? [];
        for (let j = 0; j < tickets.length; j++) {
          const ticket = tickets[j];
          if (ticket.status === 'ok') {
            sent += 1;
          } else {
            failed += 1;
            if (ticket.details?.error === 'DeviceNotRegistered') {
              invalidTokenIds.push(batch[j].id);
            }
          }
        }
      } catch (e) {
        console.error('expo push batch failed:', e);
        failed += batch.length;
      }
    }

    // Mark DeviceNotRegistered tokens as invalid so future broadcasts skip them.
    if (invalidTokenIds.length > 0) {
      const now = new Date().toISOString();
      for (const id of invalidTokenIds) {
        await pgUpdate(env, 'expo_push_tokens', `id=eq.${id}`, { invalid_at: now }).catch((e) =>
          console.error('mark invalid failed:', e),
        );
      }
    }

    await writeAudit(
      env,
      admin.email,
      'push_broadcast',
      'expo_push_tokens',
      null,
      { platform: body.platform ?? 'all', tokens_attempted: rows.length },
      { sent, failed, invalid: invalidTokenIds.length },
    );

    return json({ sent, failed, invalid: invalidTokenIds.length }, cors);
  }

  return json({ error: 'push route not found' }, cors, 404);
}

function json(body: unknown, cors: HeadersInit, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}
