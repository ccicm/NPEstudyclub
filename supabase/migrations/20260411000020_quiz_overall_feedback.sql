-- End-of-quiz overall AI feedback capture.

create table if not exists public.quiz_overall_feedback (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references public.quizzes(id) on delete cascade,
  user_id uuid references auth.users(id),
  difficulty_score smallint check (difficulty_score between 1 and 5),
  variety_score smallint check (variety_score between 1 and 5),
  clarity_score smallint check (clarity_score between 1 and 5),
  relevance_score smallint check (relevance_score between 1 and 5),
  comment text,
  created_at timestamptz default now(),
  unique(quiz_id, user_id)
);

alter table public.quiz_overall_feedback enable row level security;

drop policy if exists "Members can insert own feedback" on public.quiz_overall_feedback;
create policy "Members can insert own feedback"
  on public.quiz_overall_feedback for insert
  with check (auth.uid() = user_id);

drop policy if exists "Members can update own feedback" on public.quiz_overall_feedback;
create policy "Members can update own feedback"
  on public.quiz_overall_feedback for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Members can read own feedback" on public.quiz_overall_feedback;
create policy "Members can read own feedback"
  on public.quiz_overall_feedback for select
  using (auth.uid() = user_id);

drop policy if exists "Admins can read all feedback" on public.quiz_overall_feedback;
create policy "Admins can read all feedback"
  on public.quiz_overall_feedback for select
  using (public.is_approved_member());
