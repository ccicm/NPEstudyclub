create extension if not exists pgcrypto;

alter table public.resources add column if not exists modality text;
alter table public.resources add column if not exists population text;
alter table public.resources add column if not exists content_type text;
alter table public.resources add column if not exists source text;

alter table public.sessions add column if not exists meet_link text;

alter table public.forum_threads add column if not exists channel text not null default 'general';
alter table public.forum_replies add column if not exists parent_reply_id uuid references public.forum_replies(id);

create table if not exists public.forum_upvotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  thread_id uuid references public.forum_threads(id),
  reply_id uuid references public.forum_replies(id),
  created_at timestamptz default now(),
  constraint chk_one_target check (
    (thread_id is not null and reply_id is null) or
    (thread_id is null and reply_id is not null)
  ),
  unique(user_id, thread_id),
  unique(user_id, reply_id)
);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  domain text,
  description text,
  created_by uuid references auth.users(id),
  author_name text,
  is_curated boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references public.quizzes(id) on delete cascade,
  question_text text not null,
  options jsonb not null,
  correct_index int not null,
  explanation text,
  display_order int,
  created_at timestamptz default now()
);

create table if not exists public.quiz_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  quiz_id uuid references public.quizzes(id),
  score int not null,
  total_questions int not null,
  answers jsonb,
  completed_at timestamptz default now()
);

create table if not exists public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) unique,
  exam_date date not null,
  hours_per_week int not null default 5,
  preferred_days text[],
  domain_priorities jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.study_plan_weeks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references public.study_plans(id) on delete cascade,
  week_number int not null,
  week_start date not null,
  domain_focus text not null,
  suggested_resource_id uuid references public.resources(id),
  suggested_quiz_id uuid references public.quizzes(id),
  status text not null default 'upcoming'
    check (status in ('upcoming', 'in_progress', 'complete')),
  created_at timestamptz default now()
);

create table if not exists public.study_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  plan_week_id uuid references public.study_plan_weeks(id),
  hours_logged numeric(4,1) not null,
  logged_at timestamptz default now()
);

alter table public.forum_upvotes enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_results enable row level security;
alter table public.study_plans enable row level security;
alter table public.study_plan_weeks enable row level security;
alter table public.study_log enable row level security;

drop policy if exists "Authenticated users can read forum_upvotes" on public.forum_upvotes;
drop policy if exists "Users can insert forum_upvotes" on public.forum_upvotes;
drop policy if exists "Users can delete own forum_upvotes" on public.forum_upvotes;
drop policy if exists "Authenticated users can read quizzes" on public.quizzes;
drop policy if exists "Users can insert quizzes" on public.quizzes;
drop policy if exists "Authenticated users can read quiz_questions" on public.quiz_questions;
drop policy if exists "Users can insert quiz_questions" on public.quiz_questions;
drop policy if exists "Users can read own quiz_results" on public.quiz_results;
drop policy if exists "Users can insert own quiz_results" on public.quiz_results;
drop policy if exists "Users manage own study_plan" on public.study_plans;
drop policy if exists "Users manage own study_plan_weeks" on public.study_plan_weeks;
drop policy if exists "Users manage own study_log" on public.study_log;

create policy "Authenticated users can read forum_upvotes"
on public.forum_upvotes for select
using (public.is_approved_member());

create policy "Users can insert forum_upvotes"
on public.forum_upvotes for insert
with check (auth.uid() = user_id and public.is_approved_member());

create policy "Users can delete own forum_upvotes"
on public.forum_upvotes for delete
using (auth.uid() = user_id and public.is_approved_member());

create policy "Authenticated users can read quizzes"
on public.quizzes for select
using (public.is_approved_member());

create policy "Users can insert quizzes"
on public.quizzes for insert
with check (auth.uid() = created_by and public.is_approved_member());

create policy "Authenticated users can read quiz_questions"
on public.quiz_questions for select
using (public.is_approved_member());

create policy "Users can insert quiz_questions"
on public.quiz_questions for insert
with check (
  auth.uid() = (select created_by from public.quizzes where id = quiz_id)
  and public.is_approved_member()
);

create policy "Users can read own quiz_results"
on public.quiz_results for select
using (auth.uid() = user_id and public.is_approved_member());

create policy "Users can insert own quiz_results"
on public.quiz_results for insert
with check (auth.uid() = user_id and public.is_approved_member());

create policy "Users manage own study_plan"
on public.study_plans for all
using (auth.uid() = user_id and public.is_approved_member())
with check (auth.uid() = user_id and public.is_approved_member());

create policy "Users manage own study_plan_weeks"
on public.study_plan_weeks for all
using (
  auth.uid() = (select user_id from public.study_plans where id = plan_id)
  and public.is_approved_member()
);

create policy "Users manage own study_log"
on public.study_log for all
using (auth.uid() = user_id and public.is_approved_member())
with check (auth.uid() = user_id and public.is_approved_member());
