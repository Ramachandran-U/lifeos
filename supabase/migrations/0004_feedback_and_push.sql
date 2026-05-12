-- LifeOS admin portal — Phase 5: feedback inbox + push broadcast.
--
-- Two tables, same trust model as the rest of the admin schema:
--   * RLS enabled, zero policies → service-role-only access via the Worker.
--   * Consumer app submits new rows through public Worker endpoints
--     (`POST /v1/feedback`, `POST /v1/push/register`); the Worker is the
--     only writer.
--   * Admin reads / mutates via `/v1/admin/*` gated routes.

-- ─── feedback ─────────────────────────────────────────────────────────────
create table if not exists feedback (
  id            bigserial primary key,
  -- Optional reply-to. Anonymous submissions allowed; if the user signs in
  -- they may include their email. Never linked back to telemetry device_id.
  from_email    text,
  subject       text,
  body          text not null,
  -- 'app'  = submitted via in-app form
  -- 'email'= future: pulled from Gmail
  source        text not null default 'app' check (source in ('app', 'email')),
  status        text not null default 'new'
                check (status in ('new', 'triaged', 'responded', 'closed')),
  assigned_to   text,
  -- Free-form admin notes; not user-visible.
  notes         text,
  -- Anonymous device id (telemetry-style). May be null for older clients.
  device_id     text,
  -- App context at submission time.
  app_version   text,
  platform      text,
  received_at   timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists feedback_status_idx       on feedback (status, received_at desc);
create index if not exists feedback_received_idx     on feedback (received_at desc);
create index if not exists feedback_assigned_idx     on feedback (assigned_to, status) where assigned_to is not null;

alter table feedback enable row level security;
comment on table feedback is 'RLS: deny by default. Worker writes new rows; admin /v1/admin/feedback/* mutates.';

-- ─── expo_push_tokens ──────────────────────────────────────────────────────
-- Push token registry. Token IS the unique identifier — never linked back
-- to user_id (so a logout/login can register the same token under a new
-- session). One row per device.
create table if not exists expo_push_tokens (
  id            uuid primary key default gen_random_uuid(),
  token         text not null unique,
  platform      text,
  app_version   text,
  -- Anonymous device id from the telemetry SDK (when available). Used for
  -- de-duping across reinstalls and joining with telemetry events.
  device_id     text,
  last_seen     timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  -- Soft-deletes for tokens that Expo Push reports as invalid.
  invalid_at    timestamptz
);

create index if not exists expo_push_tokens_platform_idx on expo_push_tokens (platform) where invalid_at is null;
create index if not exists expo_push_tokens_last_seen_idx on expo_push_tokens (last_seen desc) where invalid_at is null;

alter table expo_push_tokens enable row level security;
comment on table expo_push_tokens is 'RLS: deny by default. Consumer registers via /v1/push/register; admin reads via /v1/admin/push.';
