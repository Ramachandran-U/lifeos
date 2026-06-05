/**
 * Admin AI-ops handler — per-task aggregation over ai_call / ai_schema_failure
 * events plus latest evals, and the schema-failure drill-down. Covers the task
 * bucketing + failure-rate sort, the per-model cost estimate, the weakest-suite
 * pick, the `task` param guard, sample filtering, and the 404. Supabase REST
 * mocked per-(table, query) at pgSelect.
 */
import { handleAdminAiOps } from '../aiOps';
import type { AdminClaims } from '../../../lib/adminAuth';
import type { SupabaseEnv } from '../../../lib/supabase';

interface EventRow { props: Record<string, unknown>; ts: string; app_version?: string | null; platform?: string | null; }
interface EvalRow { branch: string; commit_sha: string; generated_at: string; mode: 'MOCK' | 'LIVE'; total_cases: number; passed_cases: number; suites: Array<{ name: string; passRate: number; status: string; cases: number }>; }

let callRows: EventRow[] = [];
let failureRows: EventRow[] = [];
let evalRows: EvalRow[] = [];
const pgSelect = jest.fn(async (_e: unknown, table: string, query: string): Promise<unknown[]> => {
  if (table === 'eval_reports') return evalRows;
  if (table === 'telemetry_events' && query.includes('event=eq.ai_call')) return callRows;
  if (table === 'telemetry_events' && query.includes('event=eq.ai_schema_failure')) return failureRows;
  return [];
});
jest.mock('../../../lib/supabase', () => ({ pgSelect: (e: unknown, t: string, q: string) => pgSelect(e, t, q) }));

interface OpsBody {
  window_days: number;
  tasks: Array<{ task: string; calls: number; failures: number; failure_rate: number; avg_input_tokens: number; est_cost_inr: number; models: string[] }>;
  evals: Array<{ commit_sha: string; pass_rate: number; weakest_suite: { name: string } | null }>;
  totals: { calls: number; failures: number; failure_rate: number; cost_inr: number };
}
interface FailuresBody { task: string; samples: Array<{ error: string; raw_preview: string; schema: string; app_version: string | null; platform: string | null }>; }

const CORS: HeadersInit = { 'Access-Control-Allow-Origin': '*' };
const ENV = {} as SupabaseEnv;
const admin: AdminClaims = { email: 'owner@x.test', role: 'owner' };
const req = (path: string): Request => new Request('https://w.test' + path, { method: 'GET' });
const body = async <T>(r: Response): Promise<T> => (await r.json()) as T;

beforeEach(() => { callRows = []; failureRows = []; evalRows = []; jest.clearAllMocks(); });

describe('handleAdminAiOps', () => {
  it('aggregates per-task calls/failures/cost, sorts by failure rate, and picks the weakest suite', async () => {
    callRows = [
      { props: { task: 'planDay', model: 'gemini-2.5-flash', input_tokens: 1_000_000, output_tokens: 1_000_000 }, ts: 't' },
      { props: { task: 'chat', model: 'gemini-2.5-flash-lite', input_tokens: 0, output_tokens: 0 }, ts: 't' },
    ];
    failureRows = [{ props: { task: 'planDay' }, ts: 't' }];
    evalRows = [{
      branch: 'lifeosv1', commit_sha: 'abcdef1234', generated_at: 'g', mode: 'LIVE', total_cases: 10, passed_cases: 8,
      suites: [{ name: 'strong', passRate: 0.9, status: 'pass', cases: 6 }, { name: 'weak', passRate: 0.5, status: 'fail', cases: 4 }],
    }];

    const b = await body<OpsBody>(await handleAdminAiOps(req('/v1/admin/ai-ops?days=7'), ENV, admin, CORS));
    expect(b.tasks[0]).toMatchObject({ task: 'planDay', calls: 1, failures: 1, failure_rate: 1, avg_input_tokens: 1_000_000 });
    expect(b.tasks[0].est_cost_inr).toBeCloseTo(269.08, 1); // 28.83 in + 240.25 out
    expect(b.tasks[0].models).toEqual(['gemini-2.5-flash']);
    expect(b.totals).toMatchObject({ calls: 2, failures: 1, failure_rate: 0.5 });
    expect(b.evals[0]).toMatchObject({ commit_sha: 'abcdef1', pass_rate: 0.8 });
    expect(b.evals[0].weakest_suite?.name).toBe('weak');
  });

  it('drill-down requires a task param (400)', async () => {
    const res = await handleAdminAiOps(req('/v1/admin/ai-ops/failures'), ENV, admin, CORS);
    expect(res.status).toBe(400);
  });

  it('drill-down returns only samples for the requested task', async () => {
    failureRows = [
      { props: { task: 'planDay', error: 'bad json', raw_preview: '{', schema: 'RoutineSchema' }, ts: 't1', app_version: '1.2', platform: 'web' },
      { props: { task: 'chat', error: 'other' }, ts: 't2', app_version: null, platform: null },
    ];
    const b = await body<FailuresBody>(await handleAdminAiOps(req('/v1/admin/ai-ops/failures?task=planDay'), ENV, admin, CORS));
    expect(b.task).toBe('planDay');
    expect(b.samples).toHaveLength(1);
    expect(b.samples[0]).toMatchObject({ error: 'bad json', raw_preview: '{', schema: 'RoutineSchema', app_version: '1.2', platform: 'web' });
  });

  it('returns 404 for an unknown sub-route', async () => {
    const res = await handleAdminAiOps(req('/v1/admin/ai-ops/bogus'), ENV, admin, CORS);
    expect(res.status).toBe(404);
  });
});
