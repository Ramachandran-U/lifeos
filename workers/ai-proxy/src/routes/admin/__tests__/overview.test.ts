/**
 * Admin operator-dashboard aggregation handler. Covers the DAU/WAU rollup, the
 * activation funnel + conversion, engagement (blocks, evening-reflect rate), the
 * AI cost estimate (per-model Gemini pricing + unknown-model fallback), LIVE-vs-
 * MOCK eval preference, the days clamp, and the divide-by-zero-safe empty case.
 * Supabase REST mocked per-table at pgSelect.
 */
import { handleAdminOverview } from '../overview';
import type { AdminClaims } from '../../../lib/adminAuth';
import type { SupabaseEnv } from '../../../lib/supabase';

interface TelemetryRow { device_id: string; event: string; props: Record<string, unknown>; ts: string; }
interface EvalRow { branch: string; commit_sha: string; generated_at: string; mode: 'MOCK' | 'LIVE'; total_cases: number; passed_cases: number; }

let events: TelemetryRow[] = [];
let feedbackRows: { id: number }[] = [];
let evalRows: EvalRow[] = [];
const pgSelect = jest.fn(async (_e: unknown, table: string, _q: string): Promise<unknown[]> => {
  if (table === 'telemetry_events') return events;
  if (table === 'feedback') return feedbackRows;
  if (table === 'eval_reports') return evalRows;
  return [];
});
jest.mock('../../../lib/supabase', () => ({ pgSelect: (e: unknown, t: string, q: string) => pgSelect(e, t, q) }));

interface OverviewBody {
  window_days: number;
  users: { dau: number; wau: number };
  funnel: { top_devices: number; stages: Array<{ key: string; devices: number; conversion_from_top: number }> };
  engagement: { blocks_completed_yesterday: number; blocks_completed_7d: number; evening_reflect_rate_7d: number };
  ai: { calls_7d: number; schema_failures_7d: number; schema_failure_rate_7d: number; est_cost_inr_7d: number; latest_eval: { mode: string; pass_rate: number } | null };
  feedback: { new_count: number };
  sample_size: number;
}

const CORS: HeadersInit = { 'Access-Control-Allow-Origin': '*' };
const ENV = {} as SupabaseEnv;
const admin: AdminClaims = { email: 'owner@x.test', role: 'owner' };
const req = (path = '/v1/admin/overview'): Request => new Request('https://w.test' + path, { method: 'GET' });
const ago = (days: number, hours = 0): string => new Date(Date.now() - days * 86_400_000 - hours * 3_600_000).toISOString();
const ev = (device_id: string, event: string, ts: string, props: Record<string, unknown> = {}): TelemetryRow => ({ device_id, event, ts, props });
const body = async (r: Response): Promise<OverviewBody> => (await r.json()) as OverviewBody;

beforeEach(() => { events = []; feedbackRows = []; evalRows = []; jest.clearAllMocks(); });

describe('handleAdminOverview', () => {
  it('aggregates users, funnel, engagement, AI cost and feedback', async () => {
    events.push(ev('d1', 'app_opened', ago(0, 2)));               // dau + wau
    events.push(ev('d2', 'app_opened', ago(5)));                  // wau only
    events.push(ev('d1', 'onboarding_v2_started', ago(0, 2)));
    events.push(ev('d1', 'slot_filled', ago(0, 1)));
    events.push(ev('d2', 'onboarding_v2_started', ago(5)));       // funnel top = 2
    events.push(ev('d1', 'routine_block_completed', ago(0, 3)));  // today
    events.push(ev('d1', 'routine_block_completed', ago(1, 1)));  // yesterday window
    events.push(ev('d1', 'evening_reflect_completed', ago(0, 4)));
    events.push(ev('d1', 'ai_call', ago(0, 5), { model: 'gemini-2.5-flash', input_tokens: 1_000_000, output_tokens: 1_000_000 }));
    events.push(ev('d1', 'ai_schema_failure', ago(0, 5)));
    feedbackRows.push({ id: 1 }, { id: 2 });
    evalRows.push({ branch: 'lifeosv1', commit_sha: 'abcdef1234', generated_at: ago(0), mode: 'LIVE', total_cases: 10, passed_cases: 9 });

    const b = await body(await handleAdminOverview(req(), ENV, admin, CORS));
    expect(b.users).toEqual({ dau: 1, wau: 2 });
    expect(b.funnel.top_devices).toBe(2);
    expect(b.funnel.stages[1]).toMatchObject({ key: 'v2_slot_filled', devices: 1, conversion_from_top: 0.5 });
    expect(b.engagement).toMatchObject({ blocks_completed_7d: 2, blocks_completed_yesterday: 1, evening_reflect_rate_7d: 0.5 });
    expect(b.ai.calls_7d).toBe(1);
    expect(b.ai.schema_failure_rate_7d).toBe(1);
    expect(b.ai.est_cost_inr_7d).toBeCloseTo(269.08, 1); // 28.83 in + 240.25 out per 1M
    expect(b.feedback.new_count).toBe(2);
    expect(b.ai.latest_eval).toMatchObject({ mode: 'LIVE', pass_rate: 0.9 });
  });

  it('clamps days to [1,30] and defaults invalid input to 7', async () => {
    expect((await body(await handleAdminOverview(req('/v1/admin/overview?days=999'), ENV, admin, CORS))).window_days).toBe(30);
    expect((await body(await handleAdminOverview(req('/v1/admin/overview?days=xyz'), ENV, admin, CORS))).window_days).toBe(7);
  });

  it('falls back to the default price for an unknown model', async () => {
    events.push(ev('d', 'ai_call', ago(0, 1), { model: 'mystery-model', input_tokens: 1_000_000, output_tokens: 0 }));
    const b = await body(await handleAdminOverview(req(), ENV, admin, CORS));
    expect(b.ai.est_cost_inr_7d).toBeCloseTo(144.15, 1); // FALLBACK_PRICE.in
  });

  it('prefers a LIVE eval over a more recent MOCK', async () => {
    evalRows.push(
      { branch: 'b', commit_sha: '1111111', generated_at: ago(0), mode: 'MOCK', total_cases: 10, passed_cases: 10 },
      { branch: 'b', commit_sha: '2222222', generated_at: ago(1), mode: 'LIVE', total_cases: 4, passed_cases: 2 },
    );
    const b = await body(await handleAdminOverview(req(), ENV, admin, CORS));
    expect(b.ai.latest_eval).toMatchObject({ mode: 'LIVE', pass_rate: 0.5 });
  });

  it('returns zeros (no divide-by-zero) when there is no data', async () => {
    const b = await body(await handleAdminOverview(req(), ENV, admin, CORS));
    expect(b.users).toEqual({ dau: 0, wau: 0 });
    expect(b.ai.schema_failure_rate_7d).toBe(0);
    expect(b.engagement.evening_reflect_rate_7d).toBe(0);
    expect(b.ai.latest_eval).toBeNull();
    expect(b.feedback.new_count).toBe(0);
  });
});
