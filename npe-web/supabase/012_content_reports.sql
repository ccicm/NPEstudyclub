-- Clinical safeguarding scaffold: content reports for threads/replies.

create extension if not exists pgcrypto;

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references public.forum_threads(id) on delete cascade,
  reply_id uuid references public.forum_replies(id) on delete cascade,
  reporter_id uuid references auth.users(id),
  reason text,
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  constraint content_reports_one_target check (
    (thread_id is not null and reply_id is null)
    or (thread_id is null and reply_id is not null)
  )
);

alter table public.content_reports enable row level security;

drop policy if exists "Members can submit content reports" on public.content_reports;
drop policy if exists "Members can read own content reports" on public.content_reports;

create policy "Members can submit content reports"
on public.content_reports for insert
with check (auth.uid() = reporter_id and public.is_approved_member());

create policy "Members can read own content reports"
on public.content_reports for select
using (auth.uid() = reporter_id and public.is_approved_member());