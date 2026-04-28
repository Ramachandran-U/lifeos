import { pgSelect, pgInsert, pgUpdate, type SupabaseEnv } from '../../lib/supabase';
import { type AdminClaims, writeAudit } from '../../lib/adminAuth';

interface PromptRow {
  id: string;
  key: string;
  description: string | null;
  created_at: string;
}

interface PromptVersionRow {
  id: string;
  prompt_id: string;
  version: number;
  body: string;
  status: 'draft' | 'active' | 'archived';
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export async function handleAdminPrompts(
  req: Request,
  env: SupabaseEnv,
  admin: AdminClaims,
  cors: HeadersInit,
): Promise<Response> {
  const url = new URL(req.url);
  const parts = url.pathname.split('/').filter(Boolean); // ['v1','admin','prompts', key?, 'versions'?, n?, 'activate'?]

  // GET /v1/admin/prompts
  if (req.method === 'GET' && parts.length === 3) {
    const rows = await pgSelect<PromptRow>(env, 'prompts', 'select=*&order=key.asc');
    return json({ prompts: rows }, cors);
  }

  const key = parts[3];
  if (!key) return json({ error: 'missing prompt key' }, cors, 400);

  const promptRows = await pgSelect<PromptRow>(
    env,
    'prompts',
    `key=eq.${encodeURIComponent(key)}&select=*`,
  );
  if (promptRows.length === 0) return json({ error: 'prompt not found' }, cors, 404);
  const prompt = promptRows[0];

  // GET /v1/admin/prompts/:key
  if (req.method === 'GET' && parts.length === 4) {
    const versions = await pgSelect<PromptVersionRow>(
      env,
      'prompt_versions',
      `prompt_id=eq.${prompt.id}&select=*&order=version.desc`,
    );
    return json({ prompt, versions }, cors);
  }

  // POST /v1/admin/prompts/:key/versions   body: { body, notes? }
  if (req.method === 'POST' && parts.length === 5 && parts[4] === 'versions') {
    if (admin.role === 'support') return json({ error: 'forbidden' }, cors, 403);

    const payload = (await req.json().catch(() => null)) as
      | { body?: string; notes?: string }
      | null;
    if (!payload?.body) return json({ error: 'body required' }, cors, 400);

    const existing = await pgSelect<PromptVersionRow>(
      env,
      'prompt_versions',
      `prompt_id=eq.${prompt.id}&select=version&order=version.desc&limit=1`,
    );
    const nextVersion = (existing[0]?.version ?? 0) + 1;

    const created = await pgInsert<PromptVersionRow>(env, 'prompt_versions', {
      prompt_id: prompt.id,
      version: nextVersion,
      body: payload.body,
      notes: payload.notes ?? null,
      status: 'draft',
      created_by: admin.email,
    });

    await writeAudit(env, admin.email, 'prompt.version.create', 'prompt_version', `${key}#${nextVersion}`, null, created);
    return json({ version: created }, cors);
  }

  // POST /v1/admin/prompts/:key/versions/:n/activate
  if (req.method === 'POST' && parts.length === 7 && parts[4] === 'versions' && parts[6] === 'activate') {
    if (admin.role === 'support') return json({ error: 'forbidden' }, cors, 403);

    const n = parseInt(parts[5], 10);
    if (!Number.isFinite(n)) return json({ error: 'bad version' }, cors, 400);

    // Archive any currently-active version, then activate the target.
    const currentlyActive = await pgSelect<PromptVersionRow>(
      env,
      'prompt_versions',
      `prompt_id=eq.${prompt.id}&status=eq.active&select=*`,
    );
    for (const v of currentlyActive) {
      await pgUpdate<PromptVersionRow>(
        env,
        'prompt_versions',
        `id=eq.${v.id}`,
        { status: 'archived' },
      );
    }

    const activated = await pgUpdate<PromptVersionRow>(
      env,
      'prompt_versions',
      `prompt_id=eq.${prompt.id}&version=eq.${n}`,
      { status: 'active' },
    );
    if (activated.length === 0) return json({ error: 'version not found' }, cors, 404);

    await writeAudit(
      env,
      admin.email,
      'prompt.version.activate',
      'prompt_version',
      `${key}#${n}`,
      currentlyActive[0] ?? null,
      activated[0],
    );
    return json({ version: activated[0] }, cors);
  }

  return json({ error: 'method not allowed' }, cors, 405);
}

function json(body: unknown, cors: HeadersInit, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}
