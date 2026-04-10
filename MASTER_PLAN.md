# NPE Study Club — Master Plan

Last updated: 2026-04-10

This document is the single source of truth for all active and planned work. It supersedes `NEXT_AGENT_HANDOFF.md`, `REFACTOR_STATUS.md`, `RESOURCE_SETUP_TOMORROW.md`, and `QUESTION_GENERATOR_PLAN.md` (kept in repo for reference). Any new agent session should read this file first.

---

## Context

NPE Study Club is a private exam prep hub for a small, known cohort — approximately 20 provisional psychologists from the 2025 HMPP cohort preparing for the 5+1 pathway NPE. Membership is manually approved and expected to grow slowly. The tone, copy, and UX should reflect this: it is a tight community resource, not a scalable SaaS product. This matters for copy decisions, access expectations, and feature priorities.

---

## Current State (as of 2026-04-10)

**Working in production:**
- Auth flow: password-first member sign-in, email confirm/reset
- Request + admin approval flow with access_requests table
- Member-gated RLS policies (tightened to require approved status)
- Dashboard with resource progress, quiz performance, upcoming sessions, key references
- Study plan: onboarding, weekly timeline generation, study-time logging (hours, topics, quiz insight, notes)
- Quizzes: browser, quiz-taking flow, upload (5-option A–E), quiz history, explanation voting
- NPE quiz pipeline: seeded JSON question sets, weekday daily availability, delayed moderator review threads
- Schedule calendar: exam window markers, ad-hoc sessions
- Community: channels, thread detail, nested replies, upvotes
- Resource library: filtering, completion tracking (signed URLs — currently broken pending storage setup)
- Admin: user management, access approvals

**Known broken / incomplete:**
- Resource file storage not connected (DigitalOcean Spaces env vars not configured — uploads have no backend)
- No active state on member nav links
- "Preview mode on? Open app now" link exposed on public request access page
- Form data wiped on validation failure (server-side redirect)
- Exam countdown is hardcoded to a single date and will show 0 after May 2026

---

## Hard Blockers — Do First

### 1. Resource storage setup

Resource file access is the primary unblocked feature. Nothing else in this area should be touched until storage is confirmed working end-to-end. Connor wants to upload 1 PDF and 1 Word doc as the first test.

**Decision: pick one mode and validate it fully before moving on.**

**Option A — Supabase bucket (fastest unblock)**
1. Confirm private bucket `resources` exists in Supabase.
2. Confirm upload/read/delete policies match the current upload action.
3. Upload a test PDF and a test Word doc from `/add`.
4. Confirm metadata row is created in `resources` table.
5. Confirm member can open/download from `/resources`.

**Option B — DigitalOcean Spaces (preferred long-term)**
1. Confirm these env vars are set in both `.env.local` and Vercel dashboard:
   - `DO_SPACES_KEY`
   - `DO_SPACES_SECRET`
   - `DO_SPACES_REGION`
   - `DO_SPACES_BUCKET`
   - `DO_SPACES_ENDPOINT`
2. Confirm upload path writes object key into `resources.file_path`.
3. Confirm signed URL generation works server-side for member downloads.
4. Upload a test PDF and test Word doc from `/add` and verify download in `/resources`.
5. Verify failure handling shows an actionable message when keys/bucket are misconfigured.

**Capture in summary:** which mode was used, exact env/config changes, result of upload + download test, any remaining blocker.

---

## Phase 1 — Fix Immediately (P1)

These are live bugs or significant friction points. Address in a single focused pass.

### 1.1 Remove developer escape hatch from public request form

**File:** `app/auth/request/page.tsx`

Remove or hide the link at the bottom of the form:
```
Preview mode on? Open app now → /dashboard?admin=1
```
This is visible to every provisional psychologist submitting their PSY number. Wrap in `process.env.NODE_ENV === 'development'` guard at minimum, or remove entirely if not needed in production.

### 1.2 Fix form data loss on validation failure

**File:** `app/auth/request/page.tsx`

The server action currently redirects on missing fields, wiping all form data. The form asks for name, email, PSY number, referral note, and a reason — losing it all on one missed field is a poor experience.

Fix: add client-side validation (HTML5 `required`, pattern checking) before the server action fires. The server action should remain the authoritative validator, but the client check should catch most cases before submission.

**Additionally:** `reason` (why you want access) should be **optional**, not required. Many members will come through a direct referral from Connor — the reason field is only needed for unknown applicants. Update the `required` attribute and server-side validation logic accordingly.

### 1.3 PSY number field — label and format guidance

**File:** `app/auth/request/page.tsx`

Add a visible `<label>` element and a helper line below the PSY field:
```
PSY number (if registered with AHPRA)
e.g. PSY0001234567
```
The current pattern validation fires only as a browser tooltip on submit error — this is not discoverable. The helper text should be visible before the user touches the field.

### 1.4 Add "Request access" link to login page

**File:** `app/auth/login/page.tsx`

Add below the login form:
```
Don't have access yet? Request membership →
```
The login page currently gives no path to a new visitor who doesn't have credentials, which is a dead end.

### 1.5 Add active state to member nav links

**File:** `app/(member)/layout.tsx`

Use `usePathname()` (or pass pathname via server component) to compare `link.href` against the current route and apply an active class to the matching pill. Example active class: `bg-primary text-primary-foreground`.

---

## Phase 2 — High Impact, Straightforward (P2)

### 2.1 Collapse member nav "Home" into "Dashboard"

**File:** `app/(member)/layout.tsx`

Remove the `{ href: "/", label: "Home" }` entry from `baseLinks` entirely. The "Dashboard" entry already exists and covers this. An approved member clicking "Home" and landing on the public marketing page is a disorienting experience.

### 2.2 Fix feature card destinations for non-approved visitors

**File:** `app/page.tsx`

The three feature cards (Resources, Schedule, Community) route non-approved visitors to `/auth/login`. These visitors cannot log in without approval — it is a dead end. Change the unapproved card href to `/auth/request` so the call to action is meaningful.

### 2.3 Consolidate landing page CTA duplication

**File:** `app/page.tsx`

Currently there are four CTAs across the header and hero doing the same two jobs. Simplify:

- **Header:** Replace "Request access" + "Member sign in" buttons with a single "Sign in" link (styled as a button, outline variant). The hero is the right place for the primary access CTA.
- **Hero:** Keep "Apply for membership" (primary) and "Already a member? Sign in" (secondary). This is the right pair for most visitors.

### 2.4 Revise exam countdown copy and logic

**File:** `app/page.tsx` + `components/member/exam-countdown.tsx`

Two issues:

1. **Hardcoded date:** The countdown to `2026-05-04` will show "0 days" after the window opens. After the May 2026 window, this needs to update to the next applicable date. Either make it data-driven (pull from `exam_windows` table or a config) or add a clear comment/flag so it's updated before it goes stale.

2. **Copy and framing:** The current countdown — a large bold number counting down to exam registration opening — adds pressure that isn't needed. For this cohort, the relevant timeline is:
   - When registrations open
   - When the exam sitting window opens
   - When the exam sitting window closes
   
   The countdown widget should show all three dates as a simple timeline, not a single ticking number. Keep it informational, not anxiety-inducing.

### 2.5 Revise landing page copy to reflect small cohort

**File:** `app/page.tsx`

The "Approved members get in. Everyone else requests access." section is worded to sound like a scalable service with an exclusive filtering process. For a ~20-person cohort of known peers from the 2025 HMPP cohort, this is slightly off-tone.

Suggested reframe:
- Replace "Everyone else requests access" with something warmer: "This is a private resource for a small group of peers. If you've been told about this space, you're probably in the right place."
- Remove "Membership is limited to trusted contacts and provisional psychologists registered with AHPRA" from the countdown card — this reads like a legal disclaimer, not a welcome.

### 2.6 Move new-user onboarding above ExamCountdown

**File:** `app/(member)/dashboard/page.tsx`

When `showOnboarding` is true (no study plan, no dismiss), the onboarding card should appear as the first content block after the hero — before `<ExamCountdown />`. Currently it is rendered after the admin section and countdown, which means a new member has to scroll past orientation before reaching the getting-started guidance.

---

## Phase 3 — Medium Priority (P3)

### 3.1 Deep-link dashboard resources to individual items

**File:** `app/(member)/dashboard/page.tsx`

"Recently Added Resources" items all link to `/resources` (the full unfiltered library). Each item should link to `/resources?id={resource.id}` or a dedicated resource view. This requires either:
- A query-param filter in `ResourceLibraryClient` that highlights/scrolls to the matching item, or
- A separate resource detail route `/resources/[id]`

Start with the query-param approach as the lower-effort path.

### 3.2 Clarify attempt count label in quiz domain performance

**File:** `app/(member)/dashboard/page.tsx`

Change the domain performance rendering from:
```
Domain Name - 72% (3)
```
to:
```
Domain Name · 72% avg · 3 attempts
```

### 3.3 Replace Community Activity zero-state with a CTA

**File:** `app/(member)/dashboard/page.tsx`

When both `threadsStarted` and `repliesCount` are 0, replace the two plain zero-stats with a single contextual CTA:
```
You haven't posted yet.
[Start a thread in Community →]
```
Stats are only meaningful once there's something to show. Display the numeric stats only when at least one is non-zero.

### 3.4 Supabase migration verification pass

Confirm all migrations are applied correctly in both dev and production:
- `supabase/001_npe_schema.sql`
- `supabase/002_feature_upgrade.sql`
- `supabase/003_p1_refactor.sql`
- `supabase/004_quiz_pipeline_upgrade.sql`
- `supabase/005_explanation_feedback.sql`
- `supabase/006_explanation_feedback_settings.sql`
- `supabase/007_noticeboard_publish_windows.sql`
- `supabase/008_study_plan_enhancements.sql`

Also confirm:
- Study-plan saves preserve the existing plan if regeneration fails
- Study-plan logs correctly save hours, topics covered, quiz insight, and notes
- Resource progress shows on dashboard (not only profile page)

### 3.5 Bulk-onboard initial members (~6 users)

Connor needs to manually onboard approximately 6 existing users who joined before the access request form was in place. These users do not need to submit a reason — they are known contacts. Options:
- Insert rows directly into `approved_users` table via Supabase dashboard (name, email, status = 'approved')
- Alternatively: build a simple admin bulk-add UI in `/admin` (deferred — Supabase direct insert is fine for now)

---

## Clinical Safeguarding — Community Forum

This section defines mandatory parameters for the community/forum feature. The forum exists for exam preparation discussion among provisional psychologists. It must not become a clinical supervision space or a venue where client information is shared.

### Why this matters

Connor is a provisional psychologist operating under supervision. The members are likewise provisional. Using a private forum to discuss clients — even with intent to deidentify — creates professional risk (APS Code of Ethics section B.1, privacy obligations), regulatory risk (Privacy Act), and exposes the platform to misuse. The safeguards below are non-negotiable.

### Forum scope — permitted and prohibited

**Permitted:**
- Hypothetical or composite case questions ("What would be a CBT-informed approach for a child with school refusal and co-occurring anxiety?")
- Exam technique and question interpretation discussions
- Resource sharing and recommendations
- Study schedule coordination
- General questions about provisional practice, supervision requirements, AHPRA registration
- Broad clinical framework questions (e.g., ethics of dual relationships, consent with minors)

**Prohibited:**
- Real client information of any kind — names, ages, school names, dates, locations, presenting issues specific enough to identify
- Supervisor names, organisation names, or identifiable placement details shared in clinical context
- Case consultation disguised as hypothetical ("I have a student who..." followed by identifying details)
- Screenshots of clinical documentation, case notes, or assessments
- Discussion of specific colleagues, supervisors, or organisations in a way that could be defamatory

### Implementation requirements

**1. Community guidelines page**
Create a standalone `/community/guidelines` page with the permitted/prohibited content above written in plain language. This page should be linked:
- From the community hub header
- From the thread creation form (as a reminder before posting)
- From the member onboarding checklist

**2. Thread creation disclaimer**
When a member opens a new thread, display a short reminder above the title field:
> "This forum is for exam prep discussion only. Do not share client, student, or placement information — even deidentified. Use hypothetical or composite framing for any clinical questions."

This should be a styled info banner (not a checkbox — the guidelines page handles consent), visible on every thread creation screen.

**3. Category constraints**
If the community uses channels/categories, include an explicit "Clinical Discussion" category scoped to hypothetical/exam-relevant content only, with the forum scope noted in the category description. Consider renaming it "Hypothetical Cases & Exam Prep" to signal the intended use upfront.

**4. Moderator controls**
Confirm (or implement) the following admin/moderator capabilities:
- Delete any thread or reply
- Edit a reply to remove identifying content (with an "edited by moderator" marker)
- Pin a moderator note to a thread flagging a content concern
- Ban/suspend a member from posting

Connor (as admin) should have all four capabilities. These should be accessible from the thread detail view without needing to navigate to `/admin`.

**5. Reporting mechanism**
Add a "Report this post" option on every thread and reply. Reports should:
- Create a row in a `content_reports` table (thread_id or reply_id, reporter_id, reason, created_at)
- Trigger an email notification to Connor's admin email
- The report action should be available without confirmation modal (one tap) but should show a confirmation after submission

**6. Future consideration — moderation queue**
Not needed immediately at ~20 members, but as the cohort grows, a moderation queue showing flagged content in `/admin` will be needed. Add to the deferred backlog.

---

## Question Generator — Polish Plan

(Absorbed from `QUESTION_GENERATOR_PLAN.md` — active, not deferred)

### Goal

Increase variation in daily question sets without reintroducing paid API calls, and without breaking the source registry traceability. Daily sets should feel meaningfully different from adjacent days.

### Working rule

If a change improves variety but weakens traceability to the source registry, it is rejected.

### Active steps

1. **Run a repetition audit first.** Run the generator against 5–7 adjacent days and compare: stems, distractor patterns, correct-answer position distribution, scenario shapes. Document which domains are most repetitive before writing any code.

2. **Expand domain banks.** For each domain showing repetition, add more stems, scenarios, and distractor patterns to the template bank. Aim for at least 3x current variety per domain.

3. **Add rotation rules.** Implement a constraint so the same template cannot repeat within a configurable lookback window (e.g., 5 days). This can be implemented as a simple used-recently tracker in the generator state.

4. **Add scenario metadata.** Tag each template with scenario type (risk, privacy, supervision, telehealth, communication, assessment) so the generator can balance types across a single daily set.

5. **Add a pre-write diversity check.** Before writing a seed file, the generator should calculate a template diversity score and log a warning if repetition thresholds are exceeded. This is a lint step, not a blocker.

6. **Nice-to-have:** Move from single-template questions to small scenario blueprints with interchangeable client details (age bracket, presenting concern, setting) so the same clinical shape can generate many surface-distinct questions.

### CI/pipeline preservation rules

- Keep the source bank registry checks intact
- Keep the current seed-file output shape (`seed/daily/`, `seed/fortnightly/`, `seed/staging/`)
- Do not change the GitHub Actions workflow unless there is a specific blocker
- Do not introduce paid API calls

---

## Deferred / Backlog

These are acknowledged but not scheduled. Do not start without a specific decision to do so.

| Item | Notes |
|------|-------|
| Saved resources / bookmarks | Schema likely needs a `user_bookmarks` table |
| Delete account flow | Requires cascade delete in Supabase |
| Notification preferences | In-app and email; needs a notifications table + email provider integration |
| Expanded admin operations | Beyond access approvals — bulk member management |
| Moderation queue in admin | Needed once >20 members; flagged reports visible in `/admin` |
| AI-assisted content generation | Deferred — requires paid API; only revisit if local generator stalls |
| Signed URL latency (resources) | As library grows, per-resource signed URL generation will slow; consider lazy generation or caching |
| Admin email check centralisation | `lib/admin-access.ts` already exists; member layout re-parses env on every render — consolidate |

---

## Outstanding QA Checklist

Before each deploy, verify:

- [ ] Quiz upload accepts 5 options (A–E) per question and template matches that shape
- [ ] Study-plan saves do not wipe current plan before a successful regeneration
- [ ] Study-plan logs save hours, topics covered, quiz insight, and notes
- [ ] Resource progress is visible on dashboard (not only profile page)
- [ ] Profile page links back to dashboard progress overview
- [ ] Resource upload (1 PDF + 1 Word doc) completes and download works
- [ ] Access request form: PSY field validates format before submit; reason field is optional
- [ ] "Preview mode" link absent from request page in production build
- [ ] Nav active state correctly highlights current page
- [ ] "Home" link absent from member nav (replaced by Dashboard only)
- [ ] New-user onboarding card appears as first content block for users without a study plan
- [ ] Community guidelines page accessible from forum header and thread creation form
- [ ] Thread creation form shows clinical safeguarding banner

---

## Handoff Notes for Next Agent

**Read this file first, then check REFACTOR_STATUS.md for current state.**

**Do first:**
1. Resource storage (Section: Hard Blockers). This is the only hard dependency. Nothing else ships without it.
2. P1 fixes (Section: Phase 1). Four small, low-risk changes. Deployable together.

**Then:**
3. P2 improvements (Section: Phase 2) — one focused pass.
4. Clinical safeguarding implementation (Section: Clinical Safeguarding) — community guidelines page + thread creation banner + moderator controls. Can be done in parallel with P2.

**Generator work:**
5. Run repetition audit before writing any generator code (Section: Question Generator).

**Leave alone:**
- Do not reintroduce paid API calls anywhere.
- Do not start backlog items without a clear decision.
- Do not run more implementation passes without testing the previous one first.
