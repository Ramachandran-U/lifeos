-- LifeOS admin portal — Phase 4b (design C): surface CI eval pass rates.
--
-- The eval harness already runs on every PR touching `src/ai/**` and on
-- pushes to lifeosv1. This table is where the GitHub Action writes the
-- result so admins can see pass rates without leaving the portal.

create table if not exists eval_reports (
  id           bigserial primary key,
  branch       text not null,
  commit_sha   text not null,
  generated_at timestamptz not null default now(),
  mode         text not null check (mode in ('MOCK', 'LIVE')),
  -- Per-suite summary, shape: [{name, passRate, threshold, status, cases}]
  suites       jsonb not null,
  -- Optional links to deeper info.
  workflow_url text,
  -- Headline numbers cached for cheap list queries.
  total_cases  int  not null default 0,
  passed_cases int  not null default 0,
  unique (branch, commit_sha, mode)
);

create index if not exists eval_reports_branch_ts_idx on eval_reports (branch, generated_at desc);
create index if not exists eval_reports_ts_idx        on eval_reports (generated_at desc);

alter table eval_reports enable row level security;
comment on table eval_reports is 'RLS: deny by default. CI writes via /v1/admin/evals/report (token auth); admins read via /v1/admin/evals/latest.';
