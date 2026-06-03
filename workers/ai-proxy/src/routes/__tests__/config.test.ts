import { handleConfig } from '../config';
import type { SupabaseEnv } from '../../lib/supabase';

// Mock the Supabase REST boundary. handleConfig reads two tables via pgSelect:
//   flags          (select=key,type,default_value,status)
//   flag_overrides (select=flag_id,scope_json,value,flags(key))
// We stub each by the table name so a single mock serves both reads.
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

let flagRows: FlagRow[] = [];
let overrideRows: OverrideRow[] = [];

const pgSelect = jest.fn(
  async (_env: unknown, table: string, _query: string): Promise<unknown[]> => {
    if (table === 'flags') return flagRows;
    if (table === 'flag_overrides') return overrideRows;
    return [];
  },
);

jest.mock('../../lib/supabase', () => ({
  pgSelect: (env: unknown, table: string, query: string) => pgSelect(env, table, query),
}));

const CORS: HeadersInit = { 'Access-Control-Allow-Origin': '*' };
const ENV = {} as Partial<SupabaseEnv> as SupabaseEnv;

function flag(key: string, defaultValue: unknown, status: 'active' | 'killed' = 'active'): FlagRow {
  return { key, type: 'bool', default_value: defaultValue, status };
}
function override(key: string, value: unknown, scope: Record<string, string>): OverrideRow {
  return { flag_id: `${key}-id`, scope_json: scope, value, flags: { key } };
}

function configReq(qs = ''): Request {
  return new Request(`https://x/v1/config${qs}`);
}

async function resolve(qs = ''): Promise<Record<string, unknown>> {
  const res = await handleConfig(configReq(qs), ENV, CORS);
  const body = (await res.json()) as { flags: Record<string, unknown> };
  return body.flags;
}

beforeEach(() => {
  flagRows = [];
  overrideRows = [];
  pgSelect.mockClear();
});

describe('handleConfig — flag resolution', () => {
  it('a killed flag resolves to false regardless of its default_value', async () => {
    flagRows = [flag('explore_v2', true, 'killed')];
    const flags = await resolve();
    expect(flags.explore_v2).toBe(false);
  });

  it('an active flag resolves to its default_value', async () => {
    flagRows = [flag('explore_v2', 'enabled', 'active')];
    const flags = await resolve();
    expect(flags.explore_v2).toBe('enabled');
  });

  it('a scope-matching override wins over the default', async () => {
    flagRows = [flag('voice_path', false)];
    overrideRows = [override('voice_path', true, { platform: 'ios' })];
    const flags = await resolve('?platform=ios');
    expect(flags.voice_path).toBe(true);
  });

  it('a non-matching override is ignored (default stands)', async () => {
    flagRows = [flag('voice_path', false)];
    overrideRows = [override('voice_path', true, { platform: 'ios' })];
    const flags = await resolve('?platform=android');
    expect(flags.voice_path).toBe(false);
  });

  it('returns a fetched_at timestamp alongside the flags', async () => {
    flagRows = [flag('x', 1)];
    const res = await handleConfig(configReq(), ENV, CORS);
    const body = (await res.json()) as { flags: Record<string, unknown>; fetched_at: string };
    expect(typeof body.fetched_at).toBe('string');
    expect(body.flags.x).toBe(1);
  });
});

describe('matchesScope (via handleConfig)', () => {
  it('honours a platform mismatch — override skipped', async () => {
    flagRows = [flag('f', 'base')];
    overrideRows = [override('f', 'override', { platform: 'web' })];
    expect((await resolve('?platform=ios')).f).toBe('base');
  });

  it('applies the override when the platform matches', async () => {
    flagRows = [flag('f', 'base')];
    overrideRows = [override('f', 'override', { platform: 'web' })];
    expect((await resolve('?platform=web')).f).toBe('override');
  });

  it('tester_email match is case-insensitive', async () => {
    flagRows = [flag('beta', false)];
    overrideRows = [override('beta', true, { tester_email: 'Tester@Example.com' })];
    expect((await resolve('?email=tester@EXAMPLE.com')).beta).toBe(true);
  });

  it('tester_email mismatch skips the override', async () => {
    flagRows = [flag('beta', false)];
    overrideRows = [override('beta', true, { tester_email: 'tester@example.com' })];
    expect((await resolve('?email=someone-else@example.com')).beta).toBe(false);
  });

  it('combined scope: all keys must match (platform ok, email wrong → skip)', async () => {
    flagRows = [flag('beta', false)];
    overrideRows = [override('beta', true, { platform: 'ios', tester_email: 'a@b.com' })];
    expect((await resolve('?platform=ios&email=other@b.com')).beta).toBe(false);
    expect((await resolve('?platform=ios&email=a@b.com')).beta).toBe(true);
  });
});

describe('versionCompare via app_version_lt scope', () => {
  // matchesScope returns false (override skipped) when
  // versionCompare(appVersion, app_version_lt) >= 0, i.e. appVersion >= bound.
  // Override APPLIES only when appVersion < bound. With no appVersion in ctx the
  // app_version_lt guard is bypassed (override still applies).
  function setup(bound: string) {
    flagRows = [flag('legacy_banner', false)];
    overrideRows = [override('legacy_banner', true, { app_version_lt: bound })];
  }

  it('applies when appVersion is strictly below the bound', async () => {
    setup('2.0.0');
    expect((await resolve('?app_version=1.9.9')).legacy_banner).toBe(true);
  });

  it('skips when appVersion equals the bound (>= 0)', async () => {
    setup('2.0.0');
    expect((await resolve('?app_version=2.0.0')).legacy_banner).toBe(false);
  });

  it('skips when appVersion is above the bound', async () => {
    setup('2.0.0');
    expect((await resolve('?app_version=2.0.1')).legacy_banner).toBe(false);
  });

  it('multi-segment: 1.2.10 is greater than 1.2.9 (numeric, not lexical) → skip', async () => {
    setup('1.2.9');
    expect((await resolve('?app_version=1.2.10')).legacy_banner).toBe(false);
  });

  it('multi-segment: 1.2.3 is below 1.2.10 → apply', async () => {
    setup('1.2.10');
    expect((await resolve('?app_version=1.2.3')).legacy_banner).toBe(true);
  });

  it('short-vs-long: 1.2 equals 1.2.0 (missing segments treated as 0) → skip', async () => {
    setup('1.2');
    expect((await resolve('?app_version=1.2.0')).legacy_banner).toBe(false);
  });

  it('short-vs-long: 1.2 is below 1.2.1 → apply', async () => {
    setup('1.2.1');
    expect((await resolve('?app_version=1.2')).legacy_banner).toBe(true);
  });

  it('bypasses the version guard entirely when no app_version is supplied', async () => {
    setup('2.0.0');
    // No app_version → ctx.appVersion is undefined → guard short-circuits, override applies.
    expect((await resolve()).legacy_banner).toBe(true);
  });

  it('non-numeric segments parse to 0 (1.x.0 treated as 1.0.0)', async () => {
    setup('1.0.0');
    // app_version=1.x.0 → [1,0,0]; bound 1.0.0 → [1,0,0]; equal → >= 0 → skip.
    expect((await resolve('?app_version=1.x.0')).legacy_banner).toBe(false);
  });
});
