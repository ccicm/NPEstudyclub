-- Clinical safeguarding moderation controls.
-- Adds moderator notes, reply moderation markers, and posting restrictions.

create extension if not exists pgcrypto;

alter table public.forum_threads
  add column if not exists moderator_note text,
  add column if not exists moderator_note_pinned boolean not null default false,
  add column if not exists moderator_note_updated_at timestamptz,
  add column if not exists moderator_note_updated_by uuid references auth.users(id);

alter table public.forum_replies
  add column if not exists was_moderated boolean not null default false,
  add column if not exists moderated_at timestamptz,
  add column if not exists moderated_by uuid references auth.users(id),
  add column if not exists moderation_reason text;

create table if not exists public.forum_posting_restrictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  is_active boolean not null default true,
  reason text,
  expires_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  lifted_by uuid references auth.users(id),
  lifted_at timestamptz
);

alter table public.forum_posting_restrictions enable row level security;

drop policy if exists "Users can read own posting restrictions" on public.forum_posting_restrictions;

create policy "Users can read own posting restrictions"
on public.forum_posting_restrictions for select
to authenticated
using (auth.uid() = user_id);