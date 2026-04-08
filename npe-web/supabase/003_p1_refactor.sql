create extension if not exists pgcrypto;

alter table public.access_requests add column if not exists psy_number text;
alter table public.access_requests add column if not exists consented_at timestamptz;

alter table public.sessions add column if not exists video_link text;

-- Support fresh and existing databases by conditionally renaming meet_link.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sessions'
      and column_name = 'meet_link'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sessions'
      and column_name = 'video_link'
  ) then
    alter table public.sessions rename column meet_link to video_link;
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sessions'
      and column_name = 'meet_link'
  ) then
    update public.sessions
    set video_link = coalesce(video_link, meet_link)
    where meet_link is not null;
  end if;
end
$$;
