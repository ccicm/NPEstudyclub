# NPE Study Club — UX Refactor Spec v2
**Target user:** Provisional psychologist from Connor's cohort — already knows what this is, already anxious about the NPE, needs tools not marketing.
**Prepared for:** Implementation agent (Next.js / Supabase / Tailwind / Cloudflare R2)
**Date:** April 2026

---

## Guiding Principle

Every member of this cohort already knows what NPE Study Club is and why they're here. The interface should feel like a well-organised study companion built *by* a peer *for* peers — not a SaaS product trying to sell them on signing up. Reduce noise, surface what matters, and let them get to work.

---

## Issue 1 — Landing Page (`/`) — Tone & Content

### What works
- Clean layout, sensible two-column split, countdown widget is genuinely useful.
- The three feature cards (Resources, Schedule, Community) correctly name the core value.

### What fails

**Tone is wrong for the audience.**
These are colleagues who have been personally invited. The current h1 — *"The club is live. The exam prep can be too."* — reads like a product launch tweet. It implies the user needs to be sold on the idea, which they don't. A provisional psychologist who just got a link from a peer doesn't need sass; they need immediate orientation.

**Developer jargon leaks into the public page.**
Step 2 of the "how it works" section reads: *"Add the email to approved_users."* This is an admin database instruction. A prospective member seeing this will be confused or alarmed. It should never appear in a user-facing surface.

**The "Launch tonight" badge.**
The section heading "Launch tonight" (`text-primary font-semibold uppercase`) is a dev-facing note that got promoted to UI copy. It means nothing to a member.

**Feature cards are dead ends.**
The three cards describe features but are not links. A logged-out visitor (or someone deciding whether to request access) cannot preview what they're walking into.

**Missing: quick-access links and resource calendar.**
Connor's brief references useful links, embedded calendars, and resources that existed in the previous version of the app. The current page has none. For members who are already approved and return to the landing page before signing in, there's no way to reach anything useful.

### Proposed fixes

**Rewrite the hero copy — strip the sass:**
```
h1: "NPE prep, in one place."
sub: "Private resources, study sessions, and community for provisional psychologists sitting the National Psychology Exam."
```
This is factual, calm, and peer-voiced. It does not need to be clever.

**Fix the how-it-works steps — remove jargon:**
```
1. Request    → Submit a short access request via the button below.
2. Approval   → Your request is reviewed and approved by the group organiser.
3. Access     → Once approved, you'll get an email with a sign-in link.
```

**Remove the "Launch tonight" badge entirely.** Replace with nothing, or if a badge is needed: `"Private · Invite only"`

**Make feature cards navigable.**
For logged-out users, clicking a card should navigate to `/auth/request` or `/auth/login`. Add a subtle `→` affordance to each card.

**Add a "Quick links" section below the feature cards.**
This replaces the useful-links panel from the original app. Suggested implementation:

```tsx
// Seed this in lib/quick-links.ts or pull from a `quick_links` Supabase table for admin control
const QUICK_LINKS = [
  { label: "AHPRA NPE info", url: "https://www.ahpra.gov.au/..." },
  { label: "APS exam resources", url: "https://..." },
  { label: "Registration checklist", url: "https://..." },
  // add more
];
```

Rendered as a simple card row with icon + label + external link icon. Keep it compact — one row, scroll on mobile.

**Add an embedded calendar section (logged-in only, or public).**
If group sessions are publicly visible (they probably should be to help people decide to join), show a read-only list of upcoming sessions pulled from Supabase (no auth required for read). No external calendar embed needed.

---

## Issue 2 — Schedule (`/schedule`) — Filters, Study Plan Integration & Calendar Export

### What works
- Calendar grid is functional, month navigation works, NPE window pills render correctly.
- Day detail panel is clear.
- Ad-hoc session form works.

### What fails

**No way to distinguish session types visually or filter by them.**
The current calendar shows all sessions with the same two pill styles (navy = any session, teal = ad-hoc). A member who wants to find only group study calls, or only sessions they personally added, has no way to do that. The `session_type` field exists in the DB but is not exposed as a filter control.

**"Upcoming sessions list" below the calendar duplicates the calendar.**
The section at the bottom (`<section className="rounded-2xl border bg-card p-4">`) lists every upcoming session again in plain text. This is redundant — the calendar already shows this. It adds cognitive load without adding information.

**Study plan weeks are invisible on the schedule.**
A member's personal study plan (weekly domain focus, preferred study days) has no representation on the schedule. Members have to switch between `/study-plan` and `/schedule` with no connection between them.

**No way to export the schedule to a personal calendar app.**
Members can't get group sessions or their study plan into Apple Calendar, Outlook, etc. without Google Calendar.

### Proposed fixes

**Add a filter bar above the calendar:**

```
[All]  [Group]  [Ad-hoc]  [My study plan]  [My sessions]
```

Implementation: add a `filter` state in `ScheduleCalendar` → `useState<'all' | 'group' | 'adhoc' | 'studyplan' | 'mine'>('all')`. Filter the combined events array before rendering. Pass `userId` and `studyPlanWeeks` as props from the server component.

**Colour-code event pills by type:**

| Type | Pill style |
|---|---|
| Group session | `bg-slate-800 text-slate-100` (existing navy) |
| Ad-hoc session | `bg-primary/15 text-primary` (existing teal) |
| My study block | `bg-violet-100 text-violet-700` (purple — personal, private) |
| NPE exam window | `bg-amber-100 text-amber-700` (existing amber — keep) |

Add a legend row below the month navigation — four small pills with labels.

**Study plan weeks on the calendar (private to each member).**
Each member's study plan has weeks with a `week_start` date and `preferred_days`. Render these as personal study blocks on the calendar — visible only to the logged-in member, not to other cohort members. Each block pill shows the domain focus (e.g. "Ethics & law"). Clicking a study block in the day detail panel shows the week's suggested resource and quiz with direct links.

Implementation: the server component fetches the member's `study_plan_weeks` alongside sessions and passes both to `ScheduleCalendar`. Study blocks are generated client-side from `week_start + preferred_days` — no extra DB table needed.

```ts
// Generate study block dates from plan weeks + preferred days
function studyBlockDates(weeks: StudyPlanWeek[], preferredDays: string[]): DayEvent[] {
  return weeks.flatMap(week => {
    const days = eachDayOfWeek(new Date(week.week_start), preferredDays);
    return days.map(day => ({
      kind: 'studyblock',
      id: `${week.id}-${dateKey(day)}`,
      domain: week.domain_focus,
      weekId: week.id,
      at: day,
    }));
  });
}
```

**Remove the redundant "Upcoming sessions list" section.**
Delete the `<section>` at the bottom of `schedule-calendar.tsx` (lines 303–319). The calendar already shows everything.

**Add `session_type` field to the add-session form.**
Currently the form defaults to `Ad-hoc`. Add a visible selector:
```
Session type: [Group | Ad-hoc | Personal]
```
Any member can add any type — no approval flow.

**`.ics` export — study plan download.**
A "Download study plan" button on both `/study-plan` and `/schedule` generates an iCal (`.ics`) file containing:
- One event per study block (domain focus as title, notes with suggested resource/quiz links)
- All upcoming group sessions from the DB
- NPE exam window events (from `EXAM_WINDOWS` config)

Format: standard RFC 5545 iCal. Works with Apple Calendar, Outlook, any calendar app. Zero Google dependency — this is an open standard.

```ts
// lib/ical.ts — server-side generation
import ical from 'ical-generator';

export function generateStudyPlanIcal(weeks: StudyPlanWeek[], sessions: Session[]) {
  const cal = ical({ name: 'NPE Study Club' });
  weeks.forEach(week => { /* add events per preferred day */ });
  sessions.forEach(session => { /* add group sessions */ });
  EXAM_WINDOWS.forEach(window => { /* add exam window events */ });
  return cal.toString(); // returns .ics string
}
```

Server action streams the `.ics` string as a file download with `Content-Type: text/calendar`.

Package required: `ical-generator` (lightweight, no Google dependency).

---

## Issue 3 — Profile (`/profile`) — Empty state & missing features

### What works
- Data fetches for `user_progress`, `quiz_results`, and `study_plans` are already in the server component.
- The DB schema supports everything needed.

### What fails

**The render layer is underdeveloped.**
The server component fetches data but the UI does not display it meaningfully. From Connor's report, the page appears essentially blank. The data is there — it's just not rendered.

**No starred/saved resources.**
There is no `saved_resources` or `bookmarks` table or UI. Members cannot flag resources to return to later.

**No post following or comment activity.**
There is no concept of "threads I've replied to" or "threads I'm watching". A member who commented in a forum thread has no way to find that thread again without browsing the community.

**No account settings.**
Members cannot change their display name, update their password, or manage their email. There is no settings UI at all. `supabase.auth.updateUser()` supports all of this but it hasn't been surfaced.

**Quiz progress is not visualised by domain.**
Quiz results exist in the DB but the profile only shows totals. A member cannot see "I'm scoring 85% in Ethics but 40% in Psychopathology" — which is exactly the insight they need with the exam coming.

### Proposed layout

```
─────────────────────────────────────────────
  [Avatar initials]  connor@email.com
                     Member since: March 2026
─────────────────────────────────────────────

[Study Plan]                    [Quiz Performance]
Exam: May 2026                  12 quizzes taken
Plan: 60% complete    →         Avg score: 74%
                                Best: Ethics & law
                                Needs work: Formulation

─────────────────────────────────────────────
[Resource Progress]
34 of 67 resources completed  ████████░░░░  51%
Recent: Cognitive Assessment Summary, CBT for Anxiety...
[View all completed →]

─────────────────────────────────────────────
[Saved Resources]  (bookmarks)
[Resource card] [Resource card] [Resource card]
Empty state: "Bookmark resources from the library to find them here."

─────────────────────────────────────────────
[My Community Activity]
Threads I started: 3
Threads I've replied to: 7
[View my posts →]  (links to /community filtered to user's posts)

─────────────────────────────────────────────
[Account Settings]  (collapsible section)
  Display name:  [Connor M.]    [Save]
  Email:         connor@...     (read-only, auth email)
  Password:      [Change password →]  (routes to /auth/update-password)
─────────────────────────────────────────────
```

### Required new pieces

**1. Saved resources / bookmarks**

New Supabase table:
```sql
create table public.saved_resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  resource_id uuid references public.resources(id) on delete cascade,
  saved_at timestamptz default now(),
  unique(user_id, resource_id)
);
alter table public.saved_resources enable row level security;
create policy "Users manage own saved_resources" on public.saved_resources
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

On resource cards (`/resources`): add a bookmark icon button (outline → filled on save). Optimistic UI toggle. Saved resources appear in the profile Saved section.

**2. Community activity summary**

Query `forum_threads` and `forum_replies` filtered by `user_id`:
```ts
const { count: threadsStarted } = await supabase
  .from('forum_threads')
  .select('id', { count: 'exact', head: true })
  .eq('author_id', user.id);

const { count: repliesCount } = await supabase
  .from('forum_replies')
  .select('id', { count: 'exact', head: true })
  .eq('author_id', user.id);
```

"View my posts →" links to `/community?author=me` (requires a filter param in the community page — simple string match against `author_id`).

**3. Quiz performance by domain**

Query `quiz_results` joined to `quizzes` to get domain-level breakdown:
```ts
const { data: quizResults } = await supabase
  .from('quiz_results')
  .select('score, total_questions, quizzes(domain)')
  .eq('user_id', user.id);
```

Group by domain client-side → compute average score per domain → render as a small grid of domain pills with colour-coded score badges (green ≥70%, amber 50–69%, red <50%).

**4. Account settings**

Use `supabase.auth.updateUser()`:
```ts
// Server action
'use server'
await supabase.auth.updateUser({ data: { display_name: formData.get('display_name') } });
// Password change
await supabase.auth.updateUser({ password: formData.get('new_password') });
```

Alternatively, route "Change password" to the existing `/auth/update-password` page — it's already built.

Display name is stored in `user_metadata.display_name`. Surface it wherever the member's name appears (session host name, forum posts, etc.).

**5. Empty states — all sections need them**

| Section | Empty state copy |
|---|---|
| Saved resources | "Bookmark resources from the library to save them here." |
| Quiz performance | "Take a quiz to see your performance by domain." |
| Community activity | "You haven't posted yet — join a thread in Community." |
| Resource progress | "Open resources from the library to track your progress." |

---

## Priority-Ordered Refactor Plan

These are ordered by user-visible impact vs implementation effort.

### P1 — Quick wins, high impact

1. **Rewrite landing page hero copy and fix step 2 jargon.** 15 min change to `app/page.tsx`. No schema changes. Immediate improvement for every new member.

2. **Remove "Launch tonight" badge from landing page.** One-line delete.

3. **Remove redundant "Upcoming sessions list" from schedule.** Delete ~20 lines from `schedule-calendar.tsx`. Reduces noise immediately.

4. **Render the existing profile data properly.** The fetches in `profile/page.tsx` already pull `user_progress`, `quiz_results`, and `study_plans`. The render layer just needs to be built out. No new DB work required for the basics.

5. **Add account settings (display name + password change link) to profile.** Small form + one server action. Routes password change to existing `/auth/update-password`.

### P2 — Medium effort, clear user need

6. **Add session type filter bar to schedule.** State-only change in `ScheduleCalendar`, no DB changes. Requires passing `userId` from the server page component.

7. **Add colour-coded legend to calendar.** Purely presentational — add a legend row to `schedule-calendar.tsx`.

8. **Add `session_type` selector to the add-session form.** One new `<select>` field, update the server action to use it.

9. **`meet_link` → `video_link` rename.** DB column rename + update all TypeScript types, queries, and UI labels. "Video call link" accepts any URL — Zoom, Teams, existing Meet links all continue to work.

10. **Add quiz performance by domain to profile.** Requires join query + client-side grouping. No schema changes.

### P3 — Requires new schema / more build time

11. **Add "Saved resources" (bookmarks).** New `saved_resources` table + bookmark button on resource cards + saved section on profile.

12. **Add quick links section to landing page.** Either hardcode in `lib/quick-links.ts` or add a `quick_links` Supabase table if admin control is needed.

13. **Add community activity summary to profile.** Requires `author_id` to be consistently set on `forum_threads` and `forum_replies`. Check existing schema — if it's `user_id` not `author_id`, adjust queries accordingly.

14. **"View my posts" filter in `/community`.** Add `?author=me` query param support to `community-hub.tsx`.

---

## Issue 4 — User Self-Management (`/profile/settings`)

### What's needed

Members must be able to manage their own accounts without involving Connor. Four capabilities confirmed:

**1. Display name**
Stored in Supabase `user_metadata.display_name`. Surfaces in: forum posts, session host field, resource uploader name, profile header. Single text input + save button. Server Action calls `supabase.auth.updateUser({ data: { display_name } })`.

**2. Email + password change**
- Email: `supabase.auth.updateUser({ email: newEmail })` — Supabase sends a confirmation link to the new address before switching. Show a banner: "Check your new email to confirm the change."
- Password: route to existing `/auth/update-password` page (already built). Surface as a simple "Change password →" link in settings — no duplication needed.

**3. Notification preferences**
Members control two channels — in-app and email — independently per notification type.

Notification types for v1:
| Event | In-app | Email |
|---|---|---|
| Someone replies to my thread | ✓ | ✓ |
| Someone replies to a thread I commented on | ✓ | ✓ |
| New post in a channel I follow | ✓ | ✓ |
| New resource added | ✓ | opt-in |
| Admin announcement | ✓ | ✓ (always on) |

Store preferences in a `notification_preferences` table:
```sql
create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) unique,
  reply_to_my_thread_inapp boolean default true,
  reply_to_my_thread_email boolean default true,
  reply_to_followed_inapp boolean default true,
  reply_to_followed_email boolean default true,
  new_post_in_channel_inapp boolean default true,
  new_post_in_channel_email boolean default false,
  new_resource_inapp boolean default true,
  new_resource_email boolean default false,
  updated_at timestamptz default now()
);
alter table public.notification_preferences enable row level security;
create policy "Users manage own preferences" on public.notification_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

UI: a clean two-column toggle table (In-app | Email) for each event type. Auto-saves on toggle (no submit button needed — each toggle fires a server action).

**In-app notifications** — new `notifications` table:
```sql
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  type text not null,  -- 'thread_reply' | 'followed_reply' | 'channel_post' | 'new_resource' | 'announcement'
  title text not null,
  body text,
  link text,          -- e.g. '/community/[threadId]'
  is_read boolean default false,
  created_at timestamptz default now()
);
alter table public.notifications enable row level security;
create policy "Users read own notifications" on public.notifications
  for select using (auth.uid() = user_id);
create policy "Users update own notifications" on public.notifications
  for update using (auth.uid() = user_id);
```

Notification bell in the nav header: shows unread count badge. Clicking opens a dropdown list of recent notifications. Clicking a notification marks it read and navigates to `link`.

**Email notifications** — use Supabase Edge Functions triggered by DB inserts (via `pg_net` or Supabase webhooks). For v1, trigger on `forum_replies` insert: look up thread author and commenters, check their `notification_preferences`, send via Supabase Auth email (or Resend if more control is needed).

**4. Delete my account**

A destructive action — requires an explicit confirmation step.

Flow:
1. Settings page: "Delete my account" button (red, at the bottom, below a horizontal rule)
2. Clicking opens a modal: "This will permanently delete your account, posts, and progress. This cannot be undone. Type DELETE to confirm."
3. On confirm: server action runs in order:
   - Anonymise forum posts (`author_id = null`, name replaced with "Deleted member") rather than hard-deleting — preserves thread integrity
   - Delete `user_progress`, `quiz_results`, `study_log`, `saved_resources`, `notification_preferences`, `study_plans` rows for this user
   - Call `supabase.auth.admin.deleteUser(userId)` (requires service role key — run server-side only)
   - Redirect to `/` with a query param `?deleted=1` that shows a brief confirmation message

---

## Issue 5 — Google Migration Plan

All Google dependencies are being replaced. The app's own infrastructure handles everything previously delegated to Google.

### What's being replaced

| Google product | Replaced by | Action required |
|---|---|---|
| Google Calendar | App's `/schedule` page + `.ics` export | None — app IS the calendar. Members export via `.ics`. |
| Google Drive (resources) | DigitalOcean Spaces | Bulk upload script (see Issue 6) |
| Google Meet links | Any video URL (flexible) | Rename field + update label in UI |

### meet_link → video_link rename

Replace everywhere:
- DB column: `alter table public.sessions rename column meet_link to video_link;`
- All TypeScript types and queries referencing `meet_link`
- UI label: "Google Meet link" → "Video call link"
- Placeholder: `https://meet.google.com/...` → `https://zoom.us/j/... or any video call link`
- Existing Meet URLs in the DB continue to work — the field is just a URL, the name change is cosmetic

### Access request form — PSY number field

AHPRA automated lookup is deferred. However, add a PSY number field to the access request form now so the data is captured for future use:

```tsx
// app/auth/request/page.tsx — add to form
<label>
  <span>AHPRA registration number (PSY...)</span>
  <input name="psy_number" placeholder="PSY0001234567" pattern="PSY\d{10}" />
  <p>Optional — helps us verify your provisional registration status.</p>
</label>
```

Store in the `access_requests` table (add `psy_number text` column). When AHPRA lookup is implemented later, this field is already populated.

---

## Issue 6 — File Storage: DigitalOcean Spaces

### Why DigitalOcean Spaces instead of Supabase storage

Supabase storage free tier is 1GB — not enough for hundreds of member-uploaded PDFs. The GitHub Student Developer Pack includes **$200 in DigitalOcean credit**. DigitalOcean Spaces (their object storage product) costs $5/month for 250GB + 1TB outbound transfer. $200 credit = **~40 months free at 250GB capacity**. That covers well over 3 years of file storage at no cost.

Spaces is fully S3-compatible — the integration code is identical to Cloudflare R2, just with a different endpoint. All other Supabase services (auth, DB, Edge Functions) remain unchanged.

**Storage recommendation summary:**
| Option | Capacity | Cost | Notes |
|---|---|---|---|
| Supabase (current) | 1GB | Free | Too small |
| Cloudflare R2 | 10GB free, then $0.015/GB | Free to start | Good but 10GB fills fast with active uploads |
| **DigitalOcean Spaces** | **250GB** | **~40 months free via student credit** | **Best option — use this** |

### Integration approach

DigitalOcean Spaces is fully S3-compatible. The integration uses the AWS SDK v3 with a custom endpoint — identical approach to Cloudflare R2, just different environment variables. The app needs two changes:

**1. Upload path** — replace `supabase.storage.from('resources').upload(...)` with a signed URL upload to Spaces:

```ts
// lib/storage.ts
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const spaces = new S3Client({
  region: process.env.DO_SPACES_REGION!,  // e.g. 'syd1' (Sydney)
  endpoint: `https://${process.env.DO_SPACES_REGION}.digitaloceanspaces.com`,
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY!,
    secretAccessKey: process.env.DO_SPACES_SECRET!,
  },
});

export async function getUploadUrl(key: string, contentType: string) {
  return getSignedUrl(spaces, new PutObjectCommand({
    Bucket: process.env.DO_SPACES_BUCKET!,
    Key: key,
    ContentType: contentType,
  }), { expiresIn: 300 });
}

export async function getDownloadUrl(key: string) {
  return getSignedUrl(spaces, new GetObjectCommand({
    Bucket: process.env.DO_SPACES_BUCKET!,
    Key: key,
  }), { expiresIn: 3600 });
}
```

New env vars (add to `.env.example`):
```
DO_SPACES_KEY=
DO_SPACES_SECRET=
DO_SPACES_REGION=syd1
DO_SPACES_BUCKET=npe-resources
```

Choose region `syd1` (Sydney) for lowest latency to Australian members.

**2. Download path** — replace Supabase signed URL generation with `getDownloadUrl(resource.file_path)` wherever the "Open file" button appears. File path stored in DB remains the same format (`resources/{uuid}/{filename}`), just the storage backend changes.

### Bulk resource upload script

Connor's files are in OneDrive/Dropbox. Workflow:
1. Download everything to a local folder, organised however (flat or nested by category)
2. Run `node scripts/bulk-upload.mjs ./resources-folder/`

Script behaviour:
- Walks the folder recursively
- For each file: uploads to Spaces at `resources/{uuid}/{filename}`
- Inserts a row to Supabase `resources` table with:
  - `title`: filename without extension (can edit in UI afterwards)
  - `file_type`: extension (pdf, docx, pptx, etc.)
  - `file_path`: the R2 key
  - `category`: inferred from subfolder name if structure is `ExamPrep/`, `ClinicalPractice/` — otherwise left blank for manual assignment
  - `uploaded_by`: Connor's user ID (passed as argument or from env)
- Prints progress: `[12/47] Uploading formulation-template.pdf...`
- Skips files already in the DB (by filename match) — safe to re-run

---

## Updated Priority-Ordered Refactor Plan

### P1 — Quick wins, no schema changes

1. Rewrite landing page hero copy, fix step 2 jargon, remove "Launch tonight" badge
2. Remove redundant "Upcoming sessions list" from schedule
3. Rename `meet_link` → `video_link` in DB + codebase + UI label
4. Add PSY number field to access request form (+ `psy_number` column in `access_requests`)
5. Render existing profile data properly (fetches already written, render layer needs building)
6. Add account settings: display name, email change, link to `/auth/update-password`

### P2 — Medium effort, clear user need

7. Add session type filter bar + colour legend to schedule
8. Add `session_type` selector to add-session form
9. Run Google Sheets → Supabase import (provide script, Connor runs once)
10. Add quiz performance by domain to profile
11. Add community activity summary to profile (threads started, replies)
12. Add quick links section to landing page

### P3 — New schema required

13. Set up DigitalOcean Spaces integration (`lib/storage.ts` + env vars)
14. Swap resource upload/download to use DigitalOcean Spaces instead of Supabase storage
15. Run bulk resource upload script (Connor downloads from OneDrive/Dropbox first)
16. Add saved resources / bookmarks (`saved_resources` table + bookmark toggle on cards + profile section)
17. Add "Delete my account" flow (anonymise posts + delete user)

### P4 — Notifications infrastructure

18. Create `notifications` table + in-app notification bell in nav
19. Create `notification_preferences` table + settings UI (toggle table)
20. Add email notifications via Supabase Edge Function on `forum_replies` insert
21. Wire remaining notification triggers (channel posts, new resources, announcements)

### Deferred (revisit post-launch)

- AHPRA automated PSY number verification (PSY number is now captured at sign-up — data is ready when this gets built)
- Push notifications (mobile PWA)
- Admin dashboard for managing `key_references`, `quick_links`, and `approved_users` without Supabase dashboard access

---

## Privacy & Data Collection — PSY Number (and general)

> ⚠️ This is not legal advice. Connor should review with a privacy professional if uncertain.

### What triggers this

Collecting a PSY number (AHPRA registration number) is collecting **personal information** under the *Privacy Act 1988* (Cth) and the **Australian Privacy Principles (APPs)**. More specifically, it may also constitute **sensitive information** if it reveals a person's health practitioner status or professional standing — which attracts stricter handling obligations.

The app also collects: email address, display name, forum posts, quiz results, study progress. All personal information under the Act.

### Small business exemption

The Privacy Act's small business exemption (turnover < $3M/year) may apply to a non-commercial private study club. However, the exemption does **not** apply if the entity collects sensitive information about individuals. If PSY numbers are deemed sensitive information, the exemption is unavailable regardless of scale.

**Practical recommendation:** treat this as Privacy Act-subject regardless — the compliance burden for a small app is low and the risk of being caught out matters more as the cohort grows.

### What's required — minimum viable compliance

**1. Collection notice on the access request form**

At the point of collecting the PSY number (and email), APP 5 requires a notice covering:
- Who is collecting the data (the site operator — Connor, or a nominated entity)
- Why it's being collected (membership verification, study planning, community features)
- Whether it will be disclosed to third parties (currently: no)
- How to access or correct it
- That it is stored securely (Supabase with row-level security)

This does not need to be a full legal document — a short paragraph above the form field is sufficient:

```
"Your AHPRA registration number is collected to verify your provisional
psychologist status. It is stored securely and not shared with third parties.
You may request correction or deletion of your data by contacting [email]."
```

**2. Privacy Policy page**

A publicly accessible `/privacy` page (or linked from the footer of `app/page.tsx`) should cover:
- What personal information is collected and why
- How it is stored (Supabase, Australia/US data centres — disclose location)
- Retention period (e.g. "until you delete your account, or the site is closed")
- How to request access, correction, or deletion (the account deletion flow handles deletion)
- Contact for privacy queries

This can be a simple static page — a few hundred words. Does not need to be drafted by a lawyer for a private cohort tool of this size.

**3. Consent**

Including a checkbox on the sign-up form is clean practice:
```
☐ I agree to the Privacy Policy and consent to my personal information
  (including my AHPRA registration number) being stored for the purpose
  of membership verification and participation in NPE Study Club.
```

**4. Secure storage**

Already handled by the existing architecture:
- Supabase with Row Level Security — users can only read their own sensitive data
- PSY number stored in `access_requests` table, accessible only to the admin and the user themselves
- All data in transit encrypted (HTTPS / Supabase TLS)

### Implementation tasks

Add to P1:
- Write `/privacy` page (static, ~400 words)
- Add collection notice text above PSY number field on `/auth/request`
- Add consent checkbox to `/auth/request` form (store `consented_at` timestamp in `access_requests`)

Add to P3 (existing delete account flow):
- Ensure account deletion removes PSY number from `access_requests` table as well

---

## Issue 7 — AI Question Generation Pipeline

### Purpose

Supplement the member-uploaded quiz bank with LLM-generated question variants. Built as a parallel track — does not block other features shipping. Questions go through a moderation queue before members can attempt them.

### Copyright-safe approach

Official APS sample questions may be copyright-protected. Generated questions must be seeded by **topic and domain**, not by copying verbatim question text. The correct prompt pattern is:

```
Generate a 4-option multiple-choice question for the National Psychology Exam.
Domain: Ethics & Law
Topic: Dual relationships in a supervisory context
Difficulty: Application-level (not just recall)
Format: Question stem, options A–D, correct answer, 150-word explanation.
Do not reproduce any published exam questions.
```

Own-authored questions from the cohort can be fed in more directly — these are clean copyright.

### Generation flow

```
[Topic input: domain + subtopic + difficulty]
         ↓
[Server Action → Claude API (claude-sonnet-4-6)]
         ↓
[N variants returned as structured JSON]
         ↓
[Inserted to quiz_questions with status = 'pending_review']
         ↓
[Appears in /admin moderation queue]
         ↓
[Admin approves / edits / rejects]
         ↓
[status = 'active' → live in quiz bank]
```

### Schema additions

```sql
-- Add status and generation metadata to quiz_questions
alter table public.quiz_questions
  add column status text not null default 'active'
    check (status in ('active', 'pending_review', 'under_review', 'rejected')),
  add column is_ai_generated boolean default false,
  add column generation_prompt text;  -- for audit trail

-- Question flags (peer review)
create table public.quiz_question_flags (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references public.quiz_questions(id) on delete cascade,
  user_id uuid references auth.users(id),
  reason text,
  flagged_at timestamptz default now(),
  unique(question_id, user_id)
);
alter table public.quiz_question_flags enable row level security;
create policy "Members can flag questions" on public.quiz_question_flags
  for insert with check (auth.uid() = user_id);
create policy "Members can read own flags" on public.quiz_question_flags
  for select using (auth.uid() = user_id);
```

### Generation UI

A simple generation panel in `/admin` (or accessible to all members as a "Suggest questions" form):

```
Domain *        [dropdown]
Subtopic        [text input — e.g. "Section 3.4 Code of Ethics"]
Difficulty      [Recall | Application | Analysis]
Number to generate [1 | 5 | 10]
[Generate →]
```

On submit: server action calls Claude API, returns structured questions, inserts with `status = 'pending_review'` and `is_ai_generated = true`. Admin sees them in the moderation queue.

### Env var required

```
ANTHROPIC_API_KEY=sk-ant-...
```

Add to `.env.example`.

---

## Issue 8 — Question Flagging → Auto Community Thread

### Flow

When a quiz question is flagged by 2 or more members:

1. Question `status` changes to `'under_review'` — excluded from active quiz attempts
2. A `forum_thread` is automatically created:
   - `channel`: `'exam-prep'`
   - `title`: `"Question needs review: [first 80 chars of question_text]"`
   - `body`: includes question text, all options, the keyed answer, and: *"This question has been flagged by members as potentially incorrect. Please discuss the correct answer below."*
   - `tag`: `'Question'`
   - `is_auto_generated`: `true` (add this column to `forum_threads`)
   - `linked_question_id`: FK to the flagged question (add this column)
3. Members discuss in the thread — they can upvote replies supporting a particular answer
4. Admin resolves by either:
   - Editing the question (`correct_index` or option text) → status back to `'active'`
   - Rejecting the question → status `'rejected'`, thread pinned with resolution note

### Schema additions

```sql
alter table public.forum_threads
  add column is_auto_generated boolean default false,
  add column linked_question_id uuid references public.quiz_questions(id);
```

### Trigger logic (server-side)

Add to the flag insertion server action:

```ts
const { count } = await supabase
  .from('quiz_question_flags')
  .select('id', { count: 'exact', head: true })
  .eq('question_id', questionId);

if (count >= 2) {
  // Set question under_review
  await supabase.from('quiz_questions')
    .update({ status: 'under_review' })
    .eq('id', questionId);

  // Auto-create community thread
  await supabase.from('forum_threads').insert({
    channel: 'exam-prep',
    title: `Question needs review: ${question.question_text.slice(0, 80)}...`,
    body: formatReviewThreadBody(question),
    tag: 'Question',
    is_auto_generated: true,
    linked_question_id: questionId,
  });
}
```

---

## Issue 9 — Admin UI (`/admin`)

### Access control

Route is protected to Connor's account only. Check against a hardcoded admin email in middleware, or add an `is_admin` boolean to `approved_users` table.

```ts
// middleware.ts addition
if (pathname.startsWith('/admin') && user.email !== process.env.ADMIN_EMAIL) {
  redirect('/dashboard');
}
```

### Admin sections

**Access requests**
- List of pending requests: name, email, PSY number, submitted date, message
- Approve button → inserts to `approved_users`, sends Supabase auth invite email
- Reject button → optional rejection note, flags request as rejected
- Approved/rejected history tab

**Key references**
- Table of existing `key_references` rows: title, source, URL, `is_new` toggle, display order
- Edit in-place or via slide-over form
- Add new reference
- Drag to reorder (or numeric display_order input)

**Quick links**
- Same pattern as key references — manage the links shown on the landing page

**Question moderation queue**
- All questions with `status = 'pending_review'` or `'under_review'`
- Shows: question text, options, keyed answer, explanation, AI-generated flag, flag count
- Actions: Approve → `status = 'active'` | Edit (inline) | Reject → `status = 'rejected'`
- For `'under_review'` questions: link to the auto-generated community thread

**Member list**
- Read-only table of `approved_users`: email, display name, joined date
- Remove member button (sets `is_approved = false` in `approved_users`)

---

## Issue 10 — Resource Editing & First-Time Onboarding

### Resource editing

Members who uploaded a resource should be able to edit its metadata (title, category, domain, notes) and delete their own uploads.

On each resource card, show an edit icon (pencil) if `uploaded_by = current_user`. Clicking opens a slide-over form pre-filled with current metadata — same fields as the Add Resource form. Save calls a server action to update the `resources` row. No file re-upload needed (just metadata).

Delete: confirmation dialog → deletes the Spaces object and the Supabase row. Warn: "This will remove the file permanently for all members."

### First-time member onboarding

When a member logs in for the first time (no `study_plans` row exists for them), the dashboard shows an onboarding banner instead of empty cards:

```
┌─────────────────────────────────────────────────────┐
│  👋 Welcome to NPE Study Club                        │
│  You're in. Here's how to get started:              │
│                                                      │
│  1. Browse the resource library →                   │
│  2. Set up your study plan →          [Start plan]  │
│  3. Introduce yourself in Community →               │
└─────────────────────────────────────────────────────┘
```

- "Start plan" is a prominent CTA → navigates to `/study-plan` (triggers the onboarding wizard)
- Banner dismisses once the study plan exists OR the member dismisses it manually (store `onboarding_dismissed` in `user_metadata`)
- This banner only shows on the dashboard, not every page

### Session permissions (confirmed)

Any member can add any session type (Group, Ad-hoc, Personal). No approval flow needed. The session type filter on the calendar lets members manage what they see.

---

## Final Consolidated Priority Order

### P1 — Ship first (no schema changes beyond column renames)

1. Landing page copy rewrite + jargon fix + "Launch tonight" removal
2. Remove redundant sessions list from schedule page
3. Rename `meet_link` → `video_link` in DB + codebase + UI
4. Add PSY number field to access request form + `psy_number` column in `access_requests`
5. Add consent checkbox to `/auth/request` + `consented_at` column
6. Write `/privacy` page (static)
7. Render existing profile data (progress, quiz totals, study plan link) — no new DB queries
8. Add account settings to profile: display name, email change, link to password change
9. First-time member onboarding banner on dashboard

### P2 — Medium effort, clear user need

10. Schedule: session type filter bar + colour legend + `session_type` selector in add-session form
11. Study plan blocks on schedule (private per member, generated from `study_plan_weeks` + `preferred_days`)
12. `.ics` export button on `/schedule` and `/study-plan` (`ical-generator` package)
13. Quiz performance by domain on profile
14. Community activity summary on profile
15. Quick links section on landing page
16. Resource edit / delete by uploader

### P3 — New schema required

17. Set up DigitalOcean Spaces integration (`lib/storage.ts` + env vars)
18. Swap resource upload/download to DigitalOcean Spaces
19. Bulk upload script (`scripts/bulk-upload.mjs`)
20. Saved resources / bookmarks
21. Delete my account flow

### P4 — Admin UI

22. `/admin` route with access control
23. Access request approval/rejection UI
24. Key references + quick links management UI
25. Member list

### P5 — Notifications

26. `notifications` table + in-app notification bell
27. `notification_preferences` table + settings UI
28. Email notifications via Edge Function on forum reply insert
29. Remaining notification triggers

### P6 — AI question generation (parallel track)

30. `ANTHROPIC_API_KEY` env var + `lib/ai.ts` wrapper
31. Add `status`, `is_ai_generated`, `generation_prompt` columns to `quiz_questions`
32. Question generation form in `/admin` (or member-facing "Suggest questions")
33. Generation server action (Claude API call → structured JSON → insert with `status = 'pending_review'`)
34. Moderation queue in `/admin`
35. Question flag mechanism + `quiz_question_flags` table
36. Auto community thread on 2+ flags (`is_auto_generated`, `linked_question_id` columns)
37. Admin resolution flow (edit / approve / reject flagged questions)

### Deferred

- AHPRA automated PSY number verification (PSY number captured at sign-up — data ready)
- Push notifications
- Admin UI beyond P4 scope

---

## Notes for the Implementation Agent

- All copy changes to `app/page.tsx` are purely text replacements — no component changes needed.
- `session_type` field already exists in `sessions` — schedule filter is client-side state only, no new DB queries.
- For profile: build sections in order. Start with what's already fetched (progress, quiz totals, study plan link). Add bookmarks last as it needs schema migration.
- `supabase.auth.updateUser()` works from a Server Action with the server Supabase client.
- Display name in `user_metadata.display_name` — no separate `profiles` table needed for v1.
- `supabase.auth.admin.deleteUser()` requires service role key — server action only, never client-side.
- DigitalOcean Spaces uses AWS SDK v3 (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`) — install these. Use region `syd1` for Sydney proximity.
- AI generation uses `@anthropic-ai/sdk` — request structured output via tool use or a JSON-mode prompt.
- Question generation prompt must explicitly instruct the model not to reproduce published exam questions.
- Auto community thread creation runs as part of the flag insertion server action — no separate Edge Function needed for v1.
- All one-off migration scripts go in `/scripts/` with README documentation.
- The `ADMIN_EMAIL` env var gates the `/admin` route — add to `.env.example`.
- `.ics` export uses `ical-generator` npm package — install it. The server action returns the calendar string with `Content-Type: text/calendar` and `Content-Disposition: attachment; filename="npe-study-plan.ics"`.
- Study plan blocks on the schedule are generated entirely client-side from already-fetched `study_plan_weeks` data — no additional DB queries or API routes needed.
- `bulk-upload.mjs` is a one-off migration tool in `/scripts/` — it does not need to be part of the Next.js app build.