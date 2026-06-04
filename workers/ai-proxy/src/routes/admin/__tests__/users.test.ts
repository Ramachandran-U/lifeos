/**
 * Admin Users handler — anonymous, behaviour-only device aggregation. Covers
 * the bucketing logic (superuser/active/stuck/inactive), the filter, the days
 * clamp, feedback counting, and the anonymity invariant (no email/user_id ever
 * leaves this handler). Supabase REST mocked per-table at pgSelect.
 */
import { handleAdminUsers } from '../users';
import type { AdminClaims } from '../../../lib/adminAuth';
import type { SupabaseEnv } from '../../../lib/supabase';

interface EventRow { device_id: string; event: string; ts: string; app_version: string | null; platform: string | null; }
interface FeedbackRow { device_id: string | null; }

let eventRows: EventRow[] = [];
let feedbackRows: FeedbackRow[] = [];
const pgSelect = jest.fn(async (_e: unknown, table: string, _q: string): Promise<unknown[]> =>
  table === 'telemetry_events' ? eventRows : feedbackRows);

jest.mock('../../../lib/supabase', () => ({
  pgSelect: (e: unknown, t: string, q: string) => pgSelect(e, t, q),
}));

interface UsersBody {
  window_days: number;
  filter: string;
  totals: { all: number; active: number; stuck: number; superuser: number; inactive: number };
  users: Array<{ device_id: string; bucket: string; feedback_count: number }>;
  truncated: boolean;
}

const CORS: HeadersInit = { 'Access-Control-Allow-Origin': '*' };
const ENV = {} as SupabaseEnv;
const admin: AdminClaims = { email: 'owner@x.test', role: 'owner' };
const req = (path: string): Request => new Request('https://w.test' + path, { method: 'GET' });
const ago = (days: number, hours = 0): string => new Date(Date.now() - days * 86_400_000 - hours * 3_600_000).toISOString();
const ev = (device_id: string, event: string, ts: string): EventRow => ({ device_id, event, ts, app_version: '1.0', platform: 'web' });
const body = async (res: Response): Promise<UsersBody> => (await res.json()) as UsersBody;

beforeEach(() => { eventRows = []; feedbackRows = []; jest.clearAllMocks(); });

describe('handleAdminUsers', () => {
  it('classifies devices into superuser / active / stuck / inactive', async () => {
    for (let i = 0; i < 30; i++) eventRows.push(ev('super', 'app_opened', ago(2)));
    eventRows.push(ev('super', 'evening_reflect_completed', ago(1)));     // ≥30 events + recent reflect
    eventRows.push(ev('act', 'app_opened', ago(0, 1)));                   // recent event only
    eventRows.push(ev('stk', 'onboarding_v2_started', ago(10)));          // entered onboarding, never finished, idle
    eventRows.push(ev('ina', 'app_opened', ago(10)));                     // old, no onboarding stage

    const b = await body(await handleAdminUsers(req('/v1/admin/users?days=30'), ENV, admin, CORS));
    expect(b.totals).toMatchObject({ all: 4, superuser: 1, active: 1, stuck: 1, inactive: 1 });
    const byId = Object.fromEntries(b.users.map((u) => [u.device_id, u.bucket]));
    expect(byId).toMatchObject({ super: 'superuser', act: 'active', stk: 'stuck', ina: 'inactive' });
  });

  it('filter returns only the requested bucket', async () => {
    eventRows.push(ev('act', 'app_opened', ago(0, 1)));
    eventRows.push(ev('ina', 'app_opened', ago(10)));
    const b = await body(await handleAdminUsers(req('/v1/admin/users?filter=active'), ENV, admin, CORS));
    expect(b.users).toHaveLength(1);
    expect(b.users.every((u) => u.bucket === 'active')).toBe(true);
  });

  it('clamps days to [1,90] and defaults invalid input to 30', async () => {
    expect((await body(await handleAdminUsers(req('/v1/admin/users?days=500'), ENV, admin, CORS))).window_days).toBe(90);
    expect((await body(await handleAdminUsers(req('/v1/admin/users?days=abc'), ENV, admin, CORS))).window_days).toBe(30);
  });

  it('counts feedback per device and never emits email/user_id (anonymity)', async () => {
    eventRows.push(ev('d1', 'app_opened', ago(1)));
    feedbackRows.push({ device_id: 'd1' }, { device_id: 'd1' }, { device_id: null });
    const res = await handleAdminUsers(req('/v1/admin/users'), ENV, admin, CORS);
    const b = await body(res);
    expect(b.users.find((u) => u.device_id === 'd1')?.feedback_count).toBe(2);
    expect(JSON.stringify(b)).not.toMatch(/"email"|user_id/);
  });
});
