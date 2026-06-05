/**
 * Admin prompt-registry handler. Covers the list, the per-key detail (+404),
 * the role-gated version create (next-version computation + audit) and the
 * activate flow (archive current active → activate target, +404 / bad-version
 * guards), plus the 405 fall-through. Supabase REST mocked per-(table, query)
 * at pgSelect/pgInsert/pgUpdate; writeAudit runs for real onto pgInsert.
 */
import { handleAdminPrompts } from '../prompts';
import type { AdminClaims } from '../../../lib/adminAuth';
import type { SupabaseEnv } from '../../../lib/supabase';

interface Row { id: string; version?: number; status?: string; key?: string; }

let promptsList: Row[] = [];
let promptLookup: Row[] = [];
let versionsList: Row[] = [];
let maxVersionRows: Row[] = [];
let activeRows: Row[] = [];
let createdVersion: Row = { id: 'v-new' };
let activatedResult: Row[] = [];

const pgSelect = jest.fn(async (_e: unknown, table: string, query: string): Promise<unknown[]> => {
  if (table === 'prompts') return query.includes('key=eq.') ? promptLookup : promptsList;
  if (query.includes('status=eq.active')) return activeRows;
  if (query.includes('limit=1')) return maxVersionRows;
  return versionsList;
});
const pgInsert = jest.fn(async (_e: unknown, table: string): Promise<unknown> => (table === 'prompt_versions' ? createdVersion : undefined));
const pgUpdate = jest.fn(async (_e: unknown, _t: string, query: string): Promise<unknown[]> => (query.includes('version=eq.') ? activatedResult : []));
jest.mock('../../../lib/supabase', () => ({
  pgSelect: (e: unknown, t: string, q: string) => pgSelect(e, t, q),
  pgInsert: (e: unknown, t: string, r: unknown) => pgInsert(e, t, r),
  pgUpdate: (e: unknown, t: string, q: string, p: unknown) => pgUpdate(e, t, q, p),
}));

const CORS: HeadersInit = { 'Access-Control-Allow-Origin': '*' };
const ENV = {} as SupabaseEnv;
const owner: AdminClaims = { email: 'owner@x.test', role: 'owner' };
const support: AdminClaims = { email: 'support@x.test', role: 'support' };
const req = (method: string, path: string, body?: unknown): Request =>
  new Request('https://w.test' + path, { method, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });

beforeEach(() => {
  promptsList = []; promptLookup = [{ id: 'p1', key: 'k' }]; versionsList = [];
  maxVersionRows = []; activeRows = []; createdVersion = { id: 'v-new' }; activatedResult = [];
  jest.clearAllMocks();
});

describe('handleAdminPrompts', () => {
  it('GET lists all prompts', async () => {
    promptsList = [{ id: 'p1', key: 'a' }, { id: 'p2', key: 'b' }];
    const b = (await (await handleAdminPrompts(req('GET', '/v1/admin/prompts'), ENV, owner, CORS)).json()) as { prompts: Row[] };
    expect(b.prompts).toHaveLength(2);
  });

  it('GET :key returns the prompt with its versions', async () => {
    versionsList = [{ id: 'v2', version: 2 }, { id: 'v1', version: 1 }];
    const b = (await (await handleAdminPrompts(req('GET', '/v1/admin/prompts/k'), ENV, owner, CORS)).json()) as { prompt: Row; versions: Row[] };
    expect(b.prompt.id).toBe('p1');
    expect(b.versions).toHaveLength(2);
  });

  it('GET :key returns 404 when the prompt is unknown', async () => {
    promptLookup = [];
    const res = await handleAdminPrompts(req('GET', '/v1/admin/prompts/missing'), ENV, owner, CORS);
    expect(res.status).toBe(404);
  });

  it('POST versions is forbidden for support (403)', async () => {
    const res = await handleAdminPrompts(req('POST', '/v1/admin/prompts/k/versions', { body: 'x' }), ENV, support, CORS);
    expect(res.status).toBe(403);
  });

  it('POST versions requires a body (400)', async () => {
    const res = await handleAdminPrompts(req('POST', '/v1/admin/prompts/k/versions', { notes: 'no body' }), ENV, owner, CORS);
    expect(res.status).toBe(400);
  });

  it('POST versions creates the next version and writes an audit row', async () => {
    maxVersionRows = [{ id: 'v2', version: 2 }];
    createdVersion = { id: 'v3', version: 3 };
    const res = await handleAdminPrompts(req('POST', '/v1/admin/prompts/k/versions', { body: 'new prompt text', notes: 'n' }), ENV, owner, CORS);
    expect(res.status).toBe(200);
    expect(pgInsert).toHaveBeenCalledWith(ENV, 'prompt_versions',
      expect.objectContaining({ version: 3, body: 'new prompt text', status: 'draft', created_by: owner.email }));
    expect(pgInsert).toHaveBeenCalledWith(ENV, 'audit_log', expect.objectContaining({ action: 'prompt.version.create' }));
  });

  it('POST activate archives the current active version then activates the target', async () => {
    activeRows = [{ id: 'v-old', version: 4, status: 'active' }];
    activatedResult = [{ id: 'v-new', version: 5, status: 'active' }];
    const res = await handleAdminPrompts(req('POST', '/v1/admin/prompts/k/versions/5/activate'), ENV, owner, CORS);
    expect(res.status).toBe(200);
    // archive the old active (id=eq.v-old → status archived) + activate target (version=eq.5)
    expect(pgUpdate).toHaveBeenCalledWith(ENV, 'prompt_versions', 'id=eq.v-old', { status: 'archived' });
    expect(pgUpdate).toHaveBeenCalledWith(ENV, 'prompt_versions', 'prompt_id=eq.p1&version=eq.5', { status: 'active' });
    expect(pgInsert).toHaveBeenCalledWith(ENV, 'audit_log', expect.objectContaining({ action: 'prompt.version.activate' }));
  });

  it('POST activate returns 404 when the target version does not exist', async () => {
    activatedResult = [];
    const res = await handleAdminPrompts(req('POST', '/v1/admin/prompts/k/versions/9/activate'), ENV, owner, CORS);
    expect(res.status).toBe(404);
  });

  it('POST activate rejects a non-numeric version (400)', async () => {
    const res = await handleAdminPrompts(req('POST', '/v1/admin/prompts/k/versions/abc/activate'), ENV, owner, CORS);
    expect(res.status).toBe(400);
  });

  it('falls through to 405 for an unsupported method', async () => {
    const res = await handleAdminPrompts(req('DELETE', '/v1/admin/prompts/k'), ENV, owner, CORS);
    expect(res.status).toBe(405);
  });
});
