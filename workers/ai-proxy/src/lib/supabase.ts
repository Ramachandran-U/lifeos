// Tiny Supabase REST helper for the Worker. Uses the service role key, so
// every call here MUST be behind the admin auth guard or a public-config
// endpoint that only reads non-sensitive flag data.

export interface SupabaseEnv {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

function headers(env: SupabaseEnv, extra: Record<string, string> = {}): HeadersInit {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

export async function pgSelect<T>(
  env: SupabaseEnv,
  table: string,
  query: string,
): Promise<T[]> {
  const url = `${env.SUPABASE_URL}/rest/v1/${table}?${query}`;
  const res = await fetch(url, { headers: headers(env) });
  if (!res.ok) throw new Error(`supabase select ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function pgInsert<T>(
  env: SupabaseEnv,
  table: string,
  body: unknown,
): Promise<T> {
  const url = `${env.SUPABASE_URL}/rest/v1/${table}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: headers(env, { Prefer: 'return=representation' }),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`supabase insert ${table}: ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as T[];
  return rows[0];
}

export async function pgUpdate<T>(
  env: SupabaseEnv,
  table: string,
  query: string,
  patch: unknown,
): Promise<T[]> {
  const url = `${env.SUPABASE_URL}/rest/v1/${table}?${query}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: headers(env, { Prefer: 'return=representation' }),
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`supabase update ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function pgDelete(
  env: SupabaseEnv,
  table: string,
  query: string,
): Promise<void> {
  const url = `${env.SUPABASE_URL}/rest/v1/${table}?${query}`;
  const res = await fetch(url, { method: 'DELETE', headers: headers(env) });
  if (!res.ok) throw new Error(`supabase delete ${table}: ${res.status} ${await res.text()}`);
}
