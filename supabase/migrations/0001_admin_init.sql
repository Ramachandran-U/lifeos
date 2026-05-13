-- LifeOS admin portal — Phase 1 schema.
-- Tables: admins, audit_log, flags, flag_overrides.
-- All access goes through the Cloudflare Worker using the service role.
-- The anon role gets zero direct read/write access — RLS lockdown below.

-- ─── admins ────────────────────────────────────────────────────────────────
create table if not exists admins (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  role        text not null check (role in ('owner', 'editor', 'support')),
  added_by    text,
  added_at    timestamptz not null default now(),
  last_login  timestamptz
);

create index if not exists admins_email_idx on admins (lower(email));

-- ─── audit_log ─────────────────────────────────────────────────────────────
create table if not exists audit_log (
  id           bigserial primary key,
  actor_email  text not null,
  action       text not null,
  target_type  text not null,
  target_id    text,
  before       jsonb,
  after        jsonb,
  ts           timestamptz not null default now()
);

create index if not exists audit_log_ts_idx on audit_log (ts desc);
create index if not exists audit_log_actor_idx on audit_log (actor_email, ts desc);

-- ─── flags ─────────────────────────────────────────────────────────────────
create table if not exists flags (
  id             uuid primary key default gen_random_uuid(),
  key            text not null unique,
  type           text not null check (type in ('bool', 'cohort_pct', 'enum')),
  default_value  jsonb not null,
  status         text not null default 'active' check (status in ('active', 'killed')),
  description    text,
  updated_by     text,
  updated_at     timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

-- ─── flag_overrides ────────────────────────────────────────────────────────
-- scope_json examples:
--   { "platform": "ios" }
--   { "app_version_lt": "1.4.0" }
--   { "tester_email": "ramachandran.u@vearc.com" }
create table if not exists flag_overrides (
  id          uuid primary key default gen_random_uuid(),
  flag_id     uuid not null references flags(id) on delete cascade,
  scope_json  jsonb not null,
  value       jsonb not null,
  updated_by  text,
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index if not exists flag_overrides_flag_idx on flag_overrides (flag_id);

-- ─── RLS lockdown ─────────────────────────────────────────────────────────
-- DESIGN: deny by default. These tables are reachable ONLY through the
-- Cloudflare Worker, which holds the service-role key. The anon and
-- authenticated Postgres roles get zero direct access. If you ever add a
-- CREATE POLICY here without re-reading docs/SECURITY.md, you are wrong.
alter table admins         enable row level security;
alter table audit_log      enable row level security;
alter table flags          enable row level security;
alter table flag_overrides enable row level security;

comment on table admins         is 'RLS: deny by default. Access only via service-role through the Worker.';
comment on table audit_log      is 'RLS: deny by default. Access only via service-role through the Worker.';
comment on table flags          is 'RLS: deny by default. Access only via service-role through the Worker.';
comment on table flag_overrides is 'RLS: deny by default. Access only via service-role through the Worker.';

-- ─── seed flags ────────────────────────────────────────────────────────────
insert into flags (key, type, default_value, description) values
  ('discovery_import_enabled', 'bool', 'true'::jsonb,  'Show Discovery Import shortcut on welcome-intent'),
  ('chatbot_beta',             'bool', 'false'::jsonb, 'Enable in-app AI chatbot (beta cohort)'),
  ('gmail_finance_enabled',    'bool', 'true'::jsonb,  'Allow Gmail-based finance transaction sync'),
  ('evening_reflect_enabled',  'bool', 'true'::jsonb,  'Show evening reflect 18:00 CTA on Home'),
  ('polymath_enabled',         'bool', 'true'::jsonb,  'Show the Explore (Polymath) tab')
on conflict (key) do nothing;

-- Seed the first owner.
-- IMPORTANT: this only inserts the *whitelist row*. The corresponding
-- auth.users record must be created via the Supabase Admin "Invite User"
-- flow (see docs/SECURITY.md § Admin onboarding). Do NOT set a password
-- by directly updating auth.users.encrypted_password — that bypasses email
-- verification, MFA enrolment, and the password-rotation pipeline.
insert into admins (email, role, added_by) values
  ('ramachandran.u@vearc.com', 'owner', 'bootstrap')
on conflict (email) do nothing;
