create extension if not exists pgcrypto;

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_type text,
  category text not null,
  domain text,
  modality text,
  population text,
  content_type text,
  source text,
  tags text[],
  notes text,
  file_path text,
  uploaded_by uuid references auth.users(id),
  uploader_name text,
  created_at timestamptz default now()
);

alter table public.resources add column if not exists modality text;
alter table public.resources add column if not exists population text;
alter table public.resources add column if not exists content_type text;
alter table public.resources add column if not exists source text;
alter table public.resources add column if not exists tags text[];
alter table public.resources add column if not exists notes text;
alter table public.resources add column if not exists file_path text;
alter table public.resources add column if not exists uploaded_by uuid references auth.users(id);
alter table public.resources add column if not exists uploader_name text;
alter table public.resources add column if not exists created_at timestamptz default now();

alter table public.approved_users add column if not exists status text;
update public.approved_users set status = 'approved' where status is null;
alter table public.approved_users alter column status set default 'approved';

create or replace function public.is_approved_member()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.approved_users
    where lower(email) = lower(coalesce(auth.jwt()->>'email', ''))
      and coalesce(status, 'approved') = 'approved'
  );
$$;

alter table public.resources enable row level security;

drop policy if exists "Authenticated users can read resources" on public.resources;
drop policy if exists "Users can insert resources" on public.resources;
drop policy if exists "Users can delete own resources" on public.resources;

create policy "Authenticated users can read resources"
on public.resources for select
using (public.is_approved_member());

create policy "Users can insert resources"
on public.resources for insert
with check (auth.uid() = uploaded_by and public.is_approved_member());

create policy "Users can delete own resources"
on public.resources for delete
using (auth.uid() = uploaded_by and public.is_approved_member());
