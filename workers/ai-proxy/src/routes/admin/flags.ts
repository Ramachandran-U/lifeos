import { pgSelect, pgUpdate, type SupabaseEnv } from '../../lib/supabase';
import { type AdminClaims, writeAudit } from '../../lib/adminAuth';

interface FlagRow {
  id: string;
  key: string;
  type: 'bool' | 'cohort_pct' | 'enum';
  default_value: unknown;
  status: 'active' | 'killed';
  description: string | null;
  updated_by: string | null;
  updated_at: string;
}

export async function handleAdminFlags(
  req: Request,
  env: SupabaseEnv,
  admin: AdminClaims,
  cors: HeadersInit,
): Promise<Response> {
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const rows = await pgSelect<FlagRow>(env, 'flags', 'select=*&order=key.asc');
    return json({ flags: rows }, cors);
  }

  // PATCH /v1/admin/flags/:key  body: { default_value? , status?, description? }
  if (req.method === 'PATCH') {
    if (admin.role === 'support') return json({ error: 'forbidden' }, cors, 403);

    const key = url.pathname.split('/').pop();
    if (!key) return json({ error: 'missing flag key' }, cors, 400);

    const patch = (await req.json().catch(() => null)) as
      | { default_value?: unknown; status?: 'active' | 'killed'; description?: string }
      | null;
    if (!patch) return json({ error: 'invalid body' }, cors, 400);

    const before = await pgSelect<FlagRow>(env, 'flags', `key=eq.${encodeURIComponent(key)}&select=*`);
    if (before.length === 0) return json({ error: 'flag not found' }, cors, 404);

    const after = await pgUpdate<FlagRow>(
      env,
      'flags',
      `key=eq.${encodeURIComponent(key)}`,
      { ...patch, updated_by: admin.email, updated_at: new Date().toISOString() },
    );

    await writeAudit(env, admin.email, 'flag.update', 'flag', key, before[0], after[0]);
    return json({ flag: after[0] }, cors);
  }

  return json({ error: 'method not allowed' }, cors, 405);
}

function json(body: unknown, cors: HeadersInit, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}
