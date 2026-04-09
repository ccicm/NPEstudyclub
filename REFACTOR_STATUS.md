# UX Refactor Implementation Status

Last updated: April 9, 2026

This file tracks current state only (not historical debugging notes).

## Current State

- Production app is accessible and member login is active.
- Auth flow is password-first for member sign-in.
- Request + admin approval flow is in place.
- Member-gated RLS policies were tightened to require approved users.
- Dashboard, study plan, schedule, community, quizzes, and profile are all present.

## Recently Completed

- Request form validation feedback and clearer PSY input.
- Public bypass env cleanup from runtime logic.
- Password-based login flow and sign-up/password creation path.
- Admin-only controls section in profile.
- Public landing page updated to better match dashboard style.
- Study plan onboarding now returns clearer error codes/messages.

## Active Cleanup / QA Focus

- Verify Supabase migrations are fully applied in each environment:
  - `supabase/001_npe_schema.sql`
  - `supabase/002_feature_upgrade.sql`
  - `supabase/003_p1_refactor.sql`
- Confirm study-plan onboarding/save works for approved non-admin users.
- Tighten copy consistency across app screens (public vs member wording).
- Reduce stale docs/spec overlap in root-level markdown files.
- Improve the question generator so daily sets stop repeating the same hardcoded stems and distractors.
- Track that work in [QUESTION_GENERATOR_PLAN.md](QUESTION_GENERATOR_PLAN.md).

## Deferred To Tomorrow

- Resource storage setup is the first task: use [RESOURCE_SETUP_TOMORROW.md](RESOURCE_SETUP_TOMORROW.md).
- Finish the generator polish pass with a fresh agent after reviewing real output.
- Keep the work documentation-led for now; do not add more implementation changes before that review.
- Use [QUESTION_GENERATOR_PLAN.md](QUESTION_GENERATOR_PLAN.md) as the starting point for the handoff.

## Ready To Test

- Quiz upload and CSV template now expect five options (`A-E`) instead of four.
- Study-plan saving should preserve the existing plan if regeneration fails, instead of dropping the current weeks first.
- Study-plan logging now accepts topics covered, quiz insight, and notes in addition to hours.
- Resource progress now appears on the dashboard instead of the profile page.
- Profile now links back to the dashboard progress overview.

## Still Not Started

- Saved resources/bookmarks
- Delete account flow
- Notification preferences + in-app/email notifications
- Expanded admin operations beyond access approvals
- AI-assisted content generation/moderation pipeline
