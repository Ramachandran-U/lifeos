// Authenticated endpoint the consumer app polls at startup. Returns the
// active body for every prompt that has one. Bundled prompts in the app
// stay as a fallback if this fetch fails or returns no row for a given key.

import { pgSelect, type SupabaseEnv } from '../lib/supabase';

interface ActiveVersionRow {
  body: string;
  version: number;
  prompts: { key: string };
}

export async function handlePrompts(req: Request, env: SupabaseEnv, cors: HeadersInit): Promise<Response> {
  const rows = await pgSelect<ActiveVersionRow>(
    env,
    'prompt_versions',
    'select=body,version,prompts(key)&status=eq.active',
  );

  const out: Record<string, { body: string; version: number }> = {};
  for (const r of rows) {
    out[r.prompts.key] = { body: r.body, version: r.version };
  }

  return new Response(
    JSON.stringify({ prompts: out, fetched_at: new Date().toISOString() }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=300',
        ...cors,
      },
    },
  );
}
