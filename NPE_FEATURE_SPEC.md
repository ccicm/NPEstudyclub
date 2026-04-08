# NPE Study Club — Full Feature & UX Specification
**For:** Downstream implementation agent (Next.js / Supabase / Tailwind)
**Date:** April 2026
**Status:** Ready for implementation

---

## Guiding Principle

The target user is a time-poor provisional psychologist who is anxious about the NPE, wants community
support, and needs structure. Every screen should reduce cognitive load, make progress feel visible,
and make finding the right thing (resource, quiz, session) one click away. The app must feel more
like a study companion than a file repository.

---

## 1. Information Architecture

### Current nav
`Dashboard` · `Resources` · `Add` · `Schedule` · `Community` · `Profile`

### Proposed nav
`Dashboard` · `Resources` · `Quizzes` · `Study Plan` · `Schedule` · `Community` · `Profile`

**Changes:**
- `/add` is no longer a top-level nav item — it becomes a button within `/resources`
- `Quizzes` is a new top-level section
- `Study Plan` is a new top-level section
- `Community` replaces the current forum and becomes a full channel-based hub

---

## 2. Existing Features — Fixes & Upgrades

### 2.1 Resources Page (`/resources`)

**What's wrong now:** No search, no filtering, no category separation, flat list of cards with no
way to narrow down. Add resource is a top-level nav item creating confusion.

**Target experience:** Member arrives and immediately sees resources grouped by category, can search
by keyword, and can filter by domain/modality/population depending on which category tab they're on.
Clicking a tag on a card applies that filter instantly.

#### Layout
```
[Search bar — full width]
[Category tabs: All | Exam Prep | Clinical Practice]
[Filter row — shown conditionally based on active tab]
[Resource count: "24 resources"] [Grid of cards]
```

#### Category tabs
- **All** — no extra filters shown
- **Exam Prep** — shows Domain dropdown filter
- **Clinical Practice** — shows Modality + Population dropdown filters
- All tabs show: Content Type dropdown + search bar

#### Filter dropdowns (match original app values)
- **Domain (Exam Prep only):**
  Assessment · Intervention · Formulation · Ethics & law · Psychopathology ·
  Lifespan development · Research & stats · Professional practice · Other
- **Modality (Clinical only):**
  CBT · ACT · DBT · Schema therapy · Motivational interviewing ·
  Psychodynamic · Integrative / eclectic · Other
- **Population (Clinical only):**
  Adults · Children · Adolescents · Older adults · Couples/families ·
  Mixed / not specified
- **Content Type (all tabs):**
  Case study · Worksheet / tool · Summary / notes · Guideline / framework ·
  Research article · Textbook chapter · Practice exam · Other

#### Resource card design
Each card shows:
- File type badge (colour-coded: PDF=red, DOCX=blue, PPTX=orange, XLSX=green, other=slate)
- Domain pill (teal for Exam Prep, navy for Clinical Practice)
- Title (large)
- Subtopic / domain (small, muted)
- Tags (clickable — clicking applies that filter to current view)
- Notes (if present, truncated to 2 lines)
- Footer: `Open file` button (signed URL) + `Uploaded by [name prefix]`

#### Search behaviour
- Client-side filter against: title, notes, domain, tags, file type, category, uploader name
- Debounced 200ms
- Resource count updates as filters apply
- Empty state: "No resources match — try clearing a filter." with a Clear filters button

#### `+ Add Resource` placement
- Prominent button in the top-right of the resources page header
- NOT in the main nav

---

### 2.2 Add Resource Form (`/add`)

**What's wrong now:** Flat form — same fields regardless of category. Missing domain, modality,
population, source fields. The original app had smart conditional field reveal.

#### Form structure
```
Title *
Category * [Exam Prep | Clinical Practice]  ← selecting this reveals section below

── IF Exam Prep ──────────────────────────────────
Domain / Subtopic    [dropdown + "Other" free text]
Content Type         [dropdown + "Other" free text]
Source               [text input: e.g. APS, textbook, own notes]

── IF Clinical Practice ─────────────────────────
Modality             [dropdown + "Other" free text]
Population           [dropdown + "Other" free text]
Content Type         [dropdown + "Other" free text]
Source               [text input]

── Always shown ─────────────────────────────────
Notes / description  [textarea, optional]
File upload *        [drag-and-drop zone + browse]
```

#### Conditional reveal
- On category change, animate in the relevant section and hide the other
- "Other" on any dropdown reveals a free-text input inline beneath it
- File drag-and-drop shows filename + size on selection
- Upload button disabled until title, category, and file are filled

#### On success
- Toast: "Resource uploaded — it will appear in the library shortly."
- Form resets
- Option to "Upload another" or "View in Resources"

---

### 2.3 Dashboard (`/dashboard`)

**What's wrong now:** Missing NPE exam countdown (most motivating element), missing key references
section, sessions list is very plain.

#### Layout
```
[NPE Countdown widget — full width top banner]
[Two-column below:]
  Left col:   Upcoming Sessions (next 4)
  Right col:  Recently Added Resources (last 5)
[Key References section — full width bottom]
```

#### NPE Exam Countdown widget
- Shows days / hours / minutes until next NPE window opens
- If exam window is currently open: "NPE window is open now!" with days until close
- If no upcoming windows: "No upcoming exam windows scheduled"
- Data: hardcode `exam_windows` array in a config file (same structure as original app):

```ts
// lib/exam-windows.ts
export const EXAM_WINDOWS = [
  { label: "Cohort 19", start: [2025, 10, 1], end: [2025, 10, 31], reg: "Registration closes Sep 2025" },
  // ... add current/upcoming windows
];
```

- Countdown renders client-side (useEffect + setInterval every 60s)
- Teal background with white text, pill badge for window name

#### Upcoming Sessions (left col)
- Shows next 4 sessions from DB
- Each row: date block (day number + month abbreviation) | session title | time | Join button (if meet link)
- "No upcoming sessions" empty state with link to Schedule

#### Recently Added Resources (right col)
- Last 5 resources added
- Each row: file type coloured badge | title | category
- Click navigates to `/resources`

#### Key References section
- Populated from `key_references` Supabase table
- Each card: title, source/author, description, external link button
- `is_new` flag shows a "New" badge
- Admin seeds this table; members read-only

---

### 2.4 Schedule Page (`/schedule`)

**What's wrong now:** Plain chronological list. No calendar, no NPE window visibility, no way to
add ad-hoc sessions.

#### Layout
```
[Month navigation: ← [Month Year] →  [Today button]]
[Weekday headers: Mon Tue Wed Thu Fri Sat Sun]
[Calendar grid — 5-6 rows of day cells]
[Event detail panel — slides in below calendar on day click]
[Add ad-hoc session form — collapsible, below detail panel]
[Upcoming sessions list — below calendar, for accessibility]
```

#### Calendar cell design
- Day number top-left
- Today highlighted with teal ring
- Other-month days: muted opacity
- Events shown as small pills inside cell:
  - Study session: navy pill
  - Ad-hoc session: teal pill
  - NPE exam window day: amber/gold pill (spans all days in window)
- Cells with events: subtle background tint

#### Day detail panel
Clicking a cell with events opens a detail card below the calendar:
- Date heading (e.g. "Tuesday 15 April 2026")
- For each event:
  - Session: topic, time (12h format), session number, notes, Join Google Meet button
  - NPE window: "NPE [Label] window open" + registration note + link to APS/AHPRA exam page

#### Add ad-hoc session form
- Collapsible section: "+ Add session" toggle
- Fields: Your name, Date (date picker), Time (default 19:00), Topic (dropdown + Other),
  Notes (optional), Google Meet link (optional)
- On submit: session added with `session_type = 'Ad-hoc'`, calendar re-renders
- Validation: name and date required

---

## 3. Forum Upgrade (`/community`)

**What's wrong now:** Threads are a flat list with no channels. No upvoting. Replies are not
nested. No way to navigate by topic area. For AHPRA/exam questions this is especially limiting
since those topics need dedicated spaces.

**Target experience:** Feels like a proper community — members browse channels, upvote useful
threads, reply in context, and can find AHPRA navigation help in a dedicated channel without
it drowning in general chatter.

### 3.1 Channels

Replace single thread list with a channel sidebar (or top-tabs on mobile):

| Channel | Purpose |
|---|---|
| 📢 Announcements | Admin-only posting; everyone can comment. Pinned at top. |
| 🧠 Exam Prep | NPE domains, practice strategy, content questions |
| 🏥 Clinical Practice | Case discussions, intervention questions, supervision |
| 📋 AHPRA & Registration | Navigating registration, endorsement pathways, documents |
| 📚 Resource Requests | Ask the group for specific materials |
| 💬 General | Off-topic, introductions, check-ins |

- Default channel on load: `Announcements`
- Active channel highlighted in sidebar
- Unread indicator (dot) on channels with new posts since last visit — use `last_seen_at` stored
  client-side in localStorage or a `channel_reads` Supabase table

### 3.2 Thread list view (within a channel)
```
[Channel name + description]
[+ New Post button — top right]
[Pinned threads — if any, shown first with pin icon]
[Thread list — sorted by last reply date desc]
```

Each thread row:
- Tag badge (Announcement / Question / Resource request / General)
- Title
- Author + relative time ("2 days ago")
- Reply count + upvote count
- Preview of first line of body

### 3.3 Thread detail view

Clicking a thread opens a detail view (either page route `/community/[threadId]` or slide-in panel):

```
[Back to channel]
[Thread title + tag]
[Author + date]
[Body — markdown rendered]
[Upvote button + count]
[─── Replies ───]
[Top-level replies, each with:]
  - Author, time
  - Body
  - Upvote button
  - Reply button (opens nested reply input inline)
  - Nested replies (indented, max 2 levels)
[Reply input at bottom]
```

### 3.4 Upvoting

- `forum_upvotes` table: `(user_id, thread_id, reply_id)` — one of thread_id or reply_id is set
- Upvote button toggles (upvote/un-upvote)
- Count shown inline
- No downvoting

### 3.5 Nested replies

- `forum_replies` gets a `parent_reply_id uuid references forum_replies(id)` column
- Max nesting depth: 2 levels (reply to a reply, but not reply to a reply to a reply)
- Visually: indent 1rem + left border accent per level

### 3.6 New post form

Modal or inline form:
```
Channel [pre-filled from current channel, changeable]
Tag     [Announcement (admin only) | Question | Resource request | General]
Title   [text input]
Body    [textarea, basic markdown supported]
```

### 3.7 Schema additions needed

```sql
-- Add channel to threads
alter table public.forum_threads add column channel text not null default 'general';

-- Add nested reply support
alter table public.forum_replies add column parent_reply_id uuid references public.forum_replies(id);

-- Upvotes
create table public.forum_upvotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  thread_id uuid references public.forum_threads(id),
  reply_id uuid references public.forum_replies(id),
  created_at timestamptz default now(),
  constraint chk_one_target check (
    (thread_id is not null and reply_id is null) or
    (thread_id is null and reply_id is not null)
  ),
  unique(user_id, thread_id),
  unique(user_id, reply_id)
);
```

---

## 4. Quizzes (`/quizzes`)

### 4.1 Purpose

Short practice question sets mapped to NPE domains. Member-uploaded to start, with admin curation.
Integrates with the Study Plan to serve relevant quizzes based on what a member is focusing on.

### 4.2 Information architecture

```
/quizzes            — Browse quiz sets
/quizzes/[id]       — Take a quiz
/quizzes/add        — Upload quiz questions (members)
/quizzes/results    — Your quiz history
```

### 4.3 Browse view (`/quizzes`)

```
[Filter tabs: All | Exam Prep | Clinical Practice]
[Domain filter dropdown (same values as resources)]
[Grid of quiz set cards]
```

Each quiz set card:
- Title
- Domain badge
- Number of questions
- Avg score (if you've attempted it)
- Created by (name prefix) + "Admin curated" badge if `is_curated = true`
- `Start quiz` button

### 4.4 Quiz taking view (`/quizzes/[id]`)

**Flow:**
1. Quiz intro screen: title, domain, question count, estimated time (1 min/question), Start button
2. Question screen (one question at a time):
   ```
   [Progress: Q3 of 12]
   [Question text]
   [Option A]  [Option B]
   [Option C]  [Option D]
   [Next — disabled until option selected]
   ```
3. Answer reveal (after selecting):
   - Selected option highlighted green (correct) or red (wrong)
   - Correct answer shown if wrong
   - Explanation text (if provided)
   - `Next question` button
4. Results screen:
   - Score: X / Y (large)
   - Percentage + pass/fail indicator (pass = 70%)
   - Domain this quiz covers
   - Per-question breakdown (expandable)
   - `Retake` | `Browse more quizzes` | `View related resources` (links to `/resources` filtered
     to same domain)
   - Result saved to `quiz_results` table

### 4.5 Add quiz form (`/quizzes/add`)

Two-step form:

**Step 1 — Quiz details:**
```
Title *
Category *     [Exam Prep | Clinical Practice]
Domain *       [dropdown]
Description    [textarea, optional]
```

**Step 2 — Add questions (repeating):**
```
Question text *
Option A *   Option B *
Option C     Option D
Correct answer *  [A / B / C / D selector]
Explanation   [textarea — shown to user after answering]
[+ Add another question]
[Submit quiz for review]
```

- Minimum 4 questions to submit
- Submitted quizzes have `is_curated = false` and are visible to all members immediately
- Admin can mark `is_curated = true` via Supabase dashboard (no admin UI needed for v1)

### 4.6 Quiz history (`/quizzes/results`)

Table showing:
- Quiz title, domain, date taken, score (X/Y + %)
- Link to retake
- Aggregate: total quizzes taken, average score across domains, strongest/weakest domain

### 4.7 Schema

```sql
create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,  -- 'Exam Prep' | 'Clinical Practice'
  domain text,
  description text,
  created_by uuid references auth.users(id),
  author_name text,
  is_curated boolean default false,
  created_at timestamptz default now()
);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references public.quizzes(id) on delete cascade,
  question_text text not null,
  options jsonb not null,  -- [{ "label": "A", "text": "..." }, ...]
  correct_index int not null,  -- 0-based index into options array
  explanation text,
  display_order int,
  created_at timestamptz default now()
);

create table public.quiz_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  quiz_id uuid references public.quizzes(id),
  score int not null,
  total_questions int not null,
  answers jsonb,  -- [{ "question_id": "...", "selected": 1, "correct": 0 }, ...]
  completed_at timestamptz default now()
);

-- RLS
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_results enable row level security;

create policy "Authenticated users can read quizzes" on public.quizzes
  for select using (auth.role() = 'authenticated');

create policy "Users can insert quizzes" on public.quizzes
  for insert with check (auth.uid() = created_by);

create policy "Authenticated users can read quiz_questions" on public.quiz_questions
  for select using (auth.role() = 'authenticated');

create policy "Users can insert quiz_questions" on public.quiz_questions
  for insert with check (
    auth.uid() = (select created_by from public.quizzes where id = quiz_id)
  );

create policy "Users can read own quiz_results" on public.quiz_results
  for select using (auth.uid() = user_id);

create policy "Users can insert own quiz_results" on public.quiz_results
  for insert with check (auth.uid() = user_id);
```

---

## 5. Study Plan (`/study-plan`)

### 5.1 Purpose

An interactive personal study planner. The member enters their exam date, weekly study hours, and
priority domains. The app generates a structured week-by-week plan, serves relevant quizzes and
resources for each focus area, and tracks progress against the plan.

### 5.2 Onboarding flow (first visit, no plan exists)

Full-page onboarding wizard, 3 steps:

**Step 1 — Exam date**
```
When is your NPE exam? (or expected window)
[Date picker — shows upcoming exam windows as quick-select chips]
```

**Step 2 — Study capacity**
```
How many hours per week can you study?
[Slider: 1 – 20 hrs/week, default 5]

Which days work best?
[Day-of-week multi-select checkboxes]
```

**Step 3 — Domain priorities**
```
Which NPE domains do you want to focus on?
Rate each from 1 (confident) to 3 (need work):

Assessment            [1] [2] [3]
Intervention          [1] [2] [3]
Formulation           [1] [2] [3]
Ethics & law          [1] [2] [3]
Psychopathology       [1] [2] [3]
Lifespan development  [1] [2] [3]
Research & stats      [1] [2] [3]
Professional practice [1] [2] [3]
```

On completing onboarding → save to `study_plans` table → redirect to plan dashboard.

### 5.3 Plan dashboard (`/study-plan`)

Once a plan exists:

```
[Top banner: X weeks until exam · Y hrs planned this week · Z% plan complete]

[This week's focus — card]
  Domain: Intervention
  Suggested resources: [2 resource cards linked to this domain]
  Suggested quiz:      [1 quiz card for this domain]
  Hours logged this week: [progress bar against weekly target]

[Plan timeline — accordion or scrollable week-by-week]
  Week 1: [domain] [status: done/in-progress/upcoming]
  Week 2: ...

[Domain progress — mini grid]
  Each domain: label + progress bar (% of plan time allocated + completed)
```

### 5.4 Plan generation logic (server-side)

When the plan is first created:
1. Calculate total weeks from today to exam date
2. Assign domains to weeks in priority order (domains rated 3 get more weeks than those rated 1)
3. Each week gets: a domain focus, a resource suggestion (from `resources` filtered to that domain),
   a quiz suggestion (from `quizzes` filtered to that domain)
4. Store generated weeks in `study_plan_weeks` table

Resource and quiz suggestions are drawn from existing content at plan creation time. If no matching
content exists for a domain, show: "No resources yet for this domain —
[Upload one →](/add) or [Request in Community →](/community)"

### 5.5 Logging study time

Each week card has a `Log time` button:
```
This session: [input: hours, default 1] [Save]
```
Saves to `study_log` table. Progress bar on the weekly focus card updates.

### 5.6 Weekly tip & nudge (passive, no emails in v1)

On the plan dashboard, a "This week's tip" card:
- Rotates through a small array of hardcoded study tips (one per domain)
- Selected based on the current week's domain focus
- No external scheduling needed — purely derived from current week's plan entry

### 5.7 Edit plan

A settings button on the plan dashboard opens a slide-over panel to:
- Change exam date
- Adjust weekly hours
- Re-rate domains (regenerates remaining weeks)

### 5.8 Schema

```sql
create table public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) unique,
  exam_date date not null,
  hours_per_week int not null default 5,
  preferred_days text[],  -- ['Monday','Wednesday','Saturday']
  domain_priorities jsonb not null,
  -- { "Assessment": 2, "Intervention": 3, "Ethics & law": 1, ... }
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.study_plan_weeks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references public.study_plans(id) on delete cascade,
  week_number int not null,
  week_start date not null,
  domain_focus text not null,
  suggested_resource_id uuid references public.resources(id),
  suggested_quiz_id uuid references public.quizzes(id),
  status text not null default 'upcoming'
    check (status in ('upcoming', 'in_progress', 'complete')),
  created_at timestamptz default now()
);

create table public.study_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  plan_week_id uuid references public.study_plan_weeks(id),
  hours_logged numeric(4,1) not null,
  logged_at timestamptz default now()
);

-- RLS (all user-scoped)
alter table public.study_plans enable row level security;
alter table public.study_plan_weeks enable row level security;
alter table public.study_log enable row level security;

create policy "Users manage own study_plan" on public.study_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own study_plan_weeks" on public.study_plan_weeks
  for all using (
    auth.uid() = (select user_id from public.study_plans where id = plan_id)
  );

create policy "Users manage own study_log" on public.study_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

---

## 6. Profile Page Upgrade (`/profile`)

**What's wrong now:** Shows completion count but no way to mark resources complete, no quiz stats,
no link to study plan.

### Target layout

```
[User email + member since date]

[Study Plan summary card]  — links to /study-plan
  Exam date: X · Plan: Y% complete

[Resource progress]
  X of Y resources completed
  [Progress bar]
  Recent completions: last 3 resource titles

[Quiz performance]
  X quizzes taken · Average score: Y%
  Best domain: Z · Needs work: W

[Completed resources list — expandable]
```

### Mark as complete

On resource cards (on `/resources`), add a small checkbox or tick icon:
- If `user_progress` row exists for this resource+user: ticked (green)
- Clicking unticked: inserts row to `user_progress`
- Clicking ticked: deletes row (toggle)
- Optimistic UI update

---

## 7. Implementation Priority Order

This is the recommended build sequence — each tier is a shippable increment.

### Tier 1 — Core fixes (do first, highest user value)
1. Resources page: search + filter + category tabs + clickable tag filtering
2. Add resource form: conditional fields (Exam Prep vs Clinical Practice)
3. Dashboard: NPE exam countdown widget + key references section
4. Schedule: interactive calendar + NPE window highlighting + day detail panel + add session form
5. Profile: mark-as-complete toggle on resource cards

### Tier 2 — Forum upgrade
6. Add `channel` to `forum_threads` + channel sidebar/tabs
7. Add `parent_reply_id` to `forum_replies` + nested reply rendering (max 2 levels)
8. Upvoting on threads and replies (`forum_upvotes` table)
9. Thread detail as dedicated route `/community/[threadId]`
10. Unread indicator per channel

### Tier 3 — Quizzes
11. Quiz schema migration + RLS
12. Browse quizzes page with filter/search
13. Quiz taking flow (one question at a time, reveal, results)
14. Add quiz form (2-step: details + questions)
15. Quiz history page + domain performance summary

### Tier 4 — Study Plan (most complex, build last)
16. Onboarding wizard (3 steps: exam date, hours, domain priorities)
17. Plan generation logic (server action: allocate domains to weeks, attach suggestions)
18. Plan dashboard (this week's focus, timeline accordion, domain progress grid)
19. Study time logging
20. Edit plan (change exam date / hours / re-rate domains)
21. Cross-link: Study Plan → Quizzes (serve suggested quiz for current week's domain)
22. Cross-link: Study Plan → Resources (serve suggested resource for current week's domain)

---

## 8. Cross-feature Integration Points

| From | To | How |
|---|---|---|
| Study Plan week | Quiz | `suggested_quiz_id` FK + "Take quiz" button on week card |
| Study Plan week | Resource | `suggested_resource_id` FK + resource card on week card |
| Quiz results | Resources | "View related resources" button filtered by quiz domain |
| Resource card | Community | "Discuss in community" link opens `/community` filtered to relevant channel |
| Dashboard countdown | Schedule | Clicking countdown navigates to `/schedule` with NPE window highlighted |
| Profile | Study Plan | "View your plan" card links to `/study-plan` |

---

## 9. Design Tokens (preserve from existing)

All new screens should use the existing token set. No new colours introduced.

```css
--navy:   #0f2340   /* headings, nav active */
--teal:   #0d7377   /* primary actions, active states */
--teal2:  #14a085   /* hover on teal */
--cream:  #f7f4ef   /* card backgrounds, filter panels */
--warm:   #efe9e0   /* subtle section backgrounds */
--text:   #1a1a2e   /* body copy */
--muted:  #64748b   /* secondary text, metadata */
--border: #ddd6c8   /* card and input borders */
```

Typography: `DM Serif Display` for headings, `DM Sans` for body (already loaded via Google Fonts).

Border radius convention: `24px` for major cards, `12px` for inner panels, `8px` for inputs,
`999px` for pills and badges.

---

## 10. Notes for the Implementation Agent

- All data fetching uses Supabase server client (`createClient()` from `@/lib/supabase/server`)
- Client-side interactivity (countdown, calendar, quiz flow) uses React client components
  with `'use client'` directive
- Form submissions use Next.js Server Actions (`'use server'`)
- File uploads go to the existing `resources` Supabase Storage bucket
- No email sending needed for v1 (all nudges are in-app)
- The `exam_windows` config should live in `lib/exam-windows.ts` as a static array —
  do not store in DB for v1 (admin updates by editing the file and redeploying)
- Shadcn/ui components are already installed (`components.json` present) — use them
- Tailwind config and global CSS are already set up — no new config needed
- For the quiz question `options` field, use a JSONB array:
  `[{ "label": "A", "text": "The answer option text" }, ...]`
- Study plan week allocation algorithm: sort domains by priority descending, then round-robin
  assign to weeks. Domains rated 3 get 2× the weeks of domains rated 1.
