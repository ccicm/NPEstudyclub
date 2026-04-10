# Next Agent Handoff

Last updated: 2026-04-10

Use [MASTER_PLAN.md](MASTER_PLAN.md) as the source of truth. This file is a quick execution plan for the next session.

## Current state snapshot

- UX audit is in progress.
- Request-status state rendering is complete.
- Major user-facing technical error copy has been simplified on core member/auth/community/admin surfaces.
- Resource list cap is raised to 1000 on resources page.
- Dashboard timeline now uses study-plan exam date when available.
- Profile stale progress section is removed.
- Schedule now prompts users to create a study plan when missing.

## Next agent plan (ordered)

1. Complete remaining UX P2/P3 cleanup pass.
2. Finish production-facing copy consistency pass.
3. Run targeted regression checks on changed routes.
4. Update docs/status after each completed block.

## 1) UX P2/P3 cleanup (implementation)

- Standardize resource file action verb to `Download` or `View` consistently.
- Simplify resource search placeholder to `Search resources…`.
- Add helper text in add-resource form when category changes and reveals different metadata fields.
- Rename PSY label/copy to `AHPRA registration number` on request flow.
- Rename ambiguous community channel label (`Technical`) to a clearer label.
- Clarify admin self-approval helper copy and button label.
- Confirm dashboard/account label tone adjustments if still pending.

## 2) High-priority infra/product follow-up

- Apply the min-vote escalation guard SQL changes in environment(s) before relying on moderation thresholds:
  - `npe-web/supabase/006_explanation_feedback_settings.sql`
  - `npe-web/supabase/007_noticeboard_publish_windows.sql`
- Verify: one downvote cannot escalate; ratio checks run only after minimum vote count.
- Keep resources page at limit 1000 for now; add follow-up task for server-side pagination/filtering.
- Prepare and execute a controlled bulk resource upload run once storage verification is green.
- Capture batch upload outcomes (success/failure counts and retry list) in status docs.
- Decide whether to raise non-resource list caps still at 200 (community/quizzes) or leave intentionally scoped.
- Prepare for migration 014 rollout dependencies (status field + policy changes), but do not apply production SQL from agent unless requested.

## 3) Regression checklist before handoff

- Auth path:
	- Request access submit and validation messaging.
	- Request-status CTA state behavior for signed-out, pending, approved.
- Member path:
	- Dashboard renders with and without study plan.
	- Resources empty states (true-empty vs filter-empty).
	- Schedule no-plan prompt visibility.
- Community path:
	- Thread and report feedback messages remain user-safe.
- Admin path:
	- Access request list still loads and actions still work in configured environments.

## 4) Documentation update requirements

After implementation/testing, update all three:

- [MASTER_PLAN.md](MASTER_PLAN.md)
- [REFACTOR_STATUS.md](REFACTOR_STATUS.md)
- [docs/UX_AUDIT_NPE_STUDY_CLUB.md](docs/UX_AUDIT_NPE_STUDY_CLUB.md)

## Guardrails

- Do not reintroduce developer diagnostics in member-facing UI.
- Keep technical diagnostics internal (logs/admin), not inline for members.
- Avoid unrelated refactors while finishing this UX block.
- Do not run destructive git commands.


## Post coding session review
- Please review the below plan and integrate it as necessary.
- The below was created in a separate offline coding session after the above plan was committed.
- It is based primarily on UX design review but lacks full nuance of the above planning section.
- It should be read as Connor's intentions for the site and tasks above should keep these ideas in mind even if the technical application itself needs to be updated.

# NPE Study Club — Implementation Spec
_Generated: 2026-04-10 · Revised after full requirements session_

This document is structured for direct Copilot/agent handoff. Each section names affected files, describes the gap, and specifies the fix. Items are tiered P1 (build now), P2 (next sprint), P3 (roadmap).

---

## Priority tiers at a glance

**P1 — Build now (bugs + foundation)**
- Quiz review flow redesign (§1a–§1c)
- AI disclosure banners (§1c)
- Community thread context fix (§1d)
- Citations display (§1e)
- Canonical taxonomy (§2a)
- Admin panel fix (§6)
- Supabase migration CI (§7)
- Calendar ICS timezone fix (§3a)
- Resource visibility toggle (§4a)
- Quiz cadence schema + seed (§5a)

**P2 — Next sprint (core features)**
- Study plan ↔ calendar integration + study blocks (§3b–§3d)
- Study hours guidance + confidence onboarding (§3e)
- ICS export controls (§3f)
- Exam window detail (§3g)
- Quiz difficulty ramp by performance (§5b)
- Domain content sequencing (§5c)
- Citations linked to resources + external URLs (§1e)
- Mini-quiz system (§4b)
- Read time estimation (§4c)
- Onboarding achievement system (§8)
- PWA + web push (§9)

**P3 — Roadmap (design-first, build later)**
- GitHub Actions link-checker + AHPRA doc detector (§10)
- In-app calendar block drag/resize editor (§3c)
- End-of-quiz overall AI feedback form (§1b)
- Pinned community thread for new AHPRA docs (§10b)

---

## 1. Quiz — Review Flow, Feedback & Community Board

### 1a. Downvote escalation must be proportional, not immediate [P1]

**Bug:** The first downvote always escalates because there is no minimum-vote guard before the ratio check fires.

**Fix:** Add guard to `escalate_explanation_feedback` in `supabase/006_explanation_feedback_settings.sql` and to `escalate_flagged_question` in `supabase/007_noticeboard_publish_windows.sql`:

```sql
-- Before the ratio check in both functions:
if total_count < coalesce(
  (select value::int from public.quiz_settings where key = 'explanation_min_votes'), 5
) then
  return;
end if;
```

**Migration:** `supabase/migrations/20260410000015_escalation_min_votes.sql`

---

### 1b. Full post-submission review flow redesign [P1/P2]

**Current state:** Explanation votes appear post-submission in an always-open `<details>` list. No structured review flow, no citation display, no wrong-answer rationales, no flag-for-human-review path, no overall quiz rating.

**New flow (post-submission results screen):**

After all questions are submitted, the results screen steps through each question sequentially:

**1. Score summary** (always visible at top): total score, domain breakdown, pass/fail indicator.

**2. Per-question review panel** — sequential reveal. Q2 unlocks only after Q1 is rated:
   - Question stem (repeated in full)
   - Member's answer + correct answer, both highlighted
   - **AI-generated explanation** with clear AI label
   - **Citations** rendered as linked list below explanation (see §1e)
   - **Thumbs up / thumbs down on the explanation — required before advancing to next question**
   - If member thumbs **down**:
     - Reveal all wrong-answer rationales ("Why A is incorrect", "Why B is incorrect", etc.)
     - Show note: *"If you've reviewed the sources and still disagree, you can flag this for human review."*
     - **Flag for review** button → creates a contextual community board thread (see §1d)
     - Optional: checkbox "I checked the source" — logs as research time to study log

**3. Progress indicator:** "2 of 4 rated" shown persistently at the bottom. Done button disabled until all rated.

**4. End-of-quiz AI feedback form [P3 — optional, shown after all questions rated]:**
   - Overall AI generation rating — member can skip
   - Short scales (1–5 or emoji):
     - Difficulty: Too easy ←——→ Too hard
     - Variety: Repetitive ←——→ Well varied
     - Clarity: Confusing ←——→ Clear
     - Relevance: Off-topic ←——→ Highly relevant
   - Optional freetext comment
   - Submit or Skip

**Files:** `components/member/quiz-runner.tsx` (major rewrite of results stage)

**New DB table for overall quiz feedback [P3]:**
```sql
-- supabase/migrations/20260410000020_quiz_overall_feedback.sql
create table public.quiz_overall_feedback (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references public.quizzes(id) on delete cascade,
  user_id uuid references auth.users(id),
  difficulty_score smallint check (difficulty_score between 1 and 5),
  variety_score smallint check (variety_score between 1 and 5),
  clarity_score smallint check (clarity_score between 1 and 5),
  relevance_score smallint check (relevance_score between 1 and 5),
  comment text,
  created_at timestamptz default now(),
  unique(quiz_id, user_id)
);
alter table public.quiz_overall_feedback enable row level security;
create policy "Members can insert own feedback" on public.quiz_overall_feedback
  for insert with check (auth.uid() = user_id);
create policy "Members can read own feedback" on public.quiz_overall_feedback
  for select using (auth.uid() = user_id);
create policy "Admins can read all feedback" on public.quiz_overall_feedback
  for select using (public.is_admin());
```

---

### 1c. AI-generated quiz disclosure — prominent and consistent [P1]

**Requirement:** Every quiz surface must clearly state that questions are AI-generated and that feedback helps tune the model.

**Fix — three surfaces, consistent wording + `Bot` lucide icon:**

- `app/(member)/quizzes/page.tsx` — callout at top of quiz list:
  > "All quizzes are AI-generated. Your ratings after each quiz help improve question quality."

- `components/member/quiz-runner.tsx` — intro stage, below quiz description:
  > "⚡ AI-generated · Your feedback tunes the model"

- `components/member/quiz-runner.tsx` — results stage, above per-question review:
  > "These explanations were written by AI. Rate each one below — your feedback is used to improve future questions."

---

### 1d. Community board thread must include full question context [P1]

**Bug:** Auto-created threads show only a UUID — meaningless to members opening the thread.

**Fix:** Update both escalation functions in `supabase/007_noticeboard_publish_windows.sql` to fetch question text, domain, subdomain, correct answer, and quiz title before inserting the thread:

```sql
declare
  q_text text;
  q_domain_label text;
  q_subdomain text;
  q_quiz_title text;
  q_correct text;

select
  qq.question_text,
  qq.domain_label,
  qq.subdomain,
  qq.correct_answer,
  q.title
into q_text, q_domain_label, q_subdomain, q_correct, q_quiz_title
from public.quiz_questions qq
left join public.quizzes q on q.id = qq.quiz_id
where qq.id = p_question_id;
```

**Thread body — contested question:**
```
**Community review requested — [domain_label]: [subdomain]**

Quiz: [quiz_title]
Domain: [domain_label] · Study area: [subdomain]

Question:
[question_text]

Correct answer (per AI): [correct_answer]

This question was flagged by enough members to trigger a peer review.
Please discuss whether the question, answer, or explanation is accurate. Cite sources where possible.
```

**Thread body — explanation review:**
```
**AI explanation quality review — [domain_label]: [subdomain]**

Quiz: [quiz_title]
Domain: [domain_label] · Study area: [subdomain]

Question:
[question_text]

The AI-generated explanation received enough downvotes to trigger a review.
Please discuss accuracy and suggest corrections with citations.
```

Thread `title`: `'Peer review: [domain_label] — [subdomain]'`
Thread `tag`: canonical domain id (e.g. `'ethics'`) — used for community filtering.

**Migration:** `supabase/migrations/20260410000016_thread_context_body.sql`

---

### 1e. Citations — schema, display, and linking [P1 schema/display · P2 resource linking]

**Requirement:** Citations appear below every AI-generated explanation. Where possible, link to an internal resource in the library or a verified external URL. External URLs are subject to the link-checker GitHub Action (§10).

**Schema:**
```sql
-- supabase/migrations/20260410000019_question_citations.sql
alter table public.quiz_questions
  add column if not exists citations jsonb default '[]'::jsonb;
```

Citation object shape:
```json
[
  {
    "source": "APS Code of Ethics 2007 (amended 2023)",
    "clause": "Section 3.4 — Competence",
    "external_url": "https://www.psychology.org.au/...",
    "resource_id": null
  }
]
```

`resource_id` is a nullable FK to `public.resources.id`. If populated, cite links to the internal resource page. If null, `external_url` is used. If both null, renders as plain text only.

**Display in quiz-runner results (below explanation):**
```tsx
{question.citations?.length > 0 && (
  <div className="mt-2 text-xs text-muted-foreground">
    <p className="font-semibold">Sources:</p>
    {question.citations.map((c, i) => (
      <p key={i}>
        {c.clause ? `${c.source} — ${c.clause}` : c.source}
        {c.resource_id
          ? <Link href={`/resources/${c.resource_id}`}> · View resource →</Link>
          : c.external_url
            ? <a href={c.external_url} target="_blank" rel="noopener"> · External link →</a>
            : null}
      </p>
    ))}
  </div>
)}
```

**Seed JSON update:** Add `citations` array to all question seed files. Generator must only cite sources present in `scripts/source-bank.json`.

---

## 2. Labels, Tags & Canonical Taxonomy [P1]

### 2a. Unified taxonomy across all features

**Problem:** Domain strings are inconsistent across quiz, resource, study plan, and community. `normalizeDomain()` is fragile and will break as new features land.

**Fix — create `lib/npe-taxonomy.ts` as single source of truth:**

```ts
export const NPE_DOMAINS = [
  { id: 'ethics', label: 'Ethics & Professional Practice', domain_number: 1 },
  { id: 'assessment', label: 'Assessment', domain_number: 2 },
  { id: 'interventions', label: 'Interventions', domain_number: 3 },
  { id: 'communication', label: 'Communication & Consultation', domain_number: 4 },
] as const;

export type DomainId = typeof NPE_DOMAINS[number]['id'];

export const NPE_SUBDOMAINS: Record<DomainId, string[]> = {
  ethics: [
    'Duty of care', 'Confidentiality', 'Dual relationships',
    'Mandatory reporting', 'Professional boundaries',
    'Informed consent', 'Record keeping',
  ],
  assessment: [
    'Psychometric selection', 'Cultural considerations', 'Report writing',
    'Risk assessment', 'Cognitive assessment', 'Diagnostic formulation',
  ],
  interventions: [
    'CBT', 'ACT', 'Trauma-informed care', 'Psychoeducation',
    'Relapse prevention', 'Crisis intervention', 'Supervision',
  ],
  communication: [
    'Referral pathways', 'Interdisciplinary collaboration',
    'Consumer communication', 'Advocacy',
  ],
};
```

**Replace all ad-hoc domain strings in:**
- `lib/resource-options.ts`
- `lib/study-plan.ts`
- `components/member/quiz-runner.tsx`
- `app/(member)/quizzes/add/page.tsx`
- `app/(member)/resources/page.tsx`
- `components/member/schedule-calendar.tsx`

**Delete `normalizeDomain()` once all callsites are migrated.**

**Domain + subdomain filter pills:** Add to `/quizzes` page and `/resources` page using the canonical list. Questions are tagged with both `domain_id` and `subdomain` — both are filterable.

**Community thread tagging:** Set `tag` = canonical domain id when auto-creating review threads.

---

## 3. Schedule & Calendar

### 3a. ICS export timezone bug — study blocks render at wrong time [P1]

**Bug:** `lib/calendar-export.ts` sets `start.setHours(19, 0, 0, 0)` intending 7pm, but this is interpreted as local server time, not AEST. Calendar apps display the result as 5am AEST.

**Fix — short term:** Use explicit UTC offset for AEST (UTC+10). 7pm AEST = 09:00 UTC:
```ts
start.setUTCHours(9, 0, 0, 0);   // 7pm AEST
end.setUTCHours(10, 30, 0, 0);   // 8:30pm AEST (1.5hr default)
```

**Fix — proper (P2):** Read `preferred_study_time` from `study_plans` and compute correct UTC offset. See §3b for schema.

---

### 3b. Study plan ↔ calendar integration — architecture [P2]

**Mental model:**
- The **study plan** is the goal layer: domain focus, weekly hours target, exam date, preferred days. Always present, always recalculable.
- The **study blocks** are the schedule layer: specific day, start time, duration, domain. Generated from the plan but editable by the member.
- Future weeks beyond the current one are held as vague anchors (domain + hours only) in `study_plan_weeks`. No specific blocks until the member plans them.

**New table:**
```sql
-- supabase/migrations/20260410000021_study_blocks.sql
create table public.study_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  plan_week_id uuid references public.study_plan_weeks(id) on delete set null,
  domain_id text not null,
  block_date date not null,
  start_time time not null,
  duration_minutes int not null default 90,
  status text not null default 'draft'
    check (status in ('draft', 'confirmed')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.study_blocks enable row level security;
create policy "Members manage own blocks"
  on public.study_blocks for all using (auth.uid() = user_id);
```

**Add to `study_plans`:**
```sql
alter table public.study_plans
  add column if not exists preferred_study_time time default '19:00',
  add column if not exists preferred_session_duration_minutes int default 90,
  add column if not exists confidence_score smallint check (confidence_score between 1 and 5),
  add column if not exists suggested_hours_per_week numeric(4,1);
```

**Week planning flow:**
1. Member opens the current week in the calendar or study plan.
2. System generates **draft blocks** from: `preferred_days` + `preferred_study_time` + `preferred_session_duration_minutes` + the week's `domain_focus`. Draft blocks render as translucent pills on the calendar.
3. Member drags blocks to different days, resizes them (duration), deletes, or adds new ones.
4. Member clicks **"Lock this week"** → all current-week draft blocks become `confirmed`. Confirmed blocks render as solid. Hours auto-logged to `study_log`.
5. **"Replicate this week"** copies the confirmed layout (same days, times, durations) forward as draft blocks for N weeks. Member sets N via a slider (1–12 weeks, default 4).
6. Future week anchors beyond this remain greyed-out domain labels only in the calendar — no specific blocks until planned.

**Calendar rendering:**
- Confirmed blocks: solid pill, colour-coded by domain
- Draft blocks: translucent, dashed border, domain colour
- Future week anchors: greyed label row (not in day grid)
- Conflict nudge: if a member skips a domain for 3+ consecutive confirmed weeks, show a gentle warning — not a hard block

---

### 3c. In-app calendar block editing [P2/P3]

**Requirement:** Drag blocks between days and resize duration directly in the app before locking.

**Implementation:** Use `@hello-pangea/dnd` for drag-to-reorder between day columns. For resize: bottom drag handle on each block pill adjusts `duration_minutes`. On change: debounced server action `updateStudyBlockAction({ id, block_date, start_time, duration_minutes })`.

Full drag/resize UI is P3. Day-change drag (simpler) is P2. Both use the same `updateStudyBlockAction`.

---

### 3d. Study block auto-logging to study plan [P2]

When a week is locked (`"Lock this week"` → confirmed):
- Sum `duration_minutes` across all confirmed blocks for the week
- Insert a `study_log` row: `hours_logged = total_minutes / 60`, `topics_covered` = domain labels for that week
- This replaces the current fully-manual log for planned weeks. Manual override always available.

---

### 3e. Study hours guidance + confidence-informed targets [P2]

**Gap:** The study plan does not tell members how much they need to study. There is no published AHPRA target — the recommendation should be based on confidence + proximity to exam.

**Onboarding addition:** Add confidence question at plan creation:
```
How prepared do you feel for the NPE right now?
1 — Just starting, limited exposure
2 — Some exposure, significant gaps
3 — Moderate confidence, some weak areas
4 — Mostly confident, minor gaps
5 — Very confident, mainly want practice
```

**Suggested weekly hours by confidence:**
| Confidence | Weekly hours | Estimated total |
|---|---|---|
| 1 | 8–10 hrs | ~200 hrs over 20–25 wks |
| 2 | 6–8 hrs | ~150 hrs |
| 3 | 4–6 hrs | ~100 hrs |
| 4 | 3–4 hrs | ~70 hrs |
| 5 | 2–3 hrs | ~45 hrs |

Show "estimated total hours to exam" (weeks remaining × suggested weekly hours). Flag if timeline is tight: *"At your current pace you have ~60 hours to exam — we'd suggest aiming for X."*

**Adaptive updates:** `applyQuizPerformanceAdjustments` already boosts domain priority based on quiz scores. Extend this to also adjust `suggested_hours_per_week` upward if overall performance is consistently below 60%. Surface as a dashboard nudge: *"Based on your recent scores, we've updated your suggested weekly hours."*

**Schema addition** (in `20260410000021_study_blocks.sql` or separate):
```sql
alter table public.study_plans
  add column if not exists confidence_score smallint check (confidence_score between 1 and 5),
  add column if not exists suggested_hours_per_week numeric(4,1);
```

---

### 3f. ICS export controls [P2]

**Requirement:** Member can configure scope and content of the export before downloading.

**Export options panel** (above Download .ics button on `/schedule`):
```
Include:
[ x ] Confirmed study blocks
[   ] Draft study blocks
[ x ] NPE exam windows
[   ] My exam window only

Weeks to export:
( ) This week only
( ) Next 4 weeks   ← default
( ) Weeks 1–[N]   [slider]
( ) All until exam date
```

Pass as query params to `/schedule/export`:
`?weeks=4&include_drafts=false&exam_windows=true&my_exam_only=false`

---

### 3g. Exam window detail [P2]

**Requirement:** Exam window pills should show more than a label — open date, registration deadline, and a brief student action note.

**Update `lib/exam-windows.ts` entries:**
```ts
{
  label: 'Sitting 1 2026',
  start: [2026, 3, 1],
  end: [2026, 3, 31],
  registrationOpen: [2026, 1, 15],
  registrationClose: [2026, 2, 15],   // new
  notes: 'Submit registration via MyAHPRA. Ensure CPD log is current before sitting.',  // new
}
```

Values maintained manually until the AHPRA doc detector (§10) can flag page changes.

**Also fix exam window filter in `schedule-calendar.tsx`:**
```ts
// Currently hardcoded to always show — make it respect filter state:
if (event.kind === "window") return filter === 'all' || filter === 'exam' || filter === 'myexam';
```

Add filter pills: `[Exam windows]` and `[My exam window]` (latter only shown if member has an exam date in their study plan).

---

## 4. Resources

### 4a. Resource visibility toggle — all members / private [P1]

**Requirement:** Every member can toggle visibility on their own uploaded resources. Binary choice: **All members** or **Only me**. No trusted-peers tier. No by-request flow.

**Schema:**
```sql
-- supabase/migrations/20260410000022_resource_visibility.sql
alter table public.resources
  add column if not exists visibility text not null default 'all'
    check (visibility in ('all', 'private'));
```

**RLS update:**
```sql
drop policy if exists "Members can read resources" on public.resources;
create policy "Members can read resources"
  on public.resources for select
  using (
    public.is_approved_member() and (
      visibility = 'all' or uploaded_by = auth.uid()
    )
  );
```

**UI:** Visibility toggle on upload form and resource detail page (uploader only):
```
Visibility:  [All members]  [Only me]
```

Uploader can change visibility at any time on the resource detail page.

---

### 4b. Mini-quiz system [P2]

**Concept:** Members can create a short quiz (2–5 questions) attached to a specific resource. Completing it marks the resource as verified for that member and auto-logs estimated study time. This is user-generated content (UGC), clearly distinguished from AI-generated quizzes.

**Creation rules:**
- Resource uploader can always create a mini-quiz for their resource (any visibility)
- Other members can create mini-quizzes only for `visibility = 'all'` resources
- Published immediately with a **UGC badge** — no approval step
- Subject to thumbs up/down from other members; if downvote ratio > 20%, escalates to community board (same flow as AI explanations)

**Schema:**
```sql
-- supabase/migrations/20260410000023_mini_quizzes.sql
alter table public.quizzes
  add column if not exists resource_id uuid references public.resources(id) on delete set null,
  add column if not exists is_ugc boolean default false,
  add column if not exists ugc_created_by uuid references auth.users(id);
```

Mini-quizzes use existing `quizzes` + `quiz_questions` tables with `quiz_type = 'mini'` and `is_ugc = true`.

**Display:** On resource detail page:
- If mini-quiz exists: "Quick check" section with Start button
- If none exists: "Create a quick check" button (respecting visibility rules above)
- Completing a mini-quiz = resource marked verified for that member + study time logged

---

### 4c. Read time estimation [P2]

**Approach:** Estimated, not tracked. No time-on-page logging.

- **PDFs:** `page_count × 2 minutes` (academic reading pace)
- **External links / other:** word count of description ÷ 200 wpm, or manual override by uploader
- **Mini-quiz completion:** adds 5–10 min engagement on top of read time estimate

**Display:** *"~12 min read · Quick check available"* on resource cards and detail pages.

**Schema:**
```sql
alter table public.resources
  add column if not exists estimated_read_minutes int,
  add column if not exists page_count int;
```

`page_count` populated at upload time from PDF metadata (existing PDF infrastructure).

---

## 5. Quiz Cadence, Difficulty & Seeding

### 5a. Quiz types and release schedule [P1]

**Revised cadence:**

| Type | `quiz_type` | Cadence | Questions | Seed immediately |
|---|---|---|---|---|
| Daily domain mini-quiz | `daily` | Mon–Fri 06:00 AEST | 4 (one per domain) | 4 weeks (20 sets) |
| Weekly focus set | `weekly_focus` | Saturday 06:00 AEST | 10–15, single subdomain | 4 sets (one per domain) |
| Monthly full exam | `monthly_exam` | First Saturday of month, 06:00 AEST | 150 (A–E format) | 1 — publish now |
| Mini-quiz (UGC) | `mini` | On creation | 2–5, resource-specific | N/A |

**Schema:**
```sql
-- supabase/migrations/20260410000018_quiz_cadence.sql
alter table public.quizzes
  add column if not exists quiz_type text
    check (quiz_type in ('daily', 'weekly_focus', 'monthly_exam', 'mini'))
    default 'daily',
  add column if not exists publish_at timestamptz default now();

create index if not exists idx_quizzes_publish_at on public.quizzes(publish_at);
```

**Availability filter:** `/quizzes` page filters to `publish_at <= now()`. Daily sets additionally respect 06:00 AEST weekday window.

**Quiz browser layout:** Section headers — `This month's exam`, `Weekly focus`, `Daily sets`, `Quick checks (community)`.

**Seed files to generate and commit now:**
```
seed/monthly/full-exam-001.json           ← publish_at: now, quiz_type: monthly_exam
seed/weekly/ethics-focus-001.json         ← next Saturday 06:00 AEST
seed/weekly/assessment-focus-001.json     ← Saturday +1
seed/weekly/interventions-focus-001.json  ← Saturday +2
seed/weekly/communication-focus-001.json  ← Saturday +3
seed/daily/week-01-mon.json through fri   ← next 4 weeks
```

---

### 5b. Quiz difficulty ramp — performance-driven, not week-based [P2]

**Applies to:** Weekly focus sets and monthly exams only. Daily mini-quizzes have their own ratings feedback loop and are excluded from this system.

**Question difficulty tagging:**
```sql
alter table public.quiz_questions
  add column if not exists difficulty text
    check (difficulty in ('recall', 'application', 'analysis'))
    default 'application';
```

**Selection logic** when a member starts a weekly focus or monthly exam:
- **No performance data yet (new member):** default to `recall` level. Member can manually select difficulty before starting ("How challenging do you want this? Recall / Application / Analysis").
- **Domain score < 50%:** serve `recall` + `application` mix (70/30)
- **Domain score 50–70%:** serve `application` + `analysis` mix (60/40)
- **Domain score > 70%:** serve `analysis` dominant (70%) with `application` reinforcement (30%)

Performance data sourced from `quiz_results` joined to `quizzes.domain` — same data used by `applyQuizPerformanceAdjustments`.

**Seeding constraint:** Every seed set must span all three difficulty levels. Monthly exam distribution: early months weight recall/application; later months shift toward analysis.

---

### 5c. Domain content sequencing [P2]

Within each domain, the study plan and weekly focus quizzes follow a curriculum progression:

- **Ethics:** Duty of care + confidentiality → mandatory reporting + dual relationships → competing obligations + systemic ethics
- **Assessment:** Selection basics → cultural considerations → advanced formulation + risk
- **Interventions:** Evidence-based modalities (CBT, ACT) → trauma-informed → supervision + systemic
- **Communication:** Consumer communication → interdisciplinary → advocacy + complex referral

The Week 1 agenda generator (§3e) and the weekly focus quiz selector respect this sequence. Sequence is encoded in `NPE_SUBDOMAINS` ordering in `lib/npe-taxonomy.ts`.

---

## 6. Admin Panel — Cannot See After Login [P1]

**Bug:** Admin users cannot access `/admin` after login. Most likely cause: `ADMIN_EMAIL` or `SUPABASE_SERVICE_ROLE_KEY` missing from Vercel environment variables.

**Diagnosis checklist:**
1. Vercel → Settings → Environment Variables: confirm `ADMIN_EMAIL` is set, no trailing spaces, exact case match with Supabase auth email.
2. Confirm `SUPABASE_SERVICE_ROLE_KEY` is present. Without it, `app/admin/page.tsx` renders in "preview mode" and hides the full panel.
3. Check `user.email` in Supabase Auth dashboard matches `ADMIN_EMAIL` exactly.

**Fix — add debug info in `app/admin/page.tsx` (non-production only):**
```tsx
{process.env.NODE_ENV !== 'production' && !session.isAdmin && (
  <p className="text-xs text-muted-foreground border rounded p-2 mt-2">
    Debug: signed in as "{session.userEmail}" · ADMIN_EMAIL env = "{process.env.ADMIN_EMAIL}"
  </p>
)}
```

**Fix — add role-based fallback:** If `approved_users` has a `role` column with value `'admin'`, treat that user as admin regardless of env var. This decouples admin access from deployment config long-term and is the correct production approach.

---

## 7. Supabase Migration CI — Push from Git [P1]

**Requirement:** SQL migrations apply automatically on push to `main`.

**Step 1 — Install Supabase CLI and link:**
```bash
npm install -g supabase
supabase login
supabase link --project-ref <your-project-ref>
```

**Step 2 — Migration directory** (at repo root, not inside `npe-web/`):
```
supabase/migrations/
  20250101000001_npe_schema.sql
  20250101000002_feature_upgrade.sql
  ... (existing files renamed with timestamps)
  20260410000015_escalation_min_votes.sql
  20260410000016_thread_context_body.sql
  20260410000018_quiz_cadence.sql
  20260410000019_question_citations.sql
  20260410000020_quiz_overall_feedback.sql
  20260410000021_study_blocks.sql
  20260410000022_resource_visibility.sql
  20260410000023_mini_quizzes.sql
  20260410000024_achievements.sql
```

Existing `npe-web/supabase/` files kept for reference. Canonical source moves to `supabase/migrations/`.

**Step 3 — GitHub Actions workflow** (`.github/workflows/migrate.yml`):
```yaml
name: Apply Supabase migrations

on:
  push:
    branches: [main]
    paths:
      - 'supabase/migrations/**'

jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - run: supabase db push --linked
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
```

Add `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` to GitHub repo secrets (Settings → Secrets → Actions).

---

## 8. Onboarding Achievement System [P2]

### Peer badge — 5 onboarding milestones

After being approved as a member, users complete onboarding to earn the **Peer badge** and join the NPE peer community.

| # | Trigger action | Badge step label |
|---|---|---|
| 1 | Complete profile (name, AHPRA, confidence score) | Profile complete |
| 2 | Complete first quiz | First attempt |
| 3 | Check off first resource | First resource |
| 4 | Upload a resource OR create a mini-quiz | Contributor |
| 5 | Make first community post or reply | Community member |

When all 5 complete → **Peer badge** unlocked. Shown in dashboard header and profile page.

### Ongoing engagement markers (private, dashboard only — non-competitive)

| Achievement | Trigger |
|---|---|
| 10 week streak | Confirmed study block or quiz completion in 10 consecutive weeks |
| All four domains | At least one quiz completed in each domain in a single calendar week |
| Fact-checker | Flagged a question that was subsequently corrected by a moderator |
| 3 months in | Account ≥ 90 days old with ≥ 5 study log entries |

These are private to the member — shown only on their own dashboard. No leaderboards.

**Schema:**
```sql
-- supabase/migrations/20260410000024_achievements.sql
create table public.achievements (
  id text primary key,
  label text not null,
  description text,
  is_onboarding boolean default false
);

insert into public.achievements values
  ('profile_complete', 'Profile complete', 'Completed your member profile', true),
  ('first_quiz', 'First attempt', 'Completed your first quiz', true),
  ('first_resource', 'First resource', 'Checked off your first resource', true),
  ('contributor', 'Contributor', 'Uploaded a resource or created a quick check', true),
  ('community_member', 'Community member', 'Made your first community post', true),
  ('peer', 'Peer', 'Completed NPE Study Club onboarding', false),
  ('streak_10', '10 week streak', 'Studied consistently for 10 weeks', false),
  ('all_domains', 'All four domains', 'Covered every domain in one week', false),
  ('fact_checker', 'Fact-checker', 'Flagged a question that was corrected', false),
  ('three_months', '3 months in', 'Active member for 3 months', false);

create table public.member_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  achievement_id text references public.achievements(id),
  earned_at timestamptz default now(),
  unique(user_id, achievement_id)
);
alter table public.member_achievements enable row level security;
create policy "Members read own achievements"
  on public.member_achievements for select using (auth.uid() = user_id);
create policy "System can insert achievements"
  on public.member_achievements for insert with check (true);
```

Achievement checks run via a `checkAchievementsAction(userId)` server action called after relevant events (quiz complete, resource uploaded, post created, etc.).

---

## 9. PWA — Web Push & Home Screen Install [P2]

**Decision:** No native app. PWA covers the core use case.

**Implementation:**
- Add `next-pwa` package
- `public/manifest.json` — app name, icons, navy theme colour
- Service worker auto-generated by next-pwa
- Web Push API for push notifications
- Push subscription stored in Supabase

**Push notification triggers:**
- New daily quiz available: Mon–Fri 06:00 AEST
- New weekly focus set: Saturday 06:00 AEST
- Monthly exam released: first Saturday of month 06:00 AEST

**Schema:**
```sql
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz default now(),
  unique(user_id, endpoint)
);
alter table public.push_subscriptions enable row level security;
create policy "Members manage own subscriptions"
  on public.push_subscriptions for all using (auth.uid() = user_id);
```

---

## 10. GitHub Actions — Link Checker & AHPRA Doc Detector [P3]

### 10a. External URL link checker

**Architecture:**
1. **Weekly scheduled run** (Sunday 03:00 UTC) + **manual `workflow_dispatch`** (triggered by uptime ping on alert)
2. Script queries Supabase for all external URLs from:
   - `quiz_questions.citations[].external_url`
   - `resources.url`
   - Hardcoded URLs in `lib/exam-windows.ts` and `lib/quick-links.ts`
3. HTTP HEAD request per URL, 10s timeout
4. On 404 / 410 / timeout: open a GitHub issue labelled `dead-link` with URL, context, and HTTP status

**Workflow:** `.github/workflows/link-check.yml`
```yaml
name: Check external links

on:
  schedule:
    - cron: '0 3 * * 0'
  workflow_dispatch:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: node scripts/check-links.js
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

**Script:** `scripts/check-links.js` — queries Supabase, checks each URL, opens GitHub issues via GitHub API for failures.

---

### 10b. AHPRA / APS document change detector [P3]

**Architecture:**
1. `scripts/watched-sources.json` — list of known AHPRA/APS pages by topic with last-known content hash:
```json
[
  {
    "topic": "NPE exam information",
    "url": "https://www.psychologyboard.gov.au/...",
    "last_content_hash": "abc123"
  }
]
```
2. Weekly action fetches each URL, hashes the main body text
3. If hash changed: open a GitHub issue + log new URL to `external_sources` table in Supabase
4. Create a **pinned community thread** in the general channel:
   > "📋 Update detected: [topic] page on AHPRA/APS may have new content. Can someone review and update the relevant resource? [Link to page]"
5. Thread can be marked solved by any member once a resource is uploaded or citation updated

**`external_sources` table:**
```sql
create table public.external_sources (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  url text not null,
  organisation text,       -- 'AHPRA', 'APS', 'PBA', etc.
  last_checked_at timestamptz,
  last_changed_at timestamptz,
  content_hash text,
  is_active boolean default true,
  created_at timestamptz default now()
);
```

Citations in `quiz_questions.citations` can reference `external_sources.id` for auto-updating when a URL changes.

---

## Migration summary

| File | Content | Priority |
|---|---|---|
| `20260410000015_escalation_min_votes.sql` | Min-vote guard for both escalation functions | P1 |
| `20260410000016_thread_context_body.sql` | Rich thread body with question context, domain, subdomain | P1 |
| `20260410000018_quiz_cadence.sql` | `quiz_type`, `publish_at` on quizzes | P1 |
| `20260410000019_question_citations.sql` | `citations jsonb` on quiz_questions | P1 |
| `20260410000020_quiz_overall_feedback.sql` | End-of-quiz AI feedback table | P3 |
| `20260410000021_study_blocks.sql` | Study blocks table + study_plans time/confidence columns | P2 |
| `20260410000022_resource_visibility.sql` | Visibility toggle + RLS update | P1 |
| `20260410000023_mini_quizzes.sql` | `resource_id`, `is_ugc`, `ugc_created_by` on quizzes | P2 |
| `20260410000024_achievements.sql` | Achievements + member_achievements tables + seed data | P2 |

---

## File change summary

| File | Change | Priority |
|---|---|---|
| `lib/npe-taxonomy.ts` | New — canonical domain/subdomain list | P1 |
| `lib/resource-options.ts` | Replace ad-hoc strings with taxonomy | P1 |
| `lib/study-plan.ts` | Use taxonomy; confidence-based hours; Week 1 agenda; domain sequencing | P1/P2 |
| `lib/calendar-export.ts` | Fix UTC timezone; add export scope options; read preferred_study_time | P1/P2 |
| `lib/exam-windows.ts` | Add `registrationClose` and `notes` fields | P2 |
| `components/member/quiz-runner.tsx` | Sequential review flow; required rating gate; citations display; AI disclosure; flag button | P1/P2 |
| `components/member/schedule-calendar.tsx` | Exam window filter respect; myexam filter; draft/confirmed block rendering | P2 |
| `components/member/study-plan-dashboard.tsx` | Confidence onboarding; hours guidance nudge; break/pause; drag-and-drop; Week 1 agenda | P2 |
| `app/(member)/quizzes/page.tsx` | AI disclosure banner; domain filter pills; grouped by quiz type | P1 |
| `app/(member)/resources/page.tsx` | Visibility toggle; estimated read time; mini-quiz CTA | P1/P2 |
| `app/(member)/study-plan/actions.ts` | `reorderStudyPlanWeeksAction`; `insertBreakWeekAction`; `updateStudyBlockAction`; `lockWeekAction` | P2 |
| `app/(member)/schedule/page.tsx` | Export options panel; pass preferred_study_time to calendar | P2 |
| `app/admin/page.tsx` | Debug info for email mismatch; role-based fallback | P1 |
| `.github/workflows/migrate.yml` | New — Supabase migration CI | P1 |
| `.github/workflows/link-check.yml` | New — weekly external URL checker | P3 |
| `scripts/check-links.js` | New — link checker script | P3 |
| `scripts/watched-sources.json` | New — AHPRA/APS pages to monitor | P3 |
| `supabase/migrations/` | New directory — CLI-managed canonical migrations | P1 |
| `seed/monthly/full-exam-001.json` | New — 150 Q, publish immediately, quiz_type: monthly_exam | P1 |
| `seed/weekly/ethics-focus-001.json` | New — next Saturday 06:00 AEST | P1 |
| `seed/weekly/assessment-focus-001.json` | New | P1 |
| `seed/weekly/interventions-focus-001.json` | New | P1 |
| `seed/weekly/communication-focus-001.json` | New | P1 |
| `seed/daily/` | New — Mon–Fri next 4 weeks | P1 |

---

## Decisions deferred / explicitly out of scope

| Feature | Decision |
|---|---|
| DMs between members | Not building. Noticeboard covers async needs. |
| Trusted peers access tier | Not building. Visibility is binary (all members / private). |
| By-request resource access | Not building. Too complex for current scale. |
| True time-on-page tracking | Not building. Estimated read time + mini-quiz used instead. |
| Native app | Not building. PWA covers the use case (§9). |