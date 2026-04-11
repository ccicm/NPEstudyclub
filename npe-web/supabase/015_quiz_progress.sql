-- 015_quiz_progress.sql
-- Stores in-progress quiz state so users can pause, save, and resume.
-- One row per user per quiz; upserted on save, deleted on submit or abandon.

create table if not exists quiz_progress (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  quiz_id      uuid        not null,
  answers      jsonb       not null default '{}',  -- Record<question_id, selected_option_index>
  current_page int         not null default 0,
  started_at   timestamptz not null default now(),
  saved_at     timestamptz not null default now(),
  constraint quiz_progress_user_quiz_unique unique (user_id, quiz_id)
);

alter table quiz_progress enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'quiz_progress' and policyname = 'users_own_progress'
  ) then
    create policy "users_own_progress"
      on quiz_progress for all
      using  (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
