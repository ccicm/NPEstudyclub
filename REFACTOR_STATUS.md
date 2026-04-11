# UX Refactor Implementation Status

Last updated: April 11, 2026 (session update)

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
- Pending setup: ensure GitHub Actions secret `SUPABASE_DB_URL` is a valid Session pooler Postgres URI.
- Tonight note: migration rollout is intentionally paused after repeated CI connection failures to direct DB host; resume next session from workflow run verification.
- Verify moderation behavior after migration: one downvote cannot escalate; ratio checks only run after minimum vote count.
- Confirm migrations `001` through `011` have been applied in production (still pending from live production SQL access).
- Confirm resource upload -> metadata row -> library visibility -> signed URL download flow in production (still pending from live production account/session).
- Production verification runbook expanded with explicit browser flow, diagnostics triage, and evidence capture template (`docs/PRODUCTION_VERIFICATION_SQL_RUNBOOK.md`).
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
- Admin/member limited-access banners now use user-safe wording (replacing preview/service-key/bypass phrasing)
- Member error states now use consistent user-safe wording across resources, community, quizzes, and study plan flows
- Auth sign-in/sign-up/reset/callback flows now map backend errors to user-safe messages instead of raw provider text
- Community thread-detail restriction message now clearly covers both posting and replying
- Privacy and callback fallback wording now use plain language (no technical implementation terms)
- Resource search placeholder simplified to "Search resources…"
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
- Quizzes and quiz-history empty states now include direct next-step CTAs (clear filters, browse, add quiz)
- Dashboard key-references empty state now routes members to resources/community instead of a dead end
- Dashboard and resource-library empty states are being converted to actionable CTAs

## Quiz System Overhaul (2026-04-11)

### Taxonomy migration — COMPLETE
- Created `lib/npe-taxonomy.ts` as canonical source of truth for NPE domains, subdomains, colour tokens, study tips, and alias resolution.
- Migrated all quiz/study-plan components off legacy `EXAM_PREP_DOMAINS` from `resource-options`:
  - `quiz-add-form.tsx` — creators now see correct 4 NPE domains
  - `quizzes/actions.ts` — `canonicalTag` replaced with `domainId()` (1 line vs 9-line `.includes()` chain)
  - `quizzes-browser.tsx` — uses `NPE_DOMAINS` from taxonomy
  - `study-plan-dashboard.tsx` — weekly tip lookup via `domainId()` → `DOMAIN_STUDY_TIPS`
  - `study-plan-onboarding.tsx` — domain priorities initialised from correct labels

### Quiz runner improvements — COMPLETE
- Pagination: 5Q per page, free navigation, numbered page dots (green=complete, primary=current), abbreviated nav for >12 pages.
- Save & exit: persists `selectedAnswers` + `currentPage` to `quiz_progress` table (migration 015). Resume/start-fresh on re-entry.
- Time estimates: shown on intro screen per delivery mode.
- Difficulty badges: Foundational/Applied/Complex (from `difficulty_seed` column) shown in review.
- Domain colour-coded pills in review (from npe-taxonomy).
- Results screen: animated SVG score ring, confetti on pass, score tier labels (🧠/⚡/✅/📚/💪).

### Generator fixes — COMPLETE
- `difficulty` is now a per-template declaration (not a random draw from a session pool).
- `validateQuestion()` enforces non-empty distractor explanations at generation time.
- `distractor_explanations` DB column bug fixed (was querying non-existent `wrong_answer_rationales`).

### Quiz browser — COMPLETE
- Mode filter: All · Daily · Weekly · Exam sim (domain filter hidden for exam sim).
- Status filter: All · New · Attempted.
- Tile states by mode: Daily fully clickable; Weekly shows "Retake"; Exam sim shows "Review results" / "Start new sim".
- Exam sim 30-day cooldown: tiles lock after completion, show "Next sim available [date]", opacity-60.
- Score display: "Your score: X%" colour-coded; "New" badge for unattempted.
- Whole-tile link (note: P2 item — card still has separate CTA button, full card link is next iteration).
- Publishing note: `Bot` icon → `CalendarClock`.
- Exam sim cadence: monthly frequency noted in publishing note.

### Quiz history page — COMPLETE
- 2×2 stat card grid: total taken, avg score, strongest domain (colour pill), focus area (colour pill).
- Table: quiz title is clickable link; domain colour pills; score column green/amber/red; date human-readable; "Retake" column removed.

### Dashboard Quiz Activity — COMPLETE
- Replaced bare `<p>` stat block with stat pills (taken, avg, Best, Focus).
- Domain progress bars using same pattern as quiz runner results.
- Recent attempts list: 5 most recent, clickable quiz title links, colour-coded scores.
- "Full history" link right-aligned in section header.

### New migration
- `supabase/015_quiz_progress.sql`: `quiz_progress` table with RLS. Stores in-progress quiz state per user per quiz. Required for save/resume feature.

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
