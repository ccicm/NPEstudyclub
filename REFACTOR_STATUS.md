# UX Refactor Implementation Status

**Last updated:** April 8, 2026  
**Target:** Complete all UX fixes from [UX_REFACTOR_SPEC_v2.md](UX_REFACTOR_SPEC_v2.md)

---

## ✅ P1 COMPLETE (6/6 items)

All major quick wins are done. These are user-visible, high-impact, low-effort fixes.

- ✅ Landing page hero copy rewritten
- ✅ "Launch tonight" badge removed  
- ✅ How-it-works steps fixed (no DB jargon)
- ✅ Feature cards are navigable (link to /auth/request)
- ✅ Profile data fully rendered
- ✅ Account settings (display name, email, password change)

**Related files:**
- [npe-web/app/page.tsx](npe-web/app/page.tsx) — Landing page
- [npe-web/app/(member)/profile/page.tsx](npe-web/app/(member)/profile/page.tsx) — Profile page

---

## 🔨 P2 TODO (5 items — Medium Effort, High Impact)

### 1. Schedule Filter Bar + Legend (2-3 hours) — Priority: HIGH

**What:** Add filter buttons (All, Group, Ad-hoc, My sessions) + color legend to calendar

**Status:** ❌ NOT STARTED

**Files to modify:**
- [npe-web/components/member/schedule-calendar.tsx](npe-web/components/member/schedule-calendar.tsx)

**Detailed tasks:**
```
[ ] Add useState hook: const [filter, setFilter] = useState<'all' | 'group' | 'adhoc' | 'mine'>('all')
[ ] Add filter buttons above calendar (render 4 buttons)
[ ] Add legend row: 4 pills with colored boxes + labels
    - Group session (bg-slate-800 text-slate-100)
    - Ad-hoc session (bg-primary/15 text-primary)
    - My study block (bg-violet-100 text-violet-700) — to be added in task #4
    - NPE exam window (bg-amber-100 text-amber-700)
[ ] Filter all events before rendering based on selected filter
[ ] Color coding already exists at line 53, just needs legend UI
```

---

### 2. Add session_type Selector to Form (1 hour) — Priority: HIGH

**What:** Let users pick Group/Ad-hoc/Personal when adding a study session instead of always defaulting to Ad-hoc

**Status:** ❌ NOT STARTED  
**Current issue:** Line 41 in actions.ts hardcodes `session_type: "Ad-hoc"`

**Files to modify:**
- [npe-web/components/member/schedule-calendar.tsx](npe-web/components/member/schedule-calendar.tsx) — form UI
- [npe-web/app/(member)/schedule/actions.ts](npe-web/app/(member)/schedule/actions.ts) — server action

**Detailed tasks:**
```
[ ] In schedule-calendar.tsx form section:
    - Add <select name="session_type"> with options [Group, Ad-hoc, Personal]
    - Place after the topic field
    - Default value: "Ad-hoc"
[ ] In actions.ts formData handling:
    - Read: const sessionType = String(formData.get("session_type") || "Ad-hoc")
    - Replace hardcoded "Ad-hoc" with sessionType variable
```

---

### 3. Quiz Performance by Domain (1.5 hours) — Priority: HIGH

**What:** Show quiz breakdown by domain (Ethics: 85%, Formulation: 60%, etc.) instead of just average

**Status:** ❌ NOT STARTED  
**Current state:** Line 146 in profile/page.tsx shows only average %

**Files to modify:**
- [npe-web/app/(member)/profile/page.tsx](npe-web/app/(member)/profile/page.tsx)

**DB support:** ✅ Domain column already exists in quizzes table

**Detailed tasks:**
```
[ ] Modify quiz_results query to join quizzes table for domain
    Current: .select("score,total_questions,completed_at")
    Change: .select("score, total_questions, completed_at, quizzes(domain)")

[ ] Group results by domain client-side:
    const domainStats = quizResultsWithDomain?.reduce((acc, result) => {
      const domain = result.quizzes?.domain || "Other";
      acc[domain] ??= [];
      acc[domain].push(result);
      return acc;
    }, {}) ?? {};

[ ] Calculate average per domain:
    const domainAvg = Object.entries(domainStats).map(([domain, results]) => ({
      domain,
      avg: Math.round(results.reduce((sum, r) => sum + ((r.score / r.total_questions) * 100), 0) / results.length)
    })).sort((a, b) => a.avg - b.avg); // lowest first

[ ] Render domain pills in quiz section:
    - Grid layout, 2-3 columns
    - Color: green (≥70%), amber (50-69%), red (<50%)
    - Show domain name + average % + count
    - Order by lowest score first (areas needing work)
```

---

### 4. Study Plan Weeks on Calendar (2-3 hours) — Priority: MEDIUM

**What:** Render study plan weeks as purple blocks on the calendar, showing what domain the user should focus on each week

**Status:** ❌ NOT STARTED  
**Current state:** DB table exists ✅ but UI not implemented

**Files to modify:**
- [npe-web/app/(member)/schedule/page.tsx](npe-web/app/(member)/schedule/page.tsx) — fetch
- [npe-web/components/member/schedule-calendar.tsx](npe-web/components/member/schedule-calendar.tsx) — render

**Detailed tasks:**
```
[ ] In schedule/page.tsx:
    - Add query for study_plan_weeks:
      const { data: studyPlanWeeks } = user ? await supabase
        .from("study_plan_weeks")
        .select("id, week_start, preferred_days, domain_focus")
        .eq("study_plan_id", userStudyPlanId)
      : { data: null };
    - Pass as prop to ScheduleCalendar: <ScheduleCalendar ... studyPlanWeeks={studyPlanWeeks} />

[ ] In schedule-calendar.tsx:
    - Accept studyPlanWeeks prop
    - Generate study block events from week_start + preferred_days
    - Add to allEvents Map (similar to how sessions are added, around line 92)
    - Render with color: bg-violet-100 text-violet-700
    - Show pill text: domain_focus (e.g., "Ethics & law")

[ ] Only show to logged-in user (private, not visible to other cohort members)
[ ] clicking block should expand detail panel showing week's resources/quizzes
```

---

### 5. Video Link Labels (15 min) — Priority: LOW

**What:** Verify all UI text changed from "Google Meet link" to "Video call link"

**Status:** ✅ PARTIALLY DONE  
**Done:** DB rename in migration ✅, code fetches video_link ✅  
**Needs verification:** UI labels

**Files to check:**
- [npe-web/components/member/schedule-calendar.tsx](npe-web/components/member/schedule-calendar.tsx)
- [npe-web/app/(member)/dashboard/page.tsx](npe-web/app/(member)/dashboard/page.tsx)
- Any form that displays link input

**Detailed tasks:**
```
[ ] grep or search for "Google Meet" in codebase — should be 0 matches
[ ] grep or search for "meet_link" in TypeScript — should be 0 matches (only in SQL comments)
[ ] Verify placeholder text mentions "zoom.us" or "any video call link"
[ ] Test with Zoom URL to confirm works with any provider
```

---

## 📊 P3 TODO (5 items — Requires New Schema + More Build Time)

### 1. Bookmarks / Saved Resources (3 hours) — Priority: MEDIUM

**What:** Let users bookmark resources to return to them later. Appears as new section on profile.

**Status:** ❌ NOT STARTED

**Files to create:**
- [npe-web/supabase/004_saved_resources.sql](npe-web/supabase/004_saved_resources.sql) — Migration with table + RLS

**Files to modify:**
- [npe-web/components/member/resource-library-client.tsx](npe-web/components/member/resource-library-client.tsx) — Add bookmark button
- [npe-web/app/(member)/resources/page.tsx](npe-web/app/(member)/resources/page.tsx) or actions.ts — Save/unsave action
- [npe-web/app/(member)/profile/page.tsx](npe-web/app/(member)/profile/page.tsx) — Fetch and render saved section

**Migration SQL:**
```sql
create table public.saved_resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete cascade,
  created_at timestamptz default now(),
  unique(user_id, resource_id)
);

alter table public.saved_resources enable row level security;

create policy "Users manage own saved resources"
  on public.saved_resources for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

**Detailed tasks:**
```
[ ] Create 004_saved_resources.sql migration file with table + RLS policy
[ ] In resource library component:
    - Add bookmark icon button (outline → filled on save/unsave)
    - Click toggles saved status via server action
    - Optimistic UI update (icon changes immediately)

[ ] Create server action (e.g., in app/(member)/resources/actions.ts):
    async function toggleSaveResource(resourceId: string) {
      // Check if already saved, toggle accordingly

[ ] On profile page:
    - Fetch: const { data: savedResources } = await supabase
        .from("saved_resources")
        .select("resources(*)")
        .eq("user_id", user.id);
    - Render new section "Saved Resources"
    - Grid of resource cards (3-4 per row)
    - Empty state: "Bookmark resources from the library to save them here"
```

---

### 2. Community Activity Summary (2.5 hours) — Priority: MEDIUM

**What:** Show user how many threads they started and replied to on profile, with link to filter by their posts

**Status:** ❌ NOT STARTED

**Files to modify:**
- [npe-web/app/(member)/profile/page.tsx](npe-web/app/(member)/profile/page.tsx) — Add activity section
- [npe-web/components/member/community-hub.tsx](npe-web/components/member/community-hub.tsx) — Support author filter

**Detailed tasks:**
```
[ ] In profile/page.tsx, add queries:
    - const { count: threadsStarted } = await supabase
        .from("forum_threads")
        .select("id", { count: "exact", head: true })
        .eq("author_id", user.id);
    - const { count: repliesCount } = await supabase
        .from("forum_replies")
        .select("id", { count: "exact", head: true })
        .eq("author_id", user.id);

[ ] Render new section "My Community Activity":
    - "Threads started: X" 
    - "Replies posted: Y"
    - Link: "View my posts →" (navigates to /community?author=me)

[ ] In community-hub.tsx, add author filter support:
    - Read URL param: const authorFilter = searchParams?.author;
    - If author === "me": filter threads by current user's author_id
    - Show filter badge: "Showing your posts"
```

---

### 3. Quick Links on Landing Page (1 hour) — Priority: LOW

**What:** Add section below feature cards with external links (AHPRA, Psychology Board, etc.)

**Status:** ❌ NOT STARTED

**Files to create:**
- [npe-web/lib/quick-links.ts](npe-web/lib/quick-links.ts) — Link definitions

**Files to modify:**
- [npe-web/app/page.tsx](npe-web/app/page.tsx) — Add quick links section

**Detailed tasks:**
```
[ ] Create lib/quick-links.ts:
    export const QUICK_LINKS = [
      { 
        label: "AHPRA NPE", 
        url: "https://www.ahpra.gov.au/...",
        icon: "check" // or no icon
      },
      { 
        label: "Psychology Board", 
        url: "https://...",
        icon: "bookmark" 
      },
      // Add 3-4 more useful links
    ];

[ ] In app/page.tsx, after feature cards:
    - Add new section with heading "Useful Resources"
    - Render links as horizontal card row (icon + label + external link icon)
    - On mobile: horizontal scroll or wrap

[ ] Styling:
    - Use existing card component
    - Keep compact
```

---

### 4. Calendar Export (.ics) (2 hours) — Priority: MEDIUM

**What:** Let users download their study schedule as an iCal file that works with Apple Calendar, Outlook, etc.

**Status:** ❌ NOT STARTED

**Files to create:**
- [npe-web/lib/ical.ts](npe-web/lib/ical.ts) — iCal generation

**Files to modify:**
- [npe-web/package.json](npe-web/package.json) — Add ical-generator
- [npe-web/app/(member)/schedule/page.tsx](npe-web/app/(member)/schedule/page.tsx) — Add download button + action
- [npe-web/components/member/schedule-calendar.tsx](npe-web/components/member/schedule-calendar.tsx) — Add download button UI

**Detailed tasks:**
```
[ ] npm install ical-generator

[ ] Create lib/ical.ts:
    import ical from 'ical-generator';
    
    export function generateStudyPlanIcal(
      sessions: Session[],
      studyWeeks: StudyPlanWeek[],
      examWindows: ExamWindow[]
    ): string {
      const cal = ical({ name: 'NPE Study Club' });
      
      // Add study blocks
      studyWeeks.forEach(week => {
        cal.createEvent({
          title: `Study: ${week.domain_focus}`,
          start: new Date(week.week_start),
          description: `Focus domain: ${week.domain_focus}`
        });
      });
      
      // Add sessions
      sessions.forEach(session => {
        cal.createEvent({
          title: session.title,
          start: new Date(session.scheduled_at),
          url: session.video_link
        });
      });
      
      // Add exam windows
      examWindows.forEach(window => {
        cal.createEvent({
          title: window.label,
          start: new Date(window.openDate),
          end: new Date(window.closeDate)
        });
      });
      
      return cal.toString();
    }

[ ] In schedule/actions.ts or schedule/page.tsx:
    - Create server action for download
    - Fetch all needed data (sessions, study weeks, exam windows)
    - Call generateStudyPlanIcal()
    - Stream as file response: 
      Response with headers:
        - Content-Type: text/calendar
        - Content-Disposition: attachment; filename="npe-study-plan.ics"

[ ] Add "Download as .ics" button to schedule page
    - Place near "Today" button or above calendar
    - Trigger download on click
```

---

### 5. DigitalOcean Spaces Integration (3-4 hours) — Priority: LOW

**What:** Replace Supabase file storage (1GB limit) with DigitalOcean Spaces (250GB via student credit)

**Status:** ❌ NOT STARTED

**Files to create:**
- [npe-web/lib/do-spaces.ts](npe-web/lib/do-spaces.ts) — S3-compatible client
- [npe-web/scripts/bulk-upload.mjs](npe-web/scripts/bulk-upload.mjs) — One-time migration

**Files to modify:**
- [npe-web/.env.local](npe-web/.env.local) + .env.example
- [npe-web/package.json](npe-web/package.json) — Add @aws-sdk/client-s3
- [npe-web/components/member/add-resource-form.tsx](npe-web/components/member/add-resource-form.tsx)

**Detailed tasks:**
```
[ ] Set up DigitalOcean Spaces account + get credentials
[ ] Add to .env.local:
    DO_SPACES_KEY=xxx
    DO_SPACES_SECRET=xxx
    DO_SPACES_REGION=nyc3 (or your region)
    DO_SPACES_BUCKET=npe-study-club
    DO_SPACES_URL=https://npe-study-club.nyc3.digitaloceanspaces.com

[ ] npm install @aws-sdk/client-s3

[ ] Create lib/do-spaces.ts with upload function

[ ] Create scripts/bulk-upload.mjs to migrate existing Supabase files

[ ] Update add-resource-form.tsx to upload to Spaces

[ ] This is a one-off task, doesn't affect user-facing features much
```

---

## 🚫 P4 DEFERRED (Complex, lower priority)

### Notifications System (4-5 hours)
Deferred. Scope: in-app notifications + email preferences + real-time bells

### Delete Account Flow (2 hours)
Deferred. Scope: confirmation modal + anonymization logic

---

## 📋 RECOMMENDED SPRINT TODAY

### Sprint Order (Tomorrow's Session)

**Batch 1 — Schedule (3-4 hours, high impact)**
1. Filter bar + legend
2. session_type selector
3. Quiz by domain

**Batch 2 — Personalization (2-3 hours)**
4. Study plan on calendar

**Batch 3 — Polish (1-2 hours)**
5. Video link cleanup

**Optional if time:**
6. Bookmarks (saved resources)
7. Community activity

---

## Implementation Tips

### Before Starting Each Task
- Create a new branch: `git checkout -b feature/task-name`
- Keep tasks atomic (one feature per commit)

### Testing  
```bash
cd npe-web
npm run build  # Check for TS errors
npm run dev    # Start local server at localhost:3000
```

### Rollout
- Each P2/P3 item is independent
- Can merge individually to main
- No blocking dependencies
- Users won't see incomplete features (they're behind login/gates)

### Database Changes
- Only P3 items need new migrations
- Test migrations locally first
- Apply with: `npm run seed` or direct Supabase SQL editor

---

## Files Reference

### Key Architecture Files
- [npe-web/lib/supabase/server.ts](npe-web/lib/supabase/server.ts) — Server client
- [npe-web/lib/access.ts](npe-web/lib/access.ts) — Auth gates
- [npe-web/components/ui/](npe-web/components/ui/) — Base UI components

### Schedule Components
- [npe-web/app/(member)/schedule/page.tsx](npe-web/app/(member)/schedule/page.tsx) — Server page
- [npe-web/app/(member)/schedule/actions.ts](npe-web/app/(member)/schedule/actions.ts) — Server actions
- [npe-web/components/member/schedule-calendar.tsx](npe-web/components/member/schedule-calendar.tsx) — Client component

### Profile Components
- [npe-web/app/(member)/profile/page.tsx](npe-web/app/(member)/profile/page.tsx) — Profile page

### Migrations
- [npe-web/supabase/001_npe_schema.sql](npe-web/supabase/001_npe_schema.sql) — Original schema
- [npe-web/supabase/002_feature_upgrade.sql](npe-web/supabase/002_feature_upgrade.sql) — Study plans, quizzes, etc.
- [npe-web/supabase/003_p1_refactor.sql](npe-web/supabase/003_p1_refactor.sql) — PSY number, video_link rename

---

**Good luck! See you in the next session!**
