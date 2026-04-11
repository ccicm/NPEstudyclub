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
	- Privacy and callback fallback wording now use plain language with no technical implementation terms.
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

---

## Second Audit — 2026-04-11

A targeted audit was conducted against the full app after the quiz taxonomy migration and UX overhaul. New findings below.

### What improved since first audit
- Quiz browser: domain colour filter pills, mode/status filters, tile completion states, exam sim cooldown.
- Quiz results: score ring animation, confetti on pass, tier labels, domain performance bars.
- Quiz history: stat cards, domain colour pills, score colour-coding, clickable titles.
- Dashboard quiz activity: progress bars, recent attempts list, stat pills.
- Taxonomy: unified `lib/npe-taxonomy.ts` — all quiz/study-plan components now consistent.
- Publishing note: CalendarClock icon, exam sim monthly cadence noted.

### Outstanding — P1 (blocks core user journey)

- **Dashboard hero CTA mismatch:** Primary buttons are "Open resources" and "Open study plan" but this is a quiz platform. "Take today's quiz" is not surfaced in the hero at all. Add a quiz shortcut to the hero, remove or demote the "Open resources" button.
- **Exam countdown below the fold:** Arguably the most motivating element on the page is card 3–4 depending on onboarding state. Move into the hero or the first card below it.
- **AI disclaimer framing:** "AI-generated. Your feedback tunes the model." appears in 3 places (intro, results, review) and frames the user as a data labeller. Rewrite to: "Questions are AI-generated and reviewed by the study group. If something looks off, you can flag it for discussion."
- **"View related resources" button:** Doesn't tell the user which domain. Change to `Study ${weakestDomain} resources →`.
- **Quiz tile not wholly clickable:** Only the "Start →" button navigates. The card itself should be a link.

### Outstanding — P2 (significant friction)

- **Score label ambiguity:** "72% avg" on tiles reads as community average. Rename to "Your score: 72%".
- **"Thumb up" / "Thumb down" text buttons:** Replace with `ThumbsUp`/`ThumbsDown` from lucide-react.
- **Dashboard "Member access" card:** Shows email + "Signed in and approved" — zero value. Remove. Replace with "Jump back in" widget: today's quiz link, current week domain focus, days to exam.
- **Dashboard "Upcoming Sessions" empty state:** "Visit Schedule to add one" is wrong — sessions are admin-added. Rewrite: "No upcoming sessions yet — sessions are added by the study group admin."
- **Results action buttons:** Flat row of 4 equal-weight buttons. One should be the primary CTA (Retake if failed, Browse if passed), rest as ghost.

### Outstanding — P3 (polish)

- **Page transitions:** 150ms fade between quiz pages.
- **Exam sim pagination for 150Q:** Dot nav meaningless at 30 pages. Replace with "Page X of Y" + collapsible minimap grid.
- **Mobile nav wrapping:** Pill nav wraps on small screens. Add `overflow-x-auto` to container as immediate fix.

### Not yet started — from archived specs

The following items from `docs/archive/NPE_FEATURE_SPEC.2026-04-09.md` and `docs/archive/UX_REFACTOR_SPEC_v2.2026-04-09.md` have not been touched:

- **Profile page** (§Issue 3): render layer underdeveloped — quiz domain performance, resource progress, community activity, account settings all missing.
- **Schedule: study plan weeks on calendar** (§Issue 2): personal study blocks not visible on schedule.
- **Schedule: session type filter** (§Issue 2): implementation guide exists in `P2_IMPLEMENTATION_GUIDE.2026-04-09.md` but status unclear — verify in code.
- **Schedule: .ics calendar export** (§Issue 2): not implemented.
- **Landing page: quick links section** (§Issue 1): not implemented.
- **Landing page: "how it works" jargon fix** (§Issue 1): status unclear — verify `approved_users` text is gone from public page.
