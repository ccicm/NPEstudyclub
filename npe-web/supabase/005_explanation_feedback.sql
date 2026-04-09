create extension if not exists pgcrypto;

alter table public.quiz_questions
  add column if not exists explanation_upvotes_count int not null default 0,
  add column if not exists explanation_downvotes_count int not null default 0,
  add column if not exists explanation_contested boolean not null default false,
  add column if not exists explanation_review_thread_id uuid references public.forum_threads(id);

create table if not exists public.explanation_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  vote text not null check (vote in ('up', 'down')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, question_id)
);

create table if not exists public.explanation_feedback_reviews (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null unique references public.quiz_questions(id) on delete cascade,
  escalated_at timestamptz not null default now(),
  downvote_ratio numeric(6,4) not null,
  threshold_ratio numeric(6,4) not null,
  thread_id uuid references public.forum_threads(id)
);

create index if not exists idx_explanation_feedback_question
  on public.explanation_feedback(question_id);

create or replace function public.touch_explanation_feedback_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.refresh_explanation_feedback_metrics(p_question_id uuid)
returns void
language plpgsql
as $$
declare
  up_count int;
  down_count int;
  total_count int;
  down_ratio numeric(8,6);
begin
  select
    count(*) filter (where vote = 'up'),
    count(*) filter (where vote = 'down'),
    count(*)
  into up_count, down_count, total_count
  from public.explanation_feedback
  where question_id = p_question_id;

  down_ratio := case when total_count > 0 then down_count::numeric / total_count::numeric else 0 end;

  update public.quiz_questions
  set explanation_upvotes_count = up_count,
      explanation_downvotes_count = down_count,
      explanation_contested = (down_ratio > 0.20)
  where id = p_question_id;
end;
$$;

create or replace function public.escalate_explanation_feedback(p_question_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  down_count int;
  total_count int;
  down_ratio numeric(8,6);
  existing_thread uuid;
  created_thread uuid;
  threshold constant numeric(6,4) := 0.20;
begin
  select
    count(*) filter (where vote = 'down'),
    count(*)
  into down_count, total_count
  from public.explanation_feedback
  where question_id = p_question_id;

  down_ratio := case when total_count > 0 then down_count::numeric / total_count::numeric else 0 end;

  if down_ratio <= threshold then
    return;
  end if;

  select thread_id into existing_thread
  from public.explanation_feedback_reviews
  where question_id = p_question_id;

  if existing_thread is not null then
    return;
  end if;

  insert into public.forum_threads (title, body, tag, channel, created_by, author_name)
  values (
    'Quiz explanation quality review',
    'Question ' || p_question_id || ' exceeded the explanation downvote threshold and needs content review.',
    'quiz-review',
    'general',
    null,
    'System'
  )
  returning id into created_thread;

  insert into public.explanation_feedback_reviews (question_id, downvote_ratio, threshold_ratio, thread_id)
  values (p_question_id, down_ratio, threshold, created_thread)
  on conflict (question_id) do update
    set downvote_ratio = excluded.downvote_ratio,
        thread_id = coalesce(public.explanation_feedback_reviews.thread_id, excluded.thread_id);

  update public.quiz_questions
  set explanation_review_thread_id = coalesce(explanation_review_thread_id, created_thread)
  where id = p_question_id;
end;
$$;

create or replace function public.handle_explanation_feedback_change()
returns trigger
language plpgsql
as $$
declare
  target_question uuid;
begin
  target_question := coalesce(new.question_id, old.question_id);
  perform public.refresh_explanation_feedback_metrics(target_question);
  perform public.escalate_explanation_feedback(target_question);
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_explanation_feedback_touch_updated_at on public.explanation_feedback;
create trigger trg_explanation_feedback_touch_updated_at
before update on public.explanation_feedback
for each row execute function public.touch_explanation_feedback_updated_at();

drop trigger if exists trg_explanation_feedback_metrics on public.explanation_feedback;
create trigger trg_explanation_feedback_metrics
after insert or update or delete
on public.explanation_feedback
for each row execute function public.handle_explanation_feedback_change();

alter table public.explanation_feedback enable row level security;
alter table public.explanation_feedback_reviews enable row level security;

create policy "Users can read own explanation_feedback"
on public.explanation_feedback for select
using (auth.uid() = user_id and public.is_approved_member());

create policy "Users can insert own explanation_feedback"
on public.explanation_feedback for insert
with check (auth.uid() = user_id and public.is_approved_member());

create policy "Users can update own explanation_feedback"
on public.explanation_feedback for update
using (auth.uid() = user_id and public.is_approved_member())
with check (auth.uid() = user_id and public.is_approved_member());

create policy "Authenticated users can read explanation feedback reviews"
on public.explanation_feedback_reviews for select
using (public.is_approved_member());
