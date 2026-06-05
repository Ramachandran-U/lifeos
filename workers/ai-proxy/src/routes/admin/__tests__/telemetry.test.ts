/**
 * Admin telemetry handler — read-only over telemetry_events. Covers the v1 and
 * v2 onboarding funnels (distinct devices per stage), the recent-events list
 * with limit clamp, the schema-failure grouping (count desc, ≤3 samples per
 * group), and the 404. Supabase REST mocked at pgSelect.
 */
import { handleAdminTelemetry } from '../telemetry';
import type { AdminClaims } from '../../../lib/adminAuth';
import type { SupabaseEnv } from '../../../lib/supabase';

interface EventRow { device_id: string; event: string; props: Record<string, unknown>; app_version: string | null; platform: string | null; ts: string; }

let rows: EventRow[] = [];
let lastQuery = '';
const pgSelect = jest.fn(async (_e: unknown, _t: string, query: string): Promise<unknown[]> => { lastQuery = query; return rows; });
jest.mock('../../../lib/supabase', () => ({ pgSelect: (e: unknown, t: string, q: string) => pgSelect(e, t, q) }));

const CORS: HeadersInit = { 'Access-Control-Allow-Origin': '*' };
const ENV = {} as SupabaseEnv;
const admin: AdminClaims = { email: 'owner@x.test', role: 'owner' };
const req = (path: string): Request => new Request('https://w.test' + path, { method: 'GET' });
const ev = (device_id: string, event: string): EventRow => ({ device_id, event, props: {}, app_version: null, platform: null, ts: 't' });
const body = async <T>(r: Response): Promise<T> => (await r.json()) as T;

beforeEach(() => { rows = []; lastQuery = ''; jest.clearAllMocks(); });

describe('handleAdminTelemetry', () => {
  it('computes the v1 funnel as distinct devices per stage', async () => {
    rows = [
      ev('d1', 'goal_created'),                 // app_open + onboarding_finished + goal_created stages
      ev('d2', 'routine_block_completed'),      // app_open + onboarding_finished + block_completed
      ev('d1', 'evening_reflect_completed'),    // evening_reflect
    ];
    const b = await body<{ variant: string; stages: Array<{ key: string; devices: number }> }>(
      await handleAdminTelemetry(req('/v1/admin/telemetry/funnel?days=7'), ENV, admin, CORS));
    expect(b.variant).toBe('v1');
    const byKey = Object.fromEntries(b.stages.map((s) => [s.key, s.devices]));
    expect(byKey.app_open).toBe(2);          // d1, d2
    expect(byKey.goal_created).toBe(1);      // d1
    expect(byKey.evening_reflect).toBe(1);   // d1
  });

  it('uses the v2 stage list when variant=v2', async () => {
    rows = [ev('d1', 'onboarding_v2_started'), ev('d1', 'slot_filled'), ev('d2', 'onboarding_v2_started')];
    const b = await body<{ variant: string; stages: Array<{ key: string; devices: number }> }>(
      await handleAdminTelemetry(req('/v1/admin/telemetry/funnel?variant=v2'), ENV, admin, CORS));
    expect(b.variant).toBe('v2');
    const byKey = Object.fromEntries(b.stages.map((s) => [s.key, s.devices]));
    expect(byKey.v2_started).toBe(2);
    expect(byKey.v2_slot_filled).toBe(1);
  });

  it('recent clamps the limit to [1,500]', async () => {
    rows = [ev('d1', 'app_opened')];
    const res = await handleAdminTelemetry(req('/v1/admin/telemetry/recent?limit=9999'), ENV, admin, CORS);
    expect(res.status).toBe(200);
    expect(lastQuery).toContain('limit=500');
  });

  it('groups schema failures by (task, schema) sorted by count desc with ≤3 samples', async () => {
    const fail = (task: string, schema: string, error: string): EventRow =>
      ({ device_id: 'd', event: 'ai_schema_failure', props: { task, schema, error, raw_preview: 'x' }, app_version: '1', platform: 'web', ts: 't' });
    rows = [
      fail('planDay', 'RoutineSchema', 'e1'), fail('planDay', 'RoutineSchema', 'e2'),
      fail('planDay', 'RoutineSchema', 'e3'), fail('planDay', 'RoutineSchema', 'e4'),
      fail('chat', 'ReplySchema', 'e5'),
    ];
    const b = await body<{ groups: Array<{ task: string; schema: string; count: number; samples: unknown[] }> }>(
      await handleAdminTelemetry(req('/v1/admin/telemetry/schema-failures?days=7'), ENV, admin, CORS));
    expect(b.groups[0]).toMatchObject({ task: 'planDay', schema: 'RoutineSchema', count: 4 });
    expect(b.groups[0].samples).toHaveLength(3); // capped at 3
    expect(b.groups[1]).toMatchObject({ task: 'chat', count: 1 });
  });

  it('returns 404 for an unknown sub-route', async () => {
    const res = await handleAdminTelemetry(req('/v1/admin/telemetry/bogus'), ENV, admin, CORS);
    expect(res.status).toBe(404);
  });
});
