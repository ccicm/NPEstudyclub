# UX Refactor Implementation Status

Last updated: April 10, 2026 (session update)

This file tracks implementation status only. `MASTER_PLAN.md` remains the source of truth.

## Current State

- Production app is accessible and password-based member login is active.
- Request + admin approval flow is in place with approved-user gating.
- Member nav active state and dashboard-first member navigation are implemented.
- Landing page Phase 2 UX/copy updates are implemented.
- Dashboard Phase 3 UX updates are implemented (resource deep-linking, clarified quiz domain labels, community zero-state CTA).
- Study plan reliability protections are implemented (upsert plan create/update, regenerate safeguards, richer study logs).

## Storage + Resource Upload

- DigitalOcean Spaces integration is implemented in app code (with Supabase Storage fallback mode).
- Resource insert flow now has schema/RLS-aware diagnostics and fallback payload attempts.
- Resource policy/schema cleanup migrations were added:
  - `supabase/009_resource_schema_guard.sql`
  - `supabase/010_resources_policy_cleanup.sql`
- Bulk onboard helper migration was added:
  - `supabase/011_bulk_onboard_members.sql`
- Remaining follow-up: verify uploaded resources are consistently visible in `/resources` for production users.

## Active Verification Focus

- Confirm migrations `001` through `011` have been applied in production (still pending from live production SQL access).
- Confirm resource upload -> metadata row -> library visibility -> signed URL download flow in production (still pending from live production account/session).
- Confirm study-plan save/regenerate/log flows for approved non-admin users in production (still pending in production).

## Clinical Safeguarding (Started)

- Implemented in code:
  - `/community/guidelines` page with permitted/prohibited scope.
  - Thread creation disclaimer banner with guidelines link.
  - Report flow scaffold in thread detail for both threads and replies.
  - Initial moderator controls in thread detail (admin delete thread/reply).
  - New migration scaffold: `supabase/012_content_reports.sql`.
- Pending:
  - Apply migration `012_content_reports.sql` in production.
  - Wire report email notifications.
  - Add remaining moderator controls (edit with marker, moderator note pinning, suspension/ban).

## P3.5 Bulk Onboarding

- `supabase/011_bulk_onboard_members.sql` is ready but still contains sample rows.
- Next step: replace with real member data and execute once in production.

## Not Started

- Question generator repetition audit and diversity controls
- Deferred backlog items listed in `MASTER_PLAN.md`
