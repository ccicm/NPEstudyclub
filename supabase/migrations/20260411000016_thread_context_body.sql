-- Add rich context to auto-created quiz review threads.
-- Safe to run repeatedly.

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
  q_text text;
  q_domain_label text;
  q_subdomain text;
  q_quiz_title text;
  q_correct text;
  canonical_tag text;
begin
  select count(distinct user_id) into takers
  from public.user_responses
  where question_id = p_question_id;

  select count(*) into flags
  from public.question_flags
  where question_id = p_question_id;

  select
    qq.quiz_id,
    qq.question_text,
    coalesce(qq.domain_label, q.domain, 'General'),
    coalesce(qq.subdomain, 'General'),
    coalesce(qq.correct_answer, '?'),
    coalesce(q.title, 'Quiz')
  into
    question_quiz_id,
    q_text,
    q_domain_label,
    q_subdomain,
    q_correct,
    q_quiz_title
  from public.quiz_questions qq
  left join public.quizzes q on q.id = qq.quiz_id
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

  canonical_tag := case
    when lower(q_domain_label) like '%ethic%' then 'ethics'
    when lower(q_domain_label) like '%assessment%' then 'assessment'
    when lower(q_domain_label) like '%intervention%' then 'interventions'
    when lower(q_domain_label) like '%communication%' then 'communication'
    else 'quiz-review'
  end;

  insert into public.forum_threads (title, body, tag, channel, created_by, author_name, quiz_id, publish_at)
  values (
    'Peer review: ' || q_domain_label || ' - ' || q_subdomain,
    '**Community review requested - ' || q_domain_label || ': ' || q_subdomain || E'**\n\n'
      || 'Quiz: ' || q_quiz_title || E'\n'
      || 'Domain: ' || q_domain_label || ' · Study area: ' || q_subdomain || E'\n\n'
      || 'Question:' || E'\n' || coalesce(q_text, '(missing question text)') || E'\n\n'
      || 'Correct answer (per AI): ' || q_correct || E'\n\n'
      || 'This question was flagged by enough members to trigger a peer review. '
      || 'Please discuss whether the question, answer, or explanation is accurate. Cite sources where possible.',
    canonical_tag,
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
  q_text text;
  q_domain_label text;
  q_subdomain text;
  q_quiz_title text;
  canonical_tag text;
begin
  select
    count(*) filter (where vote = 'down'),
    count(*)
  into down_count, total_count
  from public.explanation_feedback
  where question_id = p_question_id;

  select
    qq.quiz_id,
    qq.question_text,
    coalesce(qq.domain_label, q.domain, 'General'),
    coalesce(qq.subdomain, 'General'),
    coalesce(q.title, 'Quiz')
  into
    question_quiz_id,
    q_text,
    q_domain_label,
    q_subdomain,
    q_quiz_title
  from public.quiz_questions qq
  left join public.quizzes q on q.id = qq.quiz_id
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

  canonical_tag := case
    when lower(q_domain_label) like '%ethic%' then 'ethics'
    when lower(q_domain_label) like '%assessment%' then 'assessment'
    when lower(q_domain_label) like '%intervention%' then 'interventions'
    when lower(q_domain_label) like '%communication%' then 'communication'
    else 'quiz-review'
  end;

  insert into public.forum_threads (title, body, tag, channel, created_by, author_name, quiz_id, publish_at)
  values (
    'Peer review: ' || q_domain_label || ' - ' || q_subdomain,
    '**AI explanation quality review - ' || q_domain_label || ': ' || q_subdomain || E'**\n\n'
      || 'Quiz: ' || q_quiz_title || E'\n'
      || 'Domain: ' || q_domain_label || ' · Study area: ' || q_subdomain || E'\n\n'
      || 'Question:' || E'\n' || coalesce(q_text, '(missing question text)') || E'\n\n'
      || 'The AI-generated explanation received enough downvotes to trigger a review. '
      || 'Please discuss accuracy and suggest corrections with citations.',
    canonical_tag,
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
