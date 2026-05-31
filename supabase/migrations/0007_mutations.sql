-- LifeOS — P1-T5 cross-device sync: the `mutations` mirror table.
--
-- This is the server-side projection of the on-device event-sourced mutation
-- log (src/sync/mutationLog.ts). Each device PUSHES its pending mutations here
-- and PULLS everyone-else's, then folds them into local state via the reducer.
--
-- ACCESS MODEL — Worker-mediated, like every other table in this project:
--   * The Cloudflare Worker (service-role key) is the ONLY reader/writer.
--   * The consumer app never touches this table directly. It calls
--     POST /v1/sync/push and GET /v1/sync/pull on the Worker, which validates
--     the Supabase JWT and FORCES user_id = jwt.sub server-side (the client's
--     user_id is never trusted). So an RLS gap cannot leak cross-user data —
--     the Worker scopes every query. RLS is deny-by-default as a backstop.
--
-- Columns mirror the local snake_case schema (see initDatabase) plus a
-- server-side `created_at` receipt timestamp. `id` is the client-generated
-- nanoid, so re-pushing a row is an idempotent upsert (no duplicates).

create table if not exists mutations (
  id           text primary key,
  user_id      text not null,
  entity       text not null,
  entity_id    text not null,
  op           text not null check (op in ('insert', 'update', 'delete')),
  before_json  text,
  after_json   text,
  fields_json  text not null default '[]',
  ts           text not null,            -- ISO wall clock from the device (display/debug only)
  lamport      bigint not null,          -- authoritative logical ordering
  device_id    text not null,
  prev_hash    text,
  hash         text not null,
  created_at   timestamptz not null default now()  -- server receipt time
);

-- Pull scans by (user_id, lamport > cursor) ordered by lamport.
create index if not exists mutations_user_lamport_idx on mutations (user_id, lamport);

-- ─── RLS lockdown ─────────────────────────────────────────────────────────
-- DESIGN: deny by default. Reachable ONLY through the Worker's service-role
-- key. The anon and authenticated Postgres roles get zero direct access. This
-- is the FIRST per-user data table; if you are tempted to add a
-- `create policy ... using (auth.uid() = user_id)` for consumer-direct access,
-- re-read docs/SECURITY.md and the sync-transport decision first — the chosen
-- model is Worker-mediated precisely so RLS is a backstop, not the sole gate.
alter table mutations enable row level security;

comment on table mutations is 'RLS: deny by default. P1-T5 sync mirror. Access only via service-role through the Worker (/v1/sync/*); user_id is forced to jwt.sub server-side.';
