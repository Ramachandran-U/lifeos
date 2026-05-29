-- LifeOS AI cost ledger — Worker-side per-call usage record.
--
-- DESIGN INTENT:
--   * One row per successful /claude call, written via ctx.waitUntil so the
--     user-facing response isn't blocked.
--   * Stores raw usage (input / output / cache tokens) + provider + model.
--     Cost is computed at query time using src/ai/costLedger.PRICING — this
--     keeps the Worker free of pricing logic that has to stay in sync with
--     the client SDK and the eval harness.
--   * `task` is the call-site label the client passes (e.g. 'generateRoutine',
--     'suggestTomorrowTweak') so admin charts can break cost down by feature.
--   * RLS: Worker (service-role) writes; admin dashboards read via the
--     /v1/admin/* routes that already verify the JWT.

create table if not exists ai_cost_events (
  id                     bigserial primary key,
  user_id                uuid not null,
  task                   text,                    -- nullable: client may omit
  provider               text not null,           -- 'anthropic' | 'gemini' | 'openai' | 'groq'
  model                  text not null,
  input_tokens           integer not null default 0,
  output_tokens          integer not null default 0,
  cache_read_tokens      integer not null default 0,
  cache_creation_tokens  integer not null default 0,
  ts                     timestamptz not null default now()
);

-- Per-user daily spend queries scan by (user_id, ts).
create index if not exists ai_cost_events_user_ts_idx on ai_cost_events (user_id, ts desc);
-- Per-task breakdowns scan by (task, ts).
create index if not exists ai_cost_events_task_ts_idx on ai_cost_events (task, ts desc);
-- Cohort-level daily aggregates scan by ts alone.
create index if not exists ai_cost_events_ts_idx       on ai_cost_events (ts desc);

alter table ai_cost_events enable row level security;
comment on table ai_cost_events is 'RLS: deny by default. Worker (service-role) is the only writer; admin dashboards read via /v1/admin/* routes.';
