create extension if not exists pgcrypto;

create table if not exists public.quiz_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create or replace function public.touch_quiz_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_quiz_settings_updated_at on public.quiz_settings;
create trigger trg_quiz_settings_updated_at
before update on public.quiz_settings
for each row execute function public.touch_quiz_settings_updated_at();

insert into public.quiz_settings (key, value)
values (
  'explanation_downvote_threshold',
  jsonb_build_object('ratio', 0.20)
)
on conflict (key) do nothing;

insert into public.quiz_settings (key, value)
values (
  'explanation_min_votes',
  to_jsonb(5)
)
on conflict (key) do nothing;

create or replace function public.get_quiz_setting_ratio(p_key text, p_default numeric)
returns numeric
language sql
stable
as $$
  select coalesce((value ->> 'ratio')::numeric, p_default)
  from public.quiz_settings
  where key = p_key
  union all
  select p_default
  where not exists (select 1 from public.quiz_settings where key = p_key)
  limit 1;
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
  threshold numeric(6,4);
begin
  select
    count(*) filter (where vote = 'up'),
    count(*) filter (where vote = 'down'),
    count(*)
  into up_count, down_count, total_count
  from public.explanation_feedback
  where question_id = p_question_id;

  threshold := public.get_quiz_setting_ratio('explanation_downvote_threshold', 0.20);
  down_ratio := case when total_count > 0 then down_count::numeric / total_count::numeric else 0 end;

  update public.quiz_questions
  set explanation_upvotes_count = up_count,
      explanation_downvotes_count = down_count,
      explanation_contested = (down_ratio > threshold)
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
  threshold numeric(6,4);
  min_votes int;
begin
  select
    count(*) filter (where vote = 'down'),
    count(*)
  into down_count, total_count
  from public.explanation_feedback
  where question_id = p_question_id;

  threshold := public.get_quiz_setting_ratio('explanation_downvote_threshold', 0.20);
  min_votes := coalesce(
    (select value::int from public.quiz_settings where key = 'explanation_min_votes'),
    5
  );
  down_ratio := case when total_count > 0 then down_count::numeric / total_count::numeric else 0 end;

  if total_count < min_votes then
    return;
  end if;

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
        threshold_ratio = excluded.threshold_ratio,
        thread_id = coalesce(public.explanation_feedback_reviews.thread_id, excluded.thread_id);

  update public.quiz_questions
  set explanation_review_thread_id = coalesce(explanation_review_thread_id, created_thread)
  where id = p_question_id;
end;
$$;

alter table public.quiz_settings enable row level security;

drop policy if exists "Authenticated users can read quiz settings" on public.quiz_settings;
create policy "Authenticated users can read quiz settings"
on public.quiz_settings for select
using (public.is_approved_member());
