/**
 * P1-T5 cross-device sync — Worker side.
 *
 * Two routes, both behind the Bearer-auth gate in index.ts (so `userId` is the
 * verified jwt.sub):
 *
 *   POST /v1/sync/push  body { mutations: MutationRecord[] }  -> { acked: string[] }
 *   GET  /v1/sync/pull  ?since=<lamport>&limit=<n>           -> { mutations, cursor }
 *
 * SECURITY: the client's `userId` field is NEVER trusted — every stored row's
 * user_id is forced to the JWT subject, and pull is scoped to it. So even a
 * malicious client cannot write into or read another user's stream.
 *
 * The wire shape is the on-device MutationRecord (camelCase). The server stores
 * the snake_case mirror (see migration 0007); before/after are stringified into
 * *_json columns here. Upsert-by-id is idempotent, so re-pushing is safe.
 */

import type { Env } from '../index';
import { pgUpsert, pgSelect } from '../lib/supabase';

const MAX_PUSH_BATCH = 500;
const DEFAULT_PULL_LIMIT = 500;
const MAX_PULL_LIMIT = 1000;

interface WireMutation {
  id: string;
  entity: string;
  entityId: string;
  op: 'insert' | 'update' | 'delete';
  before: unknown;
  after: unknown;
  fields?: string[];
  ts: string;
  lamport: number;
  deviceId: string;
  prevHash: string | null;
  hash: string;
}

function isValidMutation(m: unknown): m is WireMutation {
  if (typeof m !== 'object' || m === null) return false;
  const r = m as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.entity === 'string' &&
    typeof r.entityId === 'string' &&
    (r.op === 'insert' || r.op === 'update' || r.op === 'delete') &&
    typeof r.ts === 'string' &&
    typeof r.lamport === 'number' &&
    Number.isFinite(r.lamport) &&
    typeof r.deviceId === 'string' &&
    typeof r.hash === 'string'
  );
}

export async function handleSyncPush(
  req: Request,
  env: Env,
  userId: string,
  cors: HeadersInit,
): Promise<Response> {
  let body: { mutations?: unknown };
  try {
    body = (await req.json()) as { mutations?: unknown };
  } catch {
    return resp({ error: 'invalid JSON' }, 400, cors);
  }

  const list = body.mutations;
  if (!Array.isArray(list)) return resp({ error: 'mutations must be an array' }, 400, cors);
  if (list.length === 0) return resp({ acked: [] }, 200, cors);
  if (list.length > MAX_PUSH_BATCH) {
    return resp({ error: `batch too large (max ${MAX_PUSH_BATCH})` }, 413, cors);
  }
  if (!list.every(isValidMutation)) {
    return resp({ error: 'malformed mutation in batch' }, 400, cors);
  }

  const mutations = list as WireMutation[];
  const rows = mutations.map((m) => ({
    id: m.id,
    user_id: userId, // forced — client value ignored
    entity: m.entity,
    entity_id: m.entityId,
    op: m.op,
    before_json: m.before == null ? null : JSON.stringify(m.before),
    after_json: m.after == null ? null : JSON.stringify(m.after),
    fields_json: JSON.stringify(Array.isArray(m.fields) ? m.fields : []),
    ts: m.ts,
    lamport: m.lamport,
    device_id: m.deviceId,
    prev_hash: m.prevHash ?? null,
    hash: m.hash,
  }));

  try {
    await pgUpsert(env, 'mutations', rows);
  } catch (e) {
    console.error('sync push upsert failed:', e);
    return resp({ error: 'push failed' }, 500, cors);
  }

  return resp({ acked: mutations.map((m) => m.id) }, 200, cors);
}

interface DbRow {
  id: string;
  user_id: string;
  entity: string;
  entity_id: string;
  op: 'insert' | 'update' | 'delete';
  before_json: string | null;
  after_json: string | null;
  fields_json: string | null;
  ts: string;
  lamport: number;
  device_id: string;
  prev_hash: string | null;
  hash: string;
  seq: number;
}

export async function handleSyncPull(
  req: Request,
  env: Env,
  userId: string,
  cors: HeadersInit,
): Promise<Response> {
  const url = new URL(req.url);
  const since = Number(url.searchParams.get('since') ?? '0');
  const sinceSeq = Number.isFinite(since) && since >= 0 ? Math.floor(since) : 0;
  const rawLimit = Number(url.searchParams.get('limit') ?? String(DEFAULT_PULL_LIMIT));
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(1, Math.floor(rawLimit)), MAX_PULL_LIMIT)
    : DEFAULT_PULL_LIMIT;

  // PostgREST: this user's rows with server seq > cursor, in seq order. seq is
  // gap-free, so this never skips a concurrent write or re-delivers one.
  const query =
    `user_id=eq.${encodeURIComponent(userId)}` +
    `&seq=gt.${sinceSeq}` +
    `&order=seq.asc&limit=${limit}&select=*`;

  let rows: DbRow[];
  try {
    rows = await pgSelect<DbRow>(env, 'mutations', query);
  } catch (e) {
    console.error('sync pull select failed:', e);
    return resp({ error: 'pull failed' }, 500, cors);
  }

  const parse = (j: string | null) => {
    if (j === null) return null;
    try { return JSON.parse(j); } catch { return null; }
  };
  // Wire shape is the on-device MutationRecord; `seq` stays server-side (the
  // client only needs the batch's max seq, returned as `cursor`).
  const mutations = rows.map((r) => ({
    id: r.id,
    entity: r.entity,
    entityId: r.entity_id,
    op: r.op,
    before: parse(r.before_json),
    after: parse(r.after_json),
    fields: (() => { try { return r.fields_json ? JSON.parse(r.fields_json) : []; } catch { return []; } })(),
    ts: r.ts,
    lamport: r.lamport,
    deviceId: r.device_id,
    userId: r.user_id,
    prevHash: r.prev_hash,
    hash: r.hash,
  }));

  const cursor = rows.length ? rows[rows.length - 1].seq : sinceSeq;
  return resp({ mutations, cursor }, 200, cors);
}

function resp(body: unknown, status: number, cors: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}
