create extension if not exists pgcrypto;

alter table public.study_log
  add column if not exists topics_covered text,
  add column if not exists quiz_insight text,
  add column if not exists notes text;
