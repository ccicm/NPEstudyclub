# UX Audit — NPE Study Club

Lens: a provisional psychologist under exam pressure, non-technical, opening the site for the first time after approval.

## Summary

This audit covers onboarding, information architecture, copy, empty states, dependency visibility, and redundancy/noise. The goal is to remove developer-facing language, reduce friction for first-time approved members, and make the product feel coherent to a non-technical user.

## Priority Plan

### Implementation Snapshot (2026-04-10)
- Done:
	- `/auth/request-status` now renders by auth/approval state and no longer shows organiser-only instructions.
	- Stale profile progress section removed.
	- Schedule shows a prompt when a study plan is missing.
	- Dashboard now uses study-plan exam date in the timeline card when available.
	- Resource library fetch limit raised to 1000 (interim mitigation before pagination).
	- Several empty states now include direct action links (resources, quizzes, community).
	- Resource search placeholder simplified to "Search resources…".
	- Resource file action button copy standardised to "View file".
	- Add-resource form now includes helper text when category-specific metadata sections appear.
	- Request-access PSY-focused label/copy renamed to "AHPRA registration number" wording.
	- Admin self-approval helper copy and button label clarified.
	- Limited-access banners now use user-safe wording (replacing preview/service-key/bypass terminology).
	- Member error messages now use consistent user-safe wording across resources, community, quizzes, and study plan flows.
	- Auth sign-in/sign-up/reset/callback flows now map backend errors to user-safe messages.
	- Community thread-detail restriction message now clearly covers both posting and replying.
	- Dashboard account card label softened to "Member access".
	- Quiz list now includes a consistent AI-generated disclosure callout.
	- Quiz runner now includes AI-generated disclosure copy in intro and results.
	- Quiz runner results now use sequential per-question review and require explanation rating before advancing.
	- Downvote flow now exposes follow-up review guidance and community review-board CTA.
	- Quiz detail loading now supports optional citations/wrong-answer rationales with schema-safe fallback.
	- Calendar export study blocks now use UTC-safe AEST-aligned times.
	- Schedule filter controls now include `Exam windows` and conditional `My exam window` views.
- In progress:
	- Replace remaining developer-facing error strings with user-safe copy across all surfaces.
	- Confirm remaining resource actions across non-library surfaces retain consistent "View"/"Download" language.
- Pending:
	- Rename ambiguous community channel labels (if any non-canonical labels remain in seeded/community data).

### P1 — Critical
- Conditionally render `/auth/request-status` based on auth + approval state.
- Remove organiser/admin instruction text from the request-status page.
- Replace developer-facing error messages in production UI with user-friendly copy and console/admin diagnostics.

### P2 — High
- Standardise resource/file actions to `View` or `Download`.
- Remove stale Profile progress section.
- Make empty states more inviting and action-oriented with real links.
- Simplify the resource search placeholder to `Search resources…`.

### P3 — Medium
- Add schedule dependency prompt when no study plan exists.
- Add short helper text above conditional upload form sections.
- Rename PSY label to AHPRA registration number.
- Rename ambiguous community channel labels.
- Fix admin approval copy and helper text.

### P4 — Low
- Replace dashboard hero subtitle with something more temporal/personally relevant.
- Convert admin recently-reviewed output from log-style strings into a minimal table.
- Soften or remove the dashboard `ACCOUNT` label.

## Key Issues

- The membership journey is split across too many pages with no clear through-line.
- The app currently leaks developer and infrastructure language into user-facing errors.
- Several pages hide important dependencies between Study Plan, Schedule, Resources, and Dashboard progress.
- Some empty states are accurate but not helpful or welcoming.
- Several labels and verbs are inconsistent across the app.

## Intended Next Step

Use this audit as the next non-quiz refactor block after current production verification and safeguarding work are stable.
