# UX Audit — NPE Study Club

Lens: a provisional psychologist under exam pressure, non-technical, opening the site for the first time after approval.

## Summary

This audit covers onboarding, information architecture, copy, empty states, dependency visibility, and redundancy/noise. The goal is to remove developer-facing language, reduce friction for first-time approved members, and make the product feel coherent to a non-technical user.

## Priority Plan

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
