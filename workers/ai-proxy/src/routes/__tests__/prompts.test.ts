/**
 * Public prompts endpoint — returns the active body per prompt key for the
 * consumer app to poll at startup. Covers the key-map build, the private
 * cache header, and the empty case. Supabase REST mocked at pgSelect.
 */
import { handlePrompts } from '../prompts';
import type { SupabaseEnv } from '../../lib/supabase';

interface ActiveVersionRow { body: string; version: number; prompts: { key: string }; }

let rows: ActiveVersionRow[] = [];
let lastQuery = '';
const pgSelect = jest.fn(async (_e: unknown, _t: string, query: string): Promise<unknown[]> => { lastQuery = query; return rows; });
jest.mock('../../lib/supabase', () => ({ pgSelect: (e: unknown, t: string, q: string) => pgSelect(e, t, q) }));

const CORS: HeadersInit = { 'Access-Control-Allow-Origin': '*' };
const ENV = {} as SupabaseEnv;
const req = (): Request => new Request('https://w.test/v1/prompts', { method: 'GET' });

beforeEach(() => { rows = []; lastQuery = ''; jest.clearAllMocks(); });

describe('handlePrompts', () => {
  it('builds a per-key map of the active prompt bodies', async () => {
    rows = [
      { body: 'goal system prompt', version: 3, prompts: { key: 'goalSystem' } },
      { body: 'chat system prompt', version: 1, prompts: { key: 'chatSystem' } },
    ];
    const res = await handlePrompts(req(), ENV, CORS);
    expect(res.status).toBe(200);
    expect(lastQuery).toContain('status=eq.active');
    const b = (await res.json()) as { prompts: Record<string, { body: string; version: number }>; fetched_at: string };
    expect(b.prompts).toEqual({
      goalSystem: { body: 'goal system prompt', version: 3 },
      chatSystem: { body: 'chat system prompt', version: 1 },
    });
    expect(typeof b.fetched_at).toBe('string');
  });

  it('sets a private 5-minute cache header', async () => {
    const res = await handlePrompts(req(), ENV, CORS);
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=300');
  });

  it('returns an empty map when no prompt has an active version', async () => {
    rows = [];
    const b = (await (await handlePrompts(req(), ENV, CORS)).json()) as { prompts: Record<string, unknown> };
    expect(b.prompts).toEqual({});
  });
});
