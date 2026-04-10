-- Cleanup migration for manually-created/broken policies on resources.
-- Safe to run multiple times.

alter table public.resources enable row level security;

drop policy if exists "resources_insert_approved" on public.resources;
drop policy if exists "Users can insert resources" on public.resources;

create policy "Users can insert resources"
on public.resources for insert
to authenticated
with check (auth.uid() = uploaded_by and public.is_approved_member());
