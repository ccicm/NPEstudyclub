-- Ensure escalation cannot trigger from a single vote.
-- This migration is safe to apply repeatedly.

create extension if not exists pgcrypto;

create table if not exists public.quiz_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.quiz_settings (key, value)
values ('explanation_min_votes', to_jsonb(5))
on conflict (key) do nothing;

create or replace function public.escalate_flagged_question(p_question_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  takers int;
  flags int;
  ratio numeric(8,6);
  existing_thread uuid;
  created_thread uuid;
  question_quiz_id uuid;
  publish_after timestamptz;
  min_votes int;
begin
  select count(distinct user_id) into takers
  from public.user_responses
  where question_id = p_question_id;

  select count(*) into flags
  from public.question_flags
  where question_id = p_question_id;

  select qq.quiz_id into question_quiz_id
  from public.quiz_questions qq
  where qq.id = p_question_id;

  publish_after := public.quiz_noticeboard_publish_at();
  min_votes := coalesce(
    (select value::int from public.quiz_settings where key = 'explanation_min_votes'),
    5
  );

  ratio := case when takers > 0 then flags::numeric / takers::numeric else 0 end;

  if takers < min_votes then
    return;
  end if;

  if ratio <= 0.01 then
    return;
  end if;

  select thread_id into existing_thread
  from public.question_reviews
  where question_id = p_question_id;

  if existing_thread is not null then
    return;
  end if;

  insert into public.forum_threads (title, body, tag, channel, created_by, author_name, quiz_id, publish_at)
  values (
    'Contested question review',
    'Question ' || p_question_id || ' exceeded the 1% contest threshold and requires moderator review.',
    'quiz-review',
    'general',
    null,
    'System',
    question_quiz_id,
    publish_after
  )
  returning id into created_thread;

  insert into public.question_reviews (question_id, quiz_id, publish_at, threshold_ratio, thread_id)
  values (p_question_id, question_quiz_id, publish_after, ratio, created_thread)
  on conflict (question_id) do update
    set quiz_id = coalesce(public.question_reviews.quiz_id, excluded.quiz_id),
        publish_at = least(public.question_reviews.publish_at, excluded.publish_at),
        threshold_ratio = excluded.threshold_ratio,
        thread_id = coalesce(public.question_reviews.thread_id, excluded.thread_id);

  update public.quiz_questions
  set review_thread_id = coalesce(review_thread_id, created_thread)
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
  question_quiz_id uuid;
  publish_after timestamptz;
  min_votes int;
begin
  select
    count(*) filter (where vote = 'down'),
    count(*)
  into down_count, total_count
  from public.explanation_feedback
  where question_id = p_question_id;

  select qq.quiz_id into question_quiz_id
  from public.quiz_questions qq
  where qq.id = p_question_id;

  publish_after := public.quiz_noticeboard_publish_at();
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

  insert into public.forum_threads (title, body, tag, channel, created_by, author_name, quiz_id, publish_at)
  values (
    'Quiz explanation quality review',
    'Question ' || p_question_id || ' exceeded the explanation downvote threshold and needs content review.',
    'quiz-review',
    'general',
    null,
    'System',
    question_quiz_id,
    publish_after
  )
  returning id into created_thread;

  insert into public.explanation_feedback_reviews (question_id, quiz_id, publish_at, downvote_ratio, threshold_ratio, thread_id)
  values (p_question_id, question_quiz_id, publish_after, down_ratio, threshold, created_thread)
  on conflict (question_id) do update
    set quiz_id = coalesce(public.explanation_feedback_reviews.quiz_id, excluded.quiz_id),
        publish_at = least(public.explanation_feedback_reviews.publish_at, excluded.publish_at),
        downvote_ratio = excluded.downvote_ratio,
        thread_id = coalesce(public.explanation_feedback_reviews.thread_id, excluded.thread_id);

  update public.quiz_questions
  set explanation_review_thread_id = coalesce(explanation_review_thread_id, created_thread)
  where id = p_question_id;
end;
$$;
