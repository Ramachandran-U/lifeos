-- LifeOS admin portal — Phase 3 schema: anonymous opt-in telemetry.
--
-- DESIGN INTENT (kept here as a load-bearing reminder):
--   * Anonymous-only. The `device_id` is a UUID generated client-side and
--     stored locally; it must NEVER be linked to user id, email, or name.
--   * Opt-in only. Default state in the app is OFF. Users explicitly toggle
--     it on from Settings. The privacy doc covers this.
--   * Worker is the only writer. Service-role bypasses RLS; consumer + admin
--     browsers never touch this table directly.
--   * Event names + prop shapes are allowlisted server-side in the Worker.
--     Unknown names get rejected, not silently stored.

create table if not exists telemetry_events (
  id           bigserial primary key,
  device_id    text   not null,
  event        text   not null,
  props        jsonb  not null default '{}'::jsonb,
  app_version  text,
  platform     text,
  ts           timestamptz not null default now()
);

-- Funnel + DAU queries scan by (event, ts) and aggregate by device_id.
create index if not exists telemetry_events_event_ts_idx on telemetry_events (event, ts desc);
create index if not exists telemetry_events_device_ts_idx on telemetry_events (device_id, ts desc);
create index if not exists telemetry_events_ts_idx       on telemetry_events (ts desc);

-- RLS lockdown — see docs/SECURITY.md § 2.
alter table telemetry_events enable row level security;
comment on table telemetry_events is 'RLS: deny by default. Anonymous opt-in telemetry. Worker (service-role) is the only writer; admin dashboards read via /v1/admin/* routes.';
