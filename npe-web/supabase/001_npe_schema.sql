create extension if not exists pgcrypto;

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_type text,
  category text not null,
  domain text,
  tags text[],
  notes text,
  file_path text,
  uploaded_by uuid references auth.users(id),
  uploader_name text,
  created_at timestamptz default now()
);

create table if not exists public.key_references (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source text not null,
  description text,
  url text,
  is_new boolean default false,
  display_order int
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  title text,
  session_type text not null,
  scheduled_at timestamptz not null,
  week_number int,
  description text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table if not exists public.user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  resource_id uuid references public.resources(id),
  completed_at timestamptz default now(),
  unique(user_id, resource_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid references public.resources(id),
  user_id uuid references auth.users(id),
  author_name text,
  body text not null,
  created_at timestamptz default now()
);

create table if not exists public.approved_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text,
  ahpra_registration text,
  verification_notes text,
  status text not null default 'approved' check (status in ('approved', 'revoked')),
  created_at timestamptz default now()
);

create table if not exists public.access_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  ahpra_registration text,
  relationship_note text,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.forum_threads (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  tag text,
  created_by uuid references auth.users(id),
  author_name text,
  is_pinned boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.forum_replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references public.forum_threads(id) on delete cascade,
  body text not null,
  created_by uuid references auth.users(id),
  author_name text,
  created_at timestamptz default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_approved_member()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.approved_users
    where lower(email) = lower(coalesce(auth.jwt()->>'email', ''))
      and status = 'approved'
  );
$$;

drop trigger if exists trg_forum_threads_updated_at on public.forum_threads;
create trigger trg_forum_threads_updated_at
before update on public.forum_threads
for each row execute function public.touch_updated_at();

alter table public.resources enable row level security;
alter table public.key_references enable row level security;
alter table public.sessions enable row level security;
alter table public.user_progress enable row level security;
alter table public.comments enable row level security;
alter table public.approved_users enable row level security;
alter table public.access_requests enable row level security;
alter table public.forum_threads enable row level security;
alter table public.forum_replies enable row level security;

drop policy if exists "Authenticated users can read resource objects" on storage.objects;
drop policy if exists "Authenticated users can upload resource objects" on storage.objects;
drop policy if exists "Authenticated users can delete resource objects" on storage.objects;
drop policy if exists "Authenticated users can read resources" on public.resources;
drop policy if exists "Users can insert resources" on public.resources;
drop policy if exists "Users can delete own resources" on public.resources;
drop policy if exists "Authenticated users can read key_references" on public.key_references;
drop policy if exists "Authenticated users can read sessions" on public.sessions;
drop policy if exists "Users can insert sessions" on public.sessions;
drop policy if exists "Users can read own progress" on public.user_progress;
drop policy if exists "Users can insert own progress" on public.user_progress;
drop policy if exists "Users can delete own progress" on public.user_progress;
drop policy if exists "Authenticated users can read comments" on public.comments;
drop policy if exists "Users can insert comments" on public.comments;
drop policy if exists "Users can delete own comments" on public.comments;
drop policy if exists "Users can read own approved_users row" on public.approved_users;
drop policy if exists "Anyone can submit access request" on public.access_requests;
drop policy if exists "Users can read own access requests" on public.access_requests;
drop policy if exists "Authenticated users can read forum_threads" on public.forum_threads;
drop policy if exists "Users can insert forum_threads" on public.forum_threads;
drop policy if exists "Users can delete own forum_threads" on public.forum_threads;
drop policy if exists "Authenticated users can read forum_replies" on public.forum_replies;
drop policy if exists "Users can insert forum_replies" on public.forum_replies;
drop policy if exists "Users can delete own forum_replies" on public.forum_replies;

create policy "Authenticated users can read resource objects"
on storage.objects for select
using (bucket_id = 'resources' and public.is_approved_member());

create policy "Authenticated users can upload resource objects"
on storage.objects for insert
with check (bucket_id = 'resources' and public.is_approved_member());

create policy "Authenticated users can delete resource objects"
on storage.objects for delete
using (bucket_id = 'resources' and public.is_approved_member());

create policy "Authenticated users can read resources"
on public.resources for select
using (public.is_approved_member());

create policy "Users can insert resources"
on public.resources for insert
with check (auth.uid() = uploaded_by and public.is_approved_member());

create policy "Users can delete own resources"
on public.resources for delete
using (auth.uid() = uploaded_by and public.is_approved_member());

create policy "Authenticated users can read key_references"
on public.key_references for select
using (public.is_approved_member());

create policy "Authenticated users can read sessions"
on public.sessions for select
using (public.is_approved_member());

create policy "Users can insert sessions"
on public.sessions for insert
with check (auth.uid() = created_by and public.is_approved_member());

create policy "Users can read own progress"
on public.user_progress for select
using (auth.uid() = user_id and public.is_approved_member());

create policy "Users can insert own progress"
on public.user_progress for insert
with check (auth.uid() = user_id and public.is_approved_member());

create policy "Users can delete own progress"
on public.user_progress for delete
using (auth.uid() = user_id and public.is_approved_member());

create policy "Authenticated users can read comments"
on public.comments for select
using (public.is_approved_member());

create policy "Users can insert comments"
on public.comments for insert
with check (auth.uid() = user_id and public.is_approved_member());

create policy "Users can delete own comments"
on public.comments for delete
using (auth.uid() = user_id and public.is_approved_member());

create policy "Users can read own approved_users row"
on public.approved_users for select
using (lower(email) = lower(auth.jwt()->>'email'));

create policy "Anyone can submit access request"
on public.access_requests for insert
to anon, authenticated
with check (true);

create policy "Users can read own access requests"
on public.access_requests for select
using (lower(email) = lower(auth.jwt()->>'email'));

create policy "Authenticated users can read forum_threads"
on public.forum_threads for select
using (public.is_approved_member());

create policy "Users can insert forum_threads"
on public.forum_threads for insert
with check (auth.uid() = created_by and public.is_approved_member());

create policy "Users can delete own forum_threads"
on public.forum_threads for delete
using (auth.uid() = created_by and public.is_approved_member());

create policy "Authenticated users can read forum_replies"
on public.forum_replies for select
using (public.is_approved_member());

create policy "Users can insert forum_replies"
on public.forum_replies for insert
with check (auth.uid() = created_by and public.is_approved_member());

create policy "Users can delete own forum_replies"
on public.forum_replies for delete
using (auth.uid() = created_by and public.is_approved_member());
