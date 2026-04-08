NPE Study Club — Agent Handoff Plan
Prepared for: Downstream implementation agent
Prepared by: UX Designer + Architecture review
Date: April 2026
Status: Ready for implementation

Context
The owner (Connor, provisional psychologist and PhD researcher) has built a working study platform for the National Psychology Exam (NPE) in Google Apps Script. It is feature-complete but hosted as a GAS web app — no custom domain, no real auth, no progress tracking, no community features. The goal is to migrate it into a proper website: NPE Study Club.
A new GitHub repo has been created. Supabase has been initialised (auth + DB). The owner is non-technical and will not be writing code himself. He needs a complete working site from this spec.
Live reference (existing app):
https://script.google.com/macros/s/AKfycbxd9d8YmSf3WCVMMOnQJ_B22KrmU1XkZVKtWp270LE1IofW2IX2147tGGnCku4_vAedig/exec

Guiding Principle
Target user: A provisionally registered psychologist preparing for the NPE — familiar with clinical documents and peer study groups, but not with web software. They arrive expecting something like a well-organised shared Dropbox, not an app. Every interface decision should serve someone who browses, downloads, and studies — not someone who manages data.

UX Audit of Existing GAS App
What works (preserve in the new site)

Clean two-column dashboard layout (sidebar + main content) — keep this structure
NPE countdown widget is immediately useful and grounding — keep it prominent
Resource cards with file type badge (PDF/DOCX), category tag, and short notes are excellent — keep this pattern
Tab-based navigation is intuitive for this audience — keep it
"Recently Added" section on Home is high-value — keep it
Key Reference Documents pinned by source (BOARD / APS) is well-organised — keep it
The search bar on the All tab is well-placed

What fails (fix in the new site)
1. Auth is invisible and manual
Users hit a "Request access" screen with no explanation of who approves them, how long it takes, or what they're joining. New users have no reason to wait. Fix: keep request + approval, but make it explicit and trustworthy: users can request access, and only admin-approved members can enter the platform.
2. No landing/about page
The app loads directly into a dashboard. A new user who has not been approved yet sees a login wall with no context. Fix: add a public-facing landing page (pre-auth) that explains the platform.
3. "Add Resource" form is missing the tags field
The upload form has title, file, category, and notes — but no tags input. Tags appear on cards and are used for filtering. Fix: add multi-select tag input to the upload form.
4. Schedule tab is underexplained
The calendar shows colour-coded events but the legend (Study session / Ad-hoc / NPE exam window) is small and easy to miss. The "Add ad-hoc session" button is prominent but users don't know what it creates or who sees it. Fix: add a brief explainer under the legend; clarify that ad-hoc sessions are shared with all members.
5. Empty states are silent
When a tab has no content (e.g., a filter returns zero results), the page is blank. Fix: every empty state needs a message and a suggested action.
6. No user identity visible
Once logged in, there's no indication of who you are or how to log out. Fix: add a simple user menu in the header (avatar/initials + logout).
7. No progress tracking UI
The existing app has no way to mark resources as read or track what you've completed. The owner wants this in the new site. Fix: add a "Mark as done" toggle on each resource card, reflected in user progress.
8. No shared noticeboard/forum area
There is no central member discussion space for announcements, exam updates, and peer Q&A. Fix: add a dedicated Community page with noticeboard threads and replies visible to approved members.

Tech Stack (non-negotiable, already decided)
LayerToolNotesFrontendNext.js (App Router)Scaffold with npx create-next-app -e with-supabaseBackend / AuthSupabaseAlready initialisedFile storageSupabase StorageBucket: resourcesStylingTailwind CSSComes with the starterDeploymentVercelConnected to GitHub repo; free under GitHub EducationAuth methodSupabase Auth (provider-agnostic)Use email magic link as baseline; Google OAuth optional

Supabase Schema
Run this in the Supabase SQL editor before building any UI.
sql-- Resources (main content library)
CREATE TABLE resources (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  file_type text,                        -- 'pdf', 'docx', 'pptx', 'xlsx', 'image'
  category text NOT NULL,                -- 'exam_prep', 'clinical_practice'
  domain text,                           -- sub-domain within exam_prep (e.g. 'ethics', 'assessment')
  tags text[],                           -- array e.g. ['ACT', 'Child', 'Psychoeducation material']
  notes text,
  file_path text,                        -- path inside Supabase Storage bucket 'resources'
  uploaded_by uuid REFERENCES auth.users(id),
  uploader_name text,                    -- denormalised display name
  created_at timestamptz DEFAULT now()
);

-- Key reference documents (AHPRA/APS pinned docs on home page)
CREATE TABLE key_references (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  source text NOT NULL,                  -- 'BOARD', 'APS'
  description text,
  url text,                              -- external link (not stored files)
  is_new boolean DEFAULT false,
  display_order int
);

-- Study sessions / calendar
CREATE TABLE sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text,
  session_type text NOT NULL,            -- 'study', 'adhoc'
  scheduled_at timestamptz NOT NULL,
  week_number int,
  description text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- User progress tracking
CREATE TABLE user_progress (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  resource_id uuid REFERENCES resources(id),
  completed_at timestamptz DEFAULT now(),
  UNIQUE(user_id, resource_id)
);

-- Comments / community discussion (per resource)
CREATE TABLE comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  resource_id uuid REFERENCES resources(id),
  user_id uuid REFERENCES auth.users(id),
  author_name text,
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Access control: owner-approved membership
CREATE TABLE approved_users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text UNIQUE NOT NULL,
  full_name text,
  ahpra_registration text,
  verification_notes text,
  status text NOT NULL DEFAULT 'approved', -- 'approved', 'revoked'
  created_at timestamptz DEFAULT now()
);

CREATE TABLE access_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name text NOT NULL,
  email text NOT NULL,
  ahpra_registration text,
  relationship_note text,                 -- how owner knows applicant / referral note
  reason text,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'declined'
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Community noticeboard/forum (site-wide)
CREATE TABLE forum_threads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  body text NOT NULL,
  tag text,                               -- 'announcement', 'question', 'resource-request', 'general'
  created_by uuid REFERENCES auth.users(id),
  author_name text,
  is_pinned boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE forum_replies (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id uuid REFERENCES forum_threads(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  author_name text,
  created_at timestamptz DEFAULT now()
);
Row Level Security — enable on every table with these policies:
sql-- Resources: anyone authenticated can read; uploader can update/delete their own
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read resources" ON resources FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert resources" ON resources FOR INSERT WITH CHECK (auth.uid() = uploaded_by);
CREATE POLICY "Users can delete own resources" ON resources FOR DELETE USING (auth.uid() = uploaded_by);

-- Key references: read-only for all authenticated users (admin inserts directly)
ALTER TABLE key_references ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read key_references" ON key_references FOR SELECT USING (auth.role() = 'authenticated');

-- Sessions: authenticated can read; any authenticated user can insert
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read sessions" ON sessions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert sessions" ON sessions FOR INSERT WITH CHECK (auth.uid() = created_by);

-- User progress: users can only see and modify their own
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own progress" ON user_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own progress" ON user_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own progress" ON user_progress FOR DELETE USING (auth.uid() = user_id);

-- Comments: all authenticated can read; insert own; delete own
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read comments" ON comments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert comments" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON comments FOR DELETE USING (auth.uid() = user_id);

-- approved_users: only authenticated users can read their own record
ALTER TABLE approved_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own approved_users row" ON approved_users FOR SELECT USING (lower(email) = lower(auth.jwt()->>'email'));

-- access_requests: anyone can create; only authenticated users read own submissions
ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit access request" ON access_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can read own access requests" ON access_requests FOR SELECT USING (lower(email) = lower(auth.jwt()->>'email'));

-- Forum: approved members can read/insert/delete own
ALTER TABLE forum_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read forum_threads" ON forum_threads FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert forum_threads" ON forum_threads FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can delete own forum_threads" ON forum_threads FOR DELETE USING (auth.uid() = created_by);

ALTER TABLE forum_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read forum_replies" ON forum_replies FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert forum_replies" ON forum_replies FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can delete own forum_replies" ON forum_replies FOR DELETE USING (auth.uid() = created_by);

Supabase Storage
Create one bucket in Supabase Storage dashboard:

Bucket name: resources
Public: No (files served via signed URLs)
Allowed MIME types: application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.openxmlformats-officedocument.presentationml.presentation, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, image/*
Max file size: 50MB


Site Structure & Page Specs
Route map
/                    → Public landing page (pre-auth)
/auth/login          → Login (email magic link; Google optional)
/auth/request        → Request access (for approval)
/dashboard           → Home (post-auth, replaces GAS home tab)
/resources           → All resources (replaces All tab)
/resources/exam-prep → Exam Prep filtered view
/resources/clinical  → Clinical Practice filtered view
/schedule            → Calendar (replaces Schedule tab)
/add                 → Add Resource form (auth-gated)
/community           → Noticeboard / forum (new)
/profile             → User profile + progress summary (new)

Page 1: / — Public landing page
Purpose: Convert visitors into members. This page does not exist in the GAS app and is urgently needed.
Layout:

Full-width hero section with headline, subheadline, and single CTA button
Three-column "what's inside" section (Resources / Schedule / Community)
NPE countdown widget (publicly visible — no login needed to see the deadline)
"Join the study club" CTA at the bottom

Copy:
ElementTextHeadlineNPE Study ClubSubheadlineShared resources, study sessions, and clinical tools for provisional psychologists preparing for the National Psychology Exam.CTA buttonRequest accessFeature 1Resources — Curated PDFs, protocols, and exam prep materials, organised by topic.Feature 2Schedule — Shared study calendar with weekly sessions and the NPE exam window.Feature 3Community — A private noticeboard/forum for trusted member discussion.
Notes:

Show two clear actions: Request access and Member sign in
Access is approved manually by the owner (known contacts or AHPRA-registered provisional psychologists)
The countdown should show days until the NPE exam window opens (hardcode the May 2026 date as a constant; make it easy to update)


Page 2: /dashboard — Home (post-auth)
Replicates: GAS Home tab
Layout: Two-column (left sidebar ~30%, right main content ~70%)
Left sidebar — always visible:

NPE Countdown widget (days / hours / minutes)
Quick links list: All Resources, Exam Prep, Clinical Practice, Schedule, Add Resource, NPE Official Page (psychologyboard.gov.au)

Right main content — three sections stacked:

Upcoming Sessions — show next 3 sessions from sessions table, ordered by scheduled_at. Each row: date, time, session type badge, title. "View calendar →" link.
Key Reference Documents — grouped by source (BOARD then APS). Each row: title, description, source badge (colour-coded: teal for BOARD, purple for APS), NEW badge if is_new = true. Clicking a row opens the URL in a new tab.
Recently Added — last 5 resources from resources table ordered by created_at DESC. Use the same card component as the resource library.


Page 3: /resources — All Resources
Replicates: GAS All tab
Layout: Full-width with filter bar above a responsive card grid (3 columns desktop, 2 tablet, 1 mobile)
Filter bar (sticky at top):

Text search input (searches title, tags, notes)
Category dropdown: All / Exam Prep / Clinical Practice
File type dropdown: All / PDF / DOCX / PPTX / XLSX
Result count displayed on right ("9 resources")

Resource card spec:
Each card displays:

File type badge (top right corner, colour-coded: red = PDF, blue = DOCX, green = XLSX, orange = PPTX)
Category badge (EXAM PREP / CLINICAL PRACTICE / ASSESSMENT / ETHICS)
Title (bold, 1–2 lines)
Source/context line (italic, e.g. "APC8086 Session 7 Attention 2025")
Tags (small pill chips, max 3 visible + overflow count)
Notes (2-line clamp, grey text)
Uploader name (bottom right, small)
Two action buttons: View (opens file in new tab via signed URL) and Download (triggers download)
Mark as done toggle (checkbox or tick icon, bottom left) — updates user_progress table

Empty state: "No resources match your search. Try different filters or [upload one yourself →]."

Page 4: /resources/exam-prep and /resources/clinical
Replicates: GAS Exam Prep and Clinical Practice tabs
Same layout as /resources but:

Category filter is pre-set and locked
Exam Prep adds a Domain dropdown filter (Ethics / Assessment / Legislation / Treatment / Other) mapped to the domain column


Page 5: /schedule — Study Calendar
Replicates: GAS Schedule tab
Layout: Full calendar (month view by default, with week view option)
Calendar spec:

Three event types with distinct colours:

Teal — Study session (recurring weekly)
Purple — Ad-hoc session
Amber — NPE exam window (shaded date range, not a point event)


Legend displayed above calendar, clearly labelled
Clicking an event opens a small popover: title, time, type, optional description
"+ Add ad-hoc session" button — opens a modal form:

Title (text input)
Date + time (datetime picker)
Description (optional textarea)
Submit → inserts into sessions table with session_type = 'adhoc'
Show confirmation: "Session added — all members will see it on the calendar."



Explainer text (beneath legend, small grey text):
"Study sessions are scheduled weekly. Ad-hoc sessions are added by members and visible to everyone."

Page 6: /add — Add Resource
Replicates: GAS Add Resource tab (with fixes applied)
Auth-gated: Redirect to /auth/login if not authenticated
Form fields:
FieldTypeNotesResource TitleText inputRequired. Placeholder: "e.g. ACT for Treating Children"FileFile upload (drag & drop)Required. Accepted: PDF, DOCX, PPTX, XLSX, images. Max 50MB. Show file type after selection.Resource CategorySelectRequired. Options: Exam Prep / Clinical PracticeDomainSelectConditional — only shows if Exam Prep selected. Options: Ethics / Assessment / Legislation / Treatment / OtherTagsMulti-select or tag inputOptional. Existing tags suggested from DB; user can type new ones.NotesTextareaOptional. Placeholder: "e.g. Covers exposure hierarchy for OCD"
On submit:

Upload file to Supabase Storage (resources/ bucket), get path
Insert row into resources table
Show success state: "Resource uploaded — it's now visible to all members." with a "View it →" link
Reset form

Empty/error states:

File too large: "File exceeds 50MB. Please compress or split the file."
Upload failed: "Upload failed. Check your connection and try again."


Page 7: /profile — User Profile (new — not in GAS app)
Purpose: Give users a sense of their own activity and progress.
Layout:

Header: avatar (Google profile photo), display name, email
Progress summary: "X of Y resources completed" with a simple progress bar
List of completed resources (from user_progress JOIN resources) with date completed and link to view


Page 8: /community — Noticeboard / Forum (new)
Purpose: Give approved members a central place for announcements, exam updates, and peer discussion.
Layout:

Top bar: search, tag filter, and "New post" button
Pinned section first (is_pinned = true), then recent threads by updated_at DESC
Thread card: title, tag, author, reply count, last activity time
Thread view: original post + chronological replies

Create thread form:

Title (required)
Tag (Announcement / Question / Resource Request / General)
Body (required)
Submit → inserts into forum_threads

Reply form:

Single textarea beneath thread
Submit → inserts into forum_replies

Moderation for v1:

Author can delete their own thread/reply
Pinned posts can be set directly in Supabase dashboard for now
Empty state copy: "No posts yet. Start the conversation with a first update or question."


Data Migration from GAS App
The following steps migrate existing content from Google to Supabase. The owner performs these steps; the agent does not need to automate this.

Export resources — In the Google Sheet backing the GAS app, export as CSV. Map columns to the resources table schema above.
Download files — Bulk-download the Google Drive folder (UPLOAD_FOLDER_ID in the GAS code). Upload all files to the Supabase resources bucket.
Import CSV — Use Supabase Dashboard → Table Editor → Import CSV to populate the resources table. Update file_path values to match Supabase Storage paths.
Seed key_references — Manually insert the 9 key reference documents visible on the GAS home page into the key_references table via the Supabase dashboard.
Seed sessions — Recreate the recurring weekly study sessions in the sessions table.


Priority-Ordered Implementation Plan
Work in this sequence. Each phase should be independently deployable.
Phase 1 — Foundation (do first, nothing works without this)

Scaffold Next.js app: npx create-next-app -e with-supabase
Connect to Supabase project (env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)
Run the SQL schema above in Supabase SQL editor
Enable Supabase auth providers (email magic link required; Google optional)
Implement approval gate (only users in approved_users can access member routes)
Build access request flow (/auth/request → access_requests)
Create Supabase Storage bucket resources
Deploy to Vercel; confirm auth login/logout works end-to-end

Phase 2 — Resource library (the core feature)

Build the resource card component (reusable)
Build /resources page with filter bar and card grid
Wire card View button (signed URL from Supabase Storage)
Wire card Download button
Wire text search (client-side filter on title, tags, notes)
Build /resources/exam-prep and /resources/clinical as filtered variants

Phase 3 — Upload flow

Build /add page with all form fields
Implement file upload → Supabase Storage
Implement form submission → resources table insert
Add success/error states

Phase 4 — Home dashboard

Build /dashboard layout (two-column)
NPE Countdown widget (countdown to hardcoded exam window date)
Key Reference Documents section (read from key_references table)
Recently Added section (last 5 from resources)
Upcoming Sessions section (next 3 from sessions)

Phase 5 — Community noticeboard/forum

Build /community list and thread views
Implement create thread + reply flow
Add tag filter and search
Add meaningful empty states and confirmations

Phase 6 — Schedule

Install a calendar library (e.g. react-big-calendar or @fullcalendar/react)
Fetch sessions from Supabase and render on calendar
Colour-code by session_type
Build "+ Add ad-hoc session" modal form

Phase 7 — Landing page & auth gates

Build / public landing page
Add auth middleware: redirect unauthenticated users from /dashboard, /resources, /add, /schedule, /community to /auth/login
Add membership middleware: redirect authenticated but non-approved users to /auth/request-status
Build user menu in header (avatar, display name, logout)

Phase 8 — Progress tracking & profile

Add "Mark as done" toggle to resource cards (upsert to user_progress)
Build /profile page
Display progress count and completed resource list

Phase 9 — Resource comments (optional, after forum is stable)

Add comment thread to resource cards (expandable)
Build comment submit form (insert to comments)
Display comments ordered by created_at


Design Tokens (match existing GAS app palette)
TokenValuePrimary dark (nav bg)#1a2332Primary teal (accent)#2d8c7aBackground#f5f0e8 (warm off-white)Card background#ffffffText primary#1a1a1aText secondary#6b7280Badge: BOARDtealBadge: APSpurpleBadge: NEWgreenBadge: EXAM PREPdark tealBadge: CLINICAL PRACTICEblue-greenBadge: ASSESSMENTindigoBadge: ETHICSorangeFont: headingsDM Serif DisplayFont: bodyDM Sans
Both fonts are available via Google Fonts.

Open Questions for Owner Before Starting

Domain name — What URL should the study club live at? (e.g. npestudyclub.com.au)
Exam window date — The countdown shows "Until May 2026 opens". Confirm the exact date to hardcode.
Admin access — Who can add/edit Key Reference Documents? (Currently admin-only via Supabase dashboard is fine for now)
Member approval criteria — Confirm required checks for approval (known person, AHPRA provisional registration, or both).
Existing members — How many users currently have access in the GAS app? They'll need to re-authenticate via the new flow.


Decision log (confirmed)

Access is closed: owner approves all users
Auth provider is flexible: email magic link baseline, Google optional
Noticeboard/forum is core scope (not a deferred add-on)


End of handoff document.
