-- NPE Study Club starter schema (Supabase)

create extension if not exists pgcrypto;

create table if not exists public.approved_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text,
  status text not null default 'pending' check (status in ('pending','approved','revoked')),
  role text default 'member',
  date_requested timestamptz,
  date_approved timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  email text not null,
  reason text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  domain text,
  subtopic text,
  content_type text,
  modality text,
  population text,
  source text,
  notes text,
  file_path text,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'Ad-hoc',
  session_no text,
  session_date date not null,
  session_time text,
  topic text,
  notes text,
  meet_link text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Timestamp helper
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_approved_users_updated_at on public.approved_users;
create trigger trg_approved_users_updated_at
before update on public.approved_users
for each row execute function public.touch_updated_at();

-- Approval check helper
create or replace function public.is_approved_user(uid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.approved_users au
    join auth.users u on lower(u.email) = lower(au.email)
    where u.id = uid
      and au.status = 'approved'
  );
$$;

alter table public.approved_users enable row level security;
alter table public.user_requests enable row level security;
alter table public.resources enable row level security;
alter table public.sessions enable row level security;

-- approved_users: only authenticated users can read own row; admins can be added later
create policy approved_users_select_self
on public.approved_users
for select
to authenticated
using (lower(email) = lower(auth.jwt()->>'email'));

-- user_requests: anyone can submit request; only approved users can read (or tighten later)
create policy user_requests_insert_public
on public.user_requests
for insert
to anon, authenticated
with check (true);

create policy user_requests_select_approved
on public.user_requests
for select
to authenticated
using (public.is_approved_user(auth.uid()));

-- resources visible only to approved members
create policy resources_select_approved
on public.resources
for select
to authenticated
using (public.is_approved_user(auth.uid()));

create policy resources_insert_approved
on public.resources
for insert
to authenticated
with check (public.is_approved_user(auth.uid()));

-- sessions visible only to approved members
create policy sessions_select_approved
on public.sessions
for select
to authenticated
using (public.is_approved_user(auth.uid()));

create policy sessions_insert_approved
on public.sessions
for insert
to authenticated
with check (public.is_approved_user(auth.uid()));

-- Storage (run in SQL editor):
-- 1) create private bucket named "npe-study-club-files"
-- 2) policies:
--   read only for approved users
--   upload only for approved users

-- Example storage read policy:
-- create policy kb_files_read_approved
-- on storage.objects
-- for select
-- to authenticated
-- using (
--   bucket_id = 'npe-study-club-files'
--   and public.is_approved_user(auth.uid())
-- );

-- Example storage insert policy:
-- create policy kb_files_insert_approved
-- on storage.objects
-- for insert
-- to authenticated
-- with check (
--   bucket_id = 'npe-study-club-files'
--   and public.is_approved_user(auth.uid())
-- );
