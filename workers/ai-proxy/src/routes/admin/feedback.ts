/**
 * Admin feedback triage. Read + update; never deletes (audit-friendly).
 *
 * Routes:
 *   GET    /v1/admin/feedback?status=new|triaged|responded|closed&limit=N
 *   PATCH  /v1/admin/feedback/:id   { status?, assigned_to?, notes? }
 */

import { pgSelect, pgUpdate, type SupabaseEnv } from '../../lib/supabase';
import { type AdminClaims, writeAudit } from '../../lib/adminAuth';

interface FeedbackRow {
  id: number;
  from_email: string | null;
  subject: string | null;
  body: string;
  source: 'app' | 'email';
  status: 'new' | 'triaged' | 'responded' | 'closed';
  assigned_to: string | null;
  notes: string | null;
  device_id: string | null;
  app_version: string | null;
  platform: string | null;
  received_at: string;
  updated_at: string;
}

const VALID_STATUSES = new Set(['new', 'triaged', 'responded', 'closed']);

export async function handleAdminFeedback(
  req: Request,
  env: SupabaseEnv,
  admin: AdminClaims,
  cors: HeadersInit,
): Promise<Response> {
  const url = new URL(req.url);
  const segments = url.pathname.split('/').filter(Boolean); // ['v1','admin','feedback', maybe id]
  const id = segments[3];

  if (req.method === 'GET' && !id) {
    const status = url.searchParams.get('status');
    const limit = clampInt(url.searchParams.get('limit'), 1, 500, 100);
    let query = `select=*&order=received_at.desc&limit=${limit}`;
    if (status && VALID_STATUSES.has(status)) {
      query += `&status=eq.${encodeURIComponent(status)}`;
    }
    const rows = await pgSelect<FeedbackRow>(env, 'feedback', query);
    return json({ feedback: rows }, cors);
  }

  if (req.method === 'PATCH' && id) {
    if (admin.role === 'support') {
      // support role can touch status + notes but not reassign
    }
    const patch = (await req.json().catch(() => null)) as
      | { status?: string; assigned_to?: string | null; notes?: string }
      | null;
    if (!patch) return json({ error: 'invalid body' }, cors, 400);

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof patch.status === 'string') {
      if (!VALID_STATUSES.has(patch.status)) return json({ error: 'invalid status' }, cors, 400);
      update.status = patch.status;
    }
    if (admin.role !== 'support' && (typeof patch.assigned_to === 'string' || patch.assigned_to === null)) {
      update.assigned_to = patch.assigned_to;
    }
    if (typeof patch.notes === 'string') update.notes = patch.notes;

    const before = await pgSelect<FeedbackRow>(env, 'feedback', `id=eq.${id}&select=*`);
    if (before.length === 0) return json({ error: 'not found' }, cors, 404);

    const after = await pgUpdate<FeedbackRow>(env, 'feedback', `id=eq.${id}`, update);

    await writeAudit(env, admin.email, 'patch_feedback', 'feedback', id, before[0], after[0]);
    return json({ feedback: after[0] }, cors);
  }

  return json({ error: 'feedback route not found' }, cors, 404);
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
