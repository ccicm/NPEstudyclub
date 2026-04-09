create extension if not exists pgcrypto;

-- Quiz metadata upgrades for delivery modes and seed tracking.
alter table public.quizzes
  add column if not exists delivery_mode text not null default 'custom'
    check (delivery_mode in ('daily', 'fortnightly', 'targeted', 'custom')),
  add column if not exists timed_seconds int,
  add column if not exists is_published boolean not null default false,
  add column if not exists seed_source text,
  add column if not exists seed_version text,
  add column if not exists published_at timestamptz;

-- Extend quiz_questions to support NPE 5-option format and analytics.
alter table public.quiz_questions
  add column if not exists domain_number int check (domain_number between 1 and 4),
  add column if not exists domain_label text,
  add column if not exists subdomain text,
  add column if not exists options_map jsonb,
  add column if not exists correct_answer text check (correct_answer in ('A', 'B', 'C', 'D', 'E')),
  add column if not exists correct_explanation text,
  add column if not exists distractor_explanations jsonb,
  add column if not exists citations text[] not null default '{}'::text[],
  add column if not exists difficulty_seed text not null default 'standard'
    check (difficulty_seed in ('standard', 'challenging', 'advanced')),
  add column if not exists difficulty_score numeric(6,4),
  add column if not exists attempts_count int not null default 0,
  add column if not exists correct_count int not null default 0,
  add column if not exists flagged boolean not null default false,
  add column if not exists flagged_count int not null default 0,
  add column if not exists review_thread_id uuid references public.forum_threads(id);

-- Basic shape checks for JSON payload columns.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'quiz_questions_options_map_object_chk'
  ) then
    alter table public.quiz_questions
      add constraint quiz_questions_options_map_object_chk
      check (options_map is null or jsonb_typeof(options_map) = 'object');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'quiz_questions_distractor_explanations_object_chk'
  ) then
    alter table public.quiz_questions
      add constraint quiz_questions_distractor_explanations_object_chk
      check (distractor_explanations is null or jsonb_typeof(distractor_explanations) = 'object');
  end if;
end
$$;

-- Backfill current 4-option rows into A-D answer keys where possible.
update public.quiz_questions
set correct_answer = upper(coalesce(options -> correct_index ->> 'label', 'A'))
where correct_answer is null
  and options is not null
  and jsonb_typeof(options) = 'array';

-- Per-question response events for adaptive analytics.
create table if not exists public.user_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quiz_id uuid references public.quizzes(id) on delete set null,
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  attempt_id uuid,
  selected_answer text not null check (selected_answer in ('A', 'B', 'C', 'D', 'E')),
  is_correct boolean not null,
  set_id text,
  submitted_at timestamptz not null default now()
);

create index if not exists idx_user_responses_user_submitted
  on public.user_responses(user_id, submitted_at desc);
create index if not exists idx_user_responses_question
  on public.user_responses(question_id);
create index if not exists idx_user_responses_quiz
  on public.user_responses(quiz_id);

-- User-submitted question contest flags.
create table if not exists public.question_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  unique(user_id, question_id)
);

create index if not exists idx_question_flags_question
  on public.question_flags(question_id);

-- Optional audit record for community escalation linkage.
create table if not exists public.question_reviews (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null unique references public.quiz_questions(id) on delete cascade,
  escalated_at timestamptz not null default now(),
  threshold_ratio numeric(6,4) not null,
  thread_id uuid references public.forum_threads(id)
);

create or replace function public.apply_response_correctness()
returns trigger
language plpgsql
as $$
declare
  expected text;
begin
  select correct_answer
  into expected
  from public.quiz_questions
  where id = new.question_id;

  if expected is null then
    raise exception 'Question % has no correct_answer set', new.question_id;
  end if;

  new.is_correct = (new.selected_answer = expected);
  return new;
end;
$$;

create or replace function public.refresh_question_metrics(p_question_id uuid)
returns void
language plpgsql
as $$
declare
  attempts int;
  corrects int;
  distinct_takers int;
  flag_count int;
  flag_ratio numeric(8,6);
begin
  select count(*), count(*) filter (where is_correct)
  into attempts, corrects
  from public.user_responses
  where question_id = p_question_id;

  select count(distinct user_id)
  into distinct_takers
  from public.user_responses
  where question_id = p_question_id;

  select count(*)
  into flag_count
  from public.question_flags
  where question_id = p_question_id;

  flag_ratio := case
    when distinct_takers > 0 then flag_count::numeric / distinct_takers::numeric
    else 0
  end;

  update public.quiz_questions
  set attempts_count = attempts,
      correct_count = corrects,
      difficulty_score = case when attempts >= 30 then corrects::numeric / attempts::numeric else null end,
      flagged_count = flag_count,
      flagged = (flag_ratio > 0.01)
  where id = p_question_id;
end;
$$;

-- Split escalation logic from metrics refresh to avoid fragile thread-id variable usage.
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
begin
  select count(distinct user_id) into takers
  from public.user_responses
  where question_id = p_question_id;

  select count(*) into flags
  from public.question_flags
  where question_id = p_question_id;

  ratio := case when takers > 0 then flags::numeric / takers::numeric else 0 end;

  if ratio <= 0.01 then
    return;
  end if;

  select thread_id into existing_thread
  from public.question_reviews
  where question_id = p_question_id;

  if existing_thread is not null then
    return;
  end if;

  insert into public.forum_threads (title, body, tag, channel, created_by, author_name)
  values (
    'Contested question review',
    'Question ' || p_question_id || ' exceeded the 1% contest threshold and requires moderator review.',
    'quiz-review',
    'general',
    null,
    'System'
  )
  returning id into created_thread;

  insert into public.question_reviews (question_id, threshold_ratio, thread_id)
  values (p_question_id, ratio, created_thread)
  on conflict (question_id) do update
    set threshold_ratio = excluded.threshold_ratio,
        thread_id = coalesce(public.question_reviews.thread_id, excluded.thread_id);

  update public.quiz_questions
  set review_thread_id = coalesce(review_thread_id, created_thread)
  where id = p_question_id;
end;
$$;

create or replace function public.handle_user_response_change()
returns trigger
language plpgsql
as $$
begin
  perform public.refresh_question_metrics(coalesce(new.question_id, old.question_id));
  return coalesce(new, old);
end;
$$;

create or replace function public.handle_question_flag_change()
returns trigger
language plpgsql
as $$
declare
  target_question uuid;
begin
  target_question := coalesce(new.question_id, old.question_id);
  perform public.refresh_question_metrics(target_question);
  perform public.escalate_flagged_question(target_question);
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_user_responses_set_correctness on public.user_responses;
create trigger trg_user_responses_set_correctness
before insert or update of question_id, selected_answer
on public.user_responses
for each row execute function public.apply_response_correctness();

drop trigger if exists trg_user_responses_metrics on public.user_responses;
create trigger trg_user_responses_metrics
after insert or update or delete
on public.user_responses
for each row execute function public.handle_user_response_change();

drop trigger if exists trg_question_flags_metrics on public.question_flags;
create trigger trg_question_flags_metrics
after insert or delete
on public.question_flags
for each row execute function public.handle_question_flag_change();

alter table public.user_responses enable row level security;
alter table public.question_flags enable row level security;
alter table public.question_reviews enable row level security;

create policy "Users can read own user_responses"
on public.user_responses for select
using (auth.uid() = user_id and public.is_approved_member());

create policy "Users can insert own user_responses"
on public.user_responses for insert
with check (auth.uid() = user_id and public.is_approved_member());

create policy "Users can read own question_flags"
on public.question_flags for select
using (auth.uid() = user_id and public.is_approved_member());

create policy "Users can insert own question_flags"
on public.question_flags for insert
with check (auth.uid() = user_id and public.is_approved_member());

create policy "Authenticated users can read question_reviews"
on public.question_reviews for select
using (public.is_approved_member());

create or replace view public.user_performance as
select
  ur.user_id,
  qq.domain_number,
  coalesce(qq.domain_label, q.domain, 'General') as domain_label,
  qq.subdomain,
  count(*) as attempts,
  count(*) filter (where ur.is_correct) as correct_responses,
  (count(*) filter (where ur.is_correct))::numeric / nullif(count(*), 0)::numeric as accuracy,
  avg(qq.difficulty_score) as avg_question_difficulty,
  max(ur.submitted_at) as last_attempted_at
from public.user_responses ur
join public.quiz_questions qq on qq.id = ur.question_id
left join public.quizzes q on q.id = ur.quiz_id
group by ur.user_id, qq.domain_number, coalesce(qq.domain_label, q.domain, 'General'), qq.subdomain;

grant select on public.user_performance to authenticated;
