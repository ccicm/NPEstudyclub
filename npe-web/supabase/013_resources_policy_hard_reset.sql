-- Hard reset for resources policies.
-- Use when production contains stale/manual policies (e.g. references to a non-existent or restricted users table).
-- Safe to run multiple times.

alter table public.resources enable row level security;

-- Drop every existing policy on public.resources, regardless of its name.
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'resources'
  loop
    execute format('drop policy if exists %I on public.resources', pol.policyname);
  end loop;
end
$$;

-- Recreate canonical policies aligned with current app behavior.
create policy "Authenticated users can read resources"
on public.resources for select
to authenticated
using (public.is_approved_member());

create policy "Users can insert resources"
on public.resources for insert
to authenticated
with check (auth.uid() = uploaded_by and public.is_approved_member());

create policy "Users can delete own resources"
on public.resources for delete
to authenticated
using (auth.uid() = uploaded_by and public.is_approved_member());