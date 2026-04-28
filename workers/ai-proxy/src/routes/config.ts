// Public endpoint the consumer app hits at startup to fetch resolved flag
// values. No auth — flag *values* aren't secret. The fact that a flag exists
// is already public from inspecting the app bundle.

import { pgSelect, type SupabaseEnv } from '../lib/supabase';

interface FlagRow {
  key: string;
  type: 'bool' | 'cohort_pct' | 'enum';
  default_value: unknown;
  status: 'active' | 'killed';
}

interface OverrideRow {
  flag_id: string;
  scope_json: Record<string, string>;
  value: unknown;
  flags: { key: string };
}

interface ResolveContext {
  platform?: string;
  appVersion?: string;
  testerEmail?: string;
}

function matchesScope(scope: Record<string, string>, ctx: ResolveContext): boolean {
  if (scope.platform && scope.platform !== ctx.platform) return false;
  if (scope.tester_email && scope.tester_email.toLowerCase() !== (ctx.testerEmail || '').toLowerCase()) return false;
  if (scope.app_version_lt && ctx.appVersion && versionCompare(ctx.appVersion, scope.app_version_lt) >= 0) return false;
  return true;
}

function versionCompare(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

export async function handleConfig(req: Request, env: SupabaseEnv, cors: HeadersInit): Promise<Response> {
  const url = new URL(req.url);
  const ctx: ResolveContext = {
    platform: url.searchParams.get('platform') || undefined,
    appVersion: url.searchParams.get('app_version') || undefined,
    testerEmail: url.searchParams.get('email') || undefined,
  };

  const flags = await pgSelect<FlagRow>(env, 'flags', 'select=key,type,default_value,status');
  const overrides = await pgSelect<OverrideRow>(
    env,
    'flag_overrides',
    'select=flag_id,scope_json,value,flags(key)',
  );

  const resolved: Record<string, unknown> = {};
  for (const f of flags) {
    if (f.status === 'killed') {
      resolved[f.key] = false;
      continue;
    }
    resolved[f.key] = f.default_value;
  }
  for (const o of overrides) {
    if (matchesScope(o.scope_json, ctx)) {
      resolved[o.flags.key] = o.value;
    }
  }

  return new Response(
    JSON.stringify({ flags: resolved, fetched_at: new Date().toISOString() }),
    { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60', ...cors } },
  );
}
