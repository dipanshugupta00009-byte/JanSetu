-- ============================================================
-- JanSetu – Supabase Postgres schema
-- Run this in the Supabase SQL Editor (or via `npm run setup`).
-- Idempotent â€“ safe to run multiple times.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  email         text unique,
  phone         text unique,
  password_hash text not null,
  role          text not null default 'citizen'
                check (role in ('citizen','evaluator','institution','industry','admin')),
  org_name      text,
  district      text,
  language      text not null default 'hi' check (language in ('hi','en','sat')),
  last_login    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- problems
-- ---------------------------------------------------------------------------
create table if not exists public.problems (
  id            uuid primary key default gen_random_uuid(),
  public_id     text unique not null,
  user_id       uuid references public.users (id) on delete set null,
  title         text not null,
  category      text not null default 'others',
  sector        text,
  description   text not null,
  tags          text[] default '{}',
  status        text not null default 'submitted'
                check (status in ('submitted','under_review','info_needed','approved','rejected','escalated','assigned','in_progress','piloted','deployed','closed')),
  severity      integer not null default 0,
  votes         integer not null default 0,
  is_anonymous  boolean not null default false,
  location_lat  double precision,
  location_lng  double precision,
  district      text,
  block         text,
  village       text,
  address       text,
  media         jsonb default '[]',
  language      text not null default 'en',
  duplicate_of  uuid references public.problems (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_problems_status  on public.problems (status);
create index if not exists idx_problems_category on public.problems (category);
create index if not exists idx_problems_district on public.problems (district);

-- ---------------------------------------------------------------------------
-- votes (crowd validation)
-- ---------------------------------------------------------------------------
create table if not exists public.votes (
  id         uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.problems (id) on delete cascade,
  user_id    uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (problem_id, user_id)
);

-- ---------------------------------------------------------------------------
-- reviews (expert triage)
-- ---------------------------------------------------------------------------
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  problem_id  uuid not null references public.problems (id) on delete cascade,
  reviewer_id uuid references public.users (id) on delete set null,
  impact      integer not null default 0,
  feasibility integer not null default 0,
  innovation  integer not null default 0,
  resources   integer not null default 0,
  total       integer not null default 0,
  decision    text not null default 'request_info'
              check (decision in ('approve','reject','request_info','escalate')),
  comments    text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_reviews_problem on public.reviews (problem_id);-- ---------------------------------------------------------------------------
-- institutions (HEI)
-- ---------------------------------------------------------------------------
create table if not exists public.institutions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references public.users (id) on delete cascade,
  reg_no      text,
  domain_tags text[] default '{}',
  city        text,
  district    text,
  about       text,
  approved    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- industry_partners
-- ---------------------------------------------------------------------------
create table if not exists public.industry_partners (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null unique references public.users (id) on delete cascade,
  company_name     text,
  capabilities     text[] default '{}',
  interest_sectors text[] default '{}',
  funding_program  text,
  about            text,
  approved         boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- projects (lifecycle)
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  id             uuid primary key default gen_random_uuid(),
  public_id      text unique not null,
  problem_id     uuid not null references public.problems (id) on delete cascade,
  institution_id uuid references public.institutions (id) on delete set null,
  industry_id    uuid references public.users (id) on delete set null,
  title          text not null,
  status         text not null default 'assigned'
                 check (status in ('assigned','in_progress','piloted','deployed','closed','paused')),
  mentor_id      uuid references public.users (id) on delete set null,
  team           text[] default '{}',
  proposal_url   text,
  pilot_report_url text,
  final_url      text,
  start_date     timestamptz,
  due_date       timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_projects_status on public.projects (status);
create index if not exists idx_projects_problem on public.projects (problem_id);

-- ---------------------------------------------------------------------------
-- milestones
-- ---------------------------------------------------------------------------
create table if not exists public.milestones (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  title        text not null,
  type         text not null default 'other',
  status       text not null default 'submitted',
  due_date     timestamptz,
  submitted_at timestamptz not null default now(),
  file_url     text,
  notes        text
);

-- ---------------------------------------------------------------------------
-- messages (per-project communication)
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id    uuid references public.users (id) on delete set null,
  body       text not null,
  created_at timestamptz not null default now()
);
-- ---------------------------------------------------------------------------
-- collabs (industry offers)
-- ---------------------------------------------------------------------------
create table if not exists public.collabs (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects (id) on delete cascade,
  org_id         uuid references public.industry_partners (id) on delete set null,
  role           text not null default 'industry',
  title          text not null,
  description    text,
  funding_amount numeric,
  status         text not null default 'pending'
                 check (status in ('pending','accepted','declined')),
  created_at     timestamptz not null default now()
);
-- ---------------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.users (id) on delete set null,
  action     text not null,
  entity     text,
  entity_id  text,
  ip         text,
  meta       jsonb default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_created on public.audit_logs (created_at desc);

-- ============================================================
-- Row Level Security
-- The backend uses the service_role key (bypasses RLS).
-- These policies make the tables safe if exposed via PostgREST.
-- ============================================================
alter table public.users              enable row level security;
alter table public.problems           enable row level security;
alter table public.votes              enable row level security;
alter table public.reviews            enable row level security;
alter table public.institutions       enable row level security;
alter table public.industry_partners  enable row level security;
alter table public.projects           enable row level security;
alter table public.milestones         enable row level security;
alter table public.messages           enable row level security;
alter table public.collabs            enable row level security;
alter table public.audit_logs         enable row level security;

drop policy if exists "public read problems" on public.problems;
create policy "public read problems" on public.problems
  for select using (status <> 'rejected');

drop policy if exists "anyone can register" on public.users;
create policy "anyone can register" on public.users
  for insert with check (true);
