-- Cleanup migration for manually-created/broken policies on resources.
-- Safe to run multiple times.

alter table public.resources enable row level security;

alter table public.resources add column if not exists file_type text;
alter table public.resources add column if not exists domain text;
alter table public.resources add column if not exists modality text;
alter table public.resources add column if not exists population text;
alter table public.resources add column if not exists content_type text;
alter table public.resources add column if not exists source text;
alter table public.resources add column if not exists tags text[];
alter table public.resources add column if not exists notes text;
alter table public.resources add column if not exists file_path text;
alter table public.resources add column if not exists uploaded_by uuid references auth.users(id);
alter table public.resources add column if not exists uploader_name text;

drop policy if exists "resources_insert_approved" on public.resources;
drop policy if exists "Users can insert resources" on public.resources;

create policy "Users can insert resources"
on public.resources for insert
to authenticated
with check (auth.uid() = uploaded_by and public.is_approved_member());
