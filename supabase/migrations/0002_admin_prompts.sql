-- LifeOS admin portal — Phase 2 schema: prompt registry.
-- Mirrors the bundled prompts in src/ai/prompts/ but tracks history and
-- allows ops to draft + activate new versions without an app release.
-- Consumer integration (fetch live prompt at runtime) is deferred — for now
-- this table is a record of changes and a staging area for review.

-- ─── prompts ──────────────────────────────────────────────────────────────
create table if not exists prompts (
  id           uuid primary key default gen_random_uuid(),
  key          text not null unique,
  description  text,
  created_at   timestamptz not null default now()
);

-- ─── prompt_versions ──────────────────────────────────────────────────────
create table if not exists prompt_versions (
  id           uuid primary key default gen_random_uuid(),
  prompt_id    uuid not null references prompts(id) on delete cascade,
  version      int  not null,
  body         text not null,
  status       text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  notes        text,
  created_by   text,
  created_at   timestamptz not null default now(),
  unique (prompt_id, version)
);

create index if not exists prompt_versions_prompt_idx on prompt_versions (prompt_id, version desc);

-- Only one active version per prompt at a time.
create unique index if not exists prompt_versions_one_active_idx
  on prompt_versions (prompt_id) where status = 'active';

-- ─── RLS lockdown ─────────────────────────────────────────────────────────
alter table prompts          enable row level security;
alter table prompt_versions  enable row level security;

-- ─── seed: import bundled prompts as v1 active ───────────────────────────
insert into prompts (key, description) values
  ('discovery_extraction', 'Extracts structured profile JSON from a Discovery Prompt response'),
  ('discovery_user',       'The prompt the user pastes into ChatGPT/Claude to generate their self-description'),
  ('chatbot_system',       'System prompt for the in-app Ask LifeOS assistant')
on conflict (key) do nothing;

-- Bodies are seeded empty here so the SQL stays small; populate via the
-- admin UI's "import bundled" action, or paste them in manually as the
-- first version. This keeps the migration file from carrying long literals.
