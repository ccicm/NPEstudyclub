# Production Verification SQL Runbook

Use this in Supabase SQL Editor on production to close storage, migration, and resource-visibility checks quickly.

## 1. Confirm migration files exist in repo snapshot

Expected migration files:
- 001_npe_schema.sql
- 002_feature_upgrade.sql
- 003_p1_refactor.sql
- 004_quiz_pipeline_upgrade.sql
- 005_explanation_feedback.sql
- 006_explanation_feedback_settings.sql
- 007_noticeboard_publish_windows.sql
- 008_study_plan_enhancements.sql
- 009_resource_schema_guard.sql
- 010_resources_policy_cleanup.sql
- 011_bulk_onboard_members.sql
- 012_content_reports.sql
- 013_resources_policy_hard_reset.sql

## 2. Inspect resources table shape

```sql
select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'resources'
order by ordinal_position;
```

## 3. Inspect resources policies and detect stale references

```sql
select
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'resources'
order by policyname;
```

```sql
select
  policyname,
  (coalesce(qual, '') || ' ' || coalesce(with_check, '')) as policy_expr
from pg_policies
where schemaname = 'public'
  and tablename = 'resources'
  and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ilike '%users%';
```

If any row above appears with an unintended users-table expression, run:

```sql
-- paste contents of supabase/013_resources_policy_hard_reset.sql
```

## 4. Check approved user status for target member email

```sql
select email, status, full_name, created_at
from public.approved_users
where lower(email) = lower('REPLACE_MEMBER_EMAIL');
```

## 5. Verify latest uploaded resource rows

```sql
select id, title, category, file_path, uploaded_by, uploader_name, created_at
from public.resources
order by created_at desc
limit 20;
```

## 6. Optional: verify rows for one uploader email

```sql
select r.id, r.title, r.file_path, r.created_at, u.email
from public.resources r
left join auth.users u on u.id = r.uploaded_by
where lower(u.email) = lower('REPLACE_MEMBER_EMAIL')
order by r.created_at desc
limit 20;
```

## 7. Bulk onboarding execution check

After running 011 with real rows:

```sql
select email, full_name, status
from public.approved_users
where lower(email) in (
  lower('member1@example.com'),
  lower('member2@example.com'),
  lower('member3@example.com'),
  lower('member4@example.com'),
  lower('member5@example.com'),
  lower('member6@example.com')
)
order by email;
```

## 8. Content reports scaffold check (after 012)

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'content_reports'
order by ordinal_position;
```

## 9. Fast pass criteria for unblock

- resources policies exist and do not contain stale users-table references
- approved member row exists for uploader email
- uploaded row exists in public.resources with file_path and uploaded_by
- app no longer shows 42501/table users banner in resources page
- open file action returns a short-lived signed URL and opens file successfully
