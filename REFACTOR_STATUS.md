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
- Resource policy hard-reset migration was added for production policy drift:
  - `supabase/013_resources_policy_hard_reset.sql`
- Remaining follow-up: verify uploaded resources are consistently visible in `/resources` for production users.

## Active Verification Focus

- Git-based DB rollout is now scaffolded:
  - `supabase/migrations/20260410000015_escalation_min_votes.sql`
  - `.github/workflows/migrate.yml`
- Pending setup: add GitHub Actions secret `SUPABASE_DB_URL` so migrations apply on push to `main`.
- Verify moderation behavior after migration: one downvote cannot escalate; ratio checks only run after minimum vote count.
- Confirm migrations `001` through `011` have been applied in production (still pending from live production SQL access).
- Confirm resource upload -> metadata row -> library visibility -> signed URL download flow in production (still pending from live production account/session).
- Prepare controlled bulk resource upload run after storage verification, then record batch outcomes and retry items.
- Confirm study-plan save/regenerate/log flows for approved non-admin users in production (still pending in production).
- Confirm storage privacy posture in production for study-library files:
  - Space/object access is private by default.
  - No permanent public file URLs are persisted or rendered.
  - Download flow is server-authorized and short-lived signed access only.
  - Spaces credentials/signing logic remain server-side only.

## Clinical Safeguarding (Started)

- Implemented in code:
  - `/community/guidelines` page with permitted/prohibited scope.
  - Thread creation disclaimer banner with guidelines link.
  - Report flow scaffold in thread detail for both threads and replies.
  - Initial moderator controls in thread detail (admin delete thread/reply).
  - New migration scaffold: `supabase/012_content_reports.sql`.
  - Moderator controls expansion in thread detail:
    - Pin/clear moderator note on thread
    - Edit/redact replies with "edited by moderator" marker
    - Restrict member posting for a duration
  - New migration scaffold: `supabase/014_clinical_safeguarding_moderation.sql`.
- Pending:
  - Apply migration `012_content_reports.sql` in production.
  - Apply migration `014_clinical_safeguarding_moderation.sql` in production.
  - Configure `REPORT_WEBHOOK_URL` in production for report notifications (webhook scaffold is implemented).

## P3.5 Bulk Onboarding

- `supabase/011_bulk_onboard_members.sql` is ready but still contains sample rows.
- Next step: replace with real member data and execute once in production.

## In Progress

- UX audit refactor block (captured in `docs/UX_AUDIT_NPE_STUDY_CLUB.md`)
- P1 request-status state rendering is complete (state-based CTAs, organiser note removed)
- User-facing technical copy cleanup is in progress across member/admin surfaces
- Resource search placeholder simplified to "Search resources..."
- Resource file action copy standardised to "View file"
- Add-resource form now shows category-specific helper text when conditional metadata fields appear
- Request-access copy now uses "AHPRA registration number" wording (replacing PSY-focused label copy)
- Admin self-approval helper text and button label clarified
- Dashboard account chip label softened to "Member access"
- Quiz list now includes a clear AI-generated disclosure banner
- Quiz runner now shows AI-generated disclosure copy on intro and results stages
- Quiz runner results now use sequential per-question review with required explanation rating before advancing
- Quiz detail page now loads optional citations/rationale fields with schema-safe fallback
- Calendar export study blocks now use UTC-safe timing aligned to 7:00pm AEST defaults
- Schedule filter now supports exam windows and my exam window views
- Profile stale progress section removed
- Schedule now shows a dependency prompt when no study plan exists
- Resource library fetch cap raised from 200 to 1000 (pagination still pending)
- Dashboard now passes study-plan exam date into timeline card
- Dashboard and resource-library empty states are being converted to actionable CTAs

## Generator Polish (Started)

- Implemented:
  - Added adjacent-day repetition audit tooling: `scripts/repetition-audit.js`
  - Added audit npm script: `scripts/package.json` (`audit:repetition`)
  - Added date-seed override support for deterministic audits: `scripts/generate-questions.js`
  - Fixed answer-label randomisation to avoid answer key lock-in.
  - Improved per-day template rotation selection for higher adjacent-day variation.
  - Added configurable lookback anti-repeat rule (`TEMPLATE_LOOKBACK_DAYS`, default 5).
  - Added missing source citation to preserve registry checks: `scripts/source-bank.json`.
  - Generated baseline report: `docs/GENERATOR_REPETITION_AUDIT.2026-04-04_to_2026-04-10.md`.
- Pending:
  - Expand domain template banks with lowest residual variety in audit results.
- Deferred backlog items listed in `MASTER_PLAN.md`
