# P2 Feature Implementation Guide — Step-by-Step Code Examples

Use this guide when implementing P2 features tomorrow. Each section has copy-paste code snippets ready to go.

---

## 1. Schedule Filter Bar + Legend

### File: `npe-web/components/member/schedule-calendar.tsx`

**Location to modify:** Around line 73, in the `ScheduleCalendar` function

**Step 1: Add filter state**

Find this line:
```tsx
const [viewDate, setViewDate] = useState(() => new Date());
```

Add below it:
```tsx
const [filter, setFilter] = useState<'all' | 'group' | 'adhoc' | 'mine'>('all');
```

---

**Step 2: Add filter logic to allEvents**

Find the `useMemo` that creates `allEvents` (around line 92). At the end before the return, add filtering:

After line 120 (after `return eventsByDay;`), modify to filter:

```tsx
// Filter events based on selected filter
const filteredEvents = useMemo(() => {
  const result = new Map<string, DayEvent[]>();
  
  for (const [date, events] of allEvents.entries()) {
    const filtered = events.filter(event => {
      if (filter === 'all') return true;
      if (filter === 'group' && event.kind === 'session' && event.sessionType !== 'Ad-hoc') return true;
      if (filter === 'adhoc' && event.kind === 'session' && event.sessionType === 'Ad-hoc') return true;
      if (filter === 'mine' && event.kind === 'session' && event.sessionType === 'Personal') return true;
      if (event.kind === 'window') return true; // Always show exam windows
      return false;
    });
    if (filtered.length > 0) result.set(date, filtered);
  }
  
  return result;
}, [allEvents, filter]);
```

Change all references to `allEvents` in rendering to use `filteredEvents` instead.

---

**Step 3: Add filter buttons UI**

Find this section (around line 130):
```tsx
<div className="flex flex-wrap items-center justify-between gap-3">
  <h1 className="text-3xl">Schedule</h1>
  <div className="flex items-center gap-2">
```

Add a new line after `</h1>` and before the month navigation:

```tsx
      <div className="flex gap-2 flex-wrap">
        {(['all', 'group', 'adhoc', 'mine'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
              filter === f
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {f === 'all' ? 'All' : f === 'group' ? 'Group' : f === 'adhoc' ? 'Ad-hoc' : 'My sessions'}
          </button>
        ))}
      </div>
```

---

**Step 4: Add legend row**

After the month navigation div (around line 150), add:

```tsx
      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-slate-800"></div>
          <span className="text-muted-foreground">Group session</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-primary/15 text-primary"></div>
          <span className="text-muted-foreground">Ad-hoc</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-violet-100"></div>
          <span className="text-muted-foreground">My study plan</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-amber-100"></div>
          <span className="text-muted-foreground">NPE exam window</span>
        </div>
      </div>
```

---

## 2. Add session_type Selector to Form

### Files to Modify

#### A. `npe-web/app/(member)/schedule/actions.ts`

Find this section (around line 8-10):
```ts
const hostName = String(formData.get("host_name") || "").trim();
const date = String(formData.get("date") || "").trim();
const time = String(formData.get("time") || "19:00").trim();
```

Add below:
```ts
const sessionType = String(formData.get("session_type") || "Ad-hoc").trim();
```

Then find line 41:
```ts
  await supabase.from("sessions").insert({
    title,
    session_type: "Ad-hoc",
```

Change `session_type: "Ad-hoc",` to:
```ts
    session_type: sessionType,
```

#### B. `npe-web/components/member/schedule-calendar.tsx`

Find the form section (look for `<form>` around line 250). Find the part where the form fields are, around:
```tsx
    <label>
      <span className="text-sm font-semibold">Topic</span>
      <select name="topic" value={topic} onChange={(e) => setTopic(e.target.value)}
```

Add this new field right after the topic select:

```tsx
    <label>
      <span className="text-sm font-semibold">Session type</span>
      <select name="session_type" defaultValue="Ad-hoc" className="w-full rounded-md border bg-background px-3 py-2 text-sm">
        <option value="Group">Group session</option>
        <option value="Ad-hoc">Ad-hoc</option>
        <option value="Personal">Personal study</option>
      </select>
    </label>
```

---

## 3. Quiz Performance by Domain

### File: `npe-web/app/(member)/profile/page.tsx`

**Step 1: Update the quiz_results query**

Find this section (around line 75):
```ts
  const { data: quizResults, error: quizError } = await supabase
    .from("quiz_results")
    .select("score,total_questions,completed_at")
    .eq("user_id", user.id);
```

Replace it with:
```ts
  const { data: quizResultsRaw, error: quizError } = await supabase
    .from("quiz_results")
    .select("score, total_questions, completed_at, quizzes(domain)")
    .eq("user_id", user.id);

  type QuizResultWithDomain = typeof quizResultsRaw extends (infer T)[] ? T : never;
  const quizResults = (quizResultsRaw ?? []) as QuizResultWithDomain[];
```

---

**Step 2: Group by domain & calculate averages**

After the existing quiz calculations (around line 100), replace the `avgQuizPercent` calculation with:

```ts
  // Calculate quiz performance by domain
  const domainStats = quizResults.reduce((acc, result) => {
    const domain = (result.quizzes as any)?.domain || "Other";
    if (!acc[domain]) {
      acc[domain] = [];
    }
    acc[domain].push(result);
    return acc;
  }, {} as Record<string, typeof quizResults>);

  const domainPerformance = Object.entries(domainStats)
    .map(([domain, results]) => ({
      domain,
      avg: Math.round(
        (results.reduce((sum, r) => sum + (r.total_questions > 0 ? (r.score / r.total_questions) * 100 : 0), 0) / results.length)
      ),
      count: results.length,
    }))
    .sort((a, b) => a.avg - b.avg); // Lowest score first

  const avgQuizPercent = quizResults.length
    ? Math.round(
        quizResults.reduce((sum, r) => sum + (r.total_questions > 0 ? (r.score / r.total_questions) * 100 : 0), 0) /
          quizResults.length
      )
    : 0;
```

---

**Step 3: Update the quiz section in JSX**

Find the "Quiz performance" section (around line 140). Replace the entire section with:

```tsx
        <section className="rounded-2xl border bg-card p-6 lg:col-span-2">
          <h2 className="text-2xl">Quiz performance</h2>
          {quizError ? (
            <p className="mt-2 text-sm text-muted-foreground">Quiz statistics will appear after the quiz module is enabled.</p>
          ) : (
            <p className="mt-2 text-sm">
              {quizResults.length} quizzes taken · Average score: {avgQuizPercent}%
            </p>
          )}

          {domainPerformance.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-semibold mb-3">By domain:</p>
              <div className="grid gap-2 lg:grid-cols-2">
                {domainPerformance.map((domain) => {
                  const getColor = (score: number) => {
                    if (score >= 70) return "bg-green-100 text-green-700";
                    if (score >= 50) return "bg-amber-100 text-amber-700";
                    return "bg-red-100 text-red-700";
                  };
                  return (
                    <div key={domain.domain} className={`rounded-lg px-3 py-2 text-sm font-semibold ${getColor(domain.avg)}`}>
                      {domain.domain} — {domain.avg}% ({domain.count})
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!quizResults.length && !quizError ? (
            <p className="mt-2 text-sm text-muted-foreground">Take a quiz to see your performance by domain.</p>
          ) : null}
          <Link href="/quizzes" className="mt-3 inline-block text-sm underline">
            Browse quizzes
          </Link>
        </section>
```

---

## 4. Study Plan Weeks on Calendar

### A. Fetch in Page Component

**File:** `npe-web/app/(member)/schedule/page.tsx`

Find the existing queries (around line 5-15). Add this query after the sessions fetch:

```ts
  // Fetch user's study plan and weeks
  const { data: studyPlan } = user
    ? await supabase
        .from("study_plans")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  const { data: studyPlanWeeks } = studyPlan
    ? await supabase
        .from("study_plan_weeks")
        .select("id, week_start, preferred_days, domain_focus")
        .eq("study_plan_id", studyPlan.id)
        .order("week_start", { ascending: true })
    : { data: null };
```

Add `user` to the page component by adding this at the top:
```ts
const supabase = await createClient();
const {
  data: { user },
} = await supabase.auth.getUser();
```

Pass to ScheduleCalendar:
```tsx
return <ScheduleCalendar sessions={sessions ?? []} studyPlanWeeks={studyPlanWeeks ?? []} addSessionAction={addAdHocSession} />;
```

### B. Render in Calendar Component

**File:** `npe-web/components/member/schedule-calendar.tsx`

**Step 1: Update component props**

Find the function signature:
```tsx
export function ScheduleCalendar({
  sessions,
  addSessionAction,
}: {
  sessions: Session[];
  addSessionAction: (formData: FormData) => Promise<void>;
}) {
```

Update to:
```tsx
type StudyPlanWeek = {
  id: string;
  week_start: string;
  preferred_days: string[]; // ["Monday", "Wednesday", "Friday"]
  domain_focus: string; // "Ethics & law"
};

export function ScheduleCalendar({
  sessions,
  studyPlanWeeks = [],
  addSessionAction,
}: {
  sessions: Session[];
  studyPlanWeeks?: StudyPlanWeek[];
  addSessionAction: (formData: FormData) => Promise<void>;
}) {
```

**Step 2: Generate study block events**

In the `useMemo` where events are created (around line 92), add after the sessions forEach:

```ts
    // Add study plan weeks
    studyPlanWeeks?.forEach((week) => {
      const weekStart = new Date(week.week_start);
      const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      
      // If preferred_days is a comma-separated string, parse it; if array, use directly
      const preferred = typeof week.preferred_days === 'string'
        ? week.preferred_days.split(',').map(d => d.trim())
        : week.preferred_days;
      
      // Generate events for each preferred day in the week (7-day window)
      for (let i = 0; i < 7; i++) {
        const dayDate = new Date(weekStart);
        dayDate.setDate(weekStart.getDate() + i);
        const dayName = daysOfWeek[dayDate.getDay()];
        
        if (preferred.includes(dayName)) {
          addEvent(dateKey(dayDate), {
            kind: "studyBlock",
            id: `study-${week.id}-${i}`,
            title: `Study: ${week.domain_focus}`,
            domainFocus: week.domain_focus,
            at: dayDate,
            sessionType: "Study plan",
          } as any);
        }
      }
    });
```

**Step 3: Update the DayEvent type to include study blocks**

Find this at the top:
```tsx
type DayEvent =
  | {
      kind: "session";
      ...
    }
  | {
      kind: "window";
      ...
    };
```

Add:
```tsx
type DayEvent =
  | {
      kind: "session";
      id: string;
      title: string;
      sessionType: string;
      at: Date;
      description: string | null;
      videoLink: string | null;
    }
  | {
      kind: "studyBlock";
      id: string;
      title: string;
      domainFocus: string;
      at: Date;
      sessionType: "Study plan";
    }
  | {
      kind: "window";
      id: string;
      label: string;
      reg: string;
    };
```

**Step 4: Update eventPillClass**

Find `function eventPillClass` and update:

```tsx
function eventPillClass(event: DayEvent) {
  if (event.kind === "window") return "bg-amber-100 text-amber-700";
  if (event.kind === "studyBlock") return "bg-violet-100 text-violet-700";
  return event.sessionType === "Ad-hoc" ? "bg-primary/15 text-primary" : "bg-slate-800 text-slate-100";
}
```

**Step 5: Update legend to include study blocks**

Update the legend added in task #1 to include:
```tsx
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-violet-100"></div>
          <span className="text-muted-foreground">My study plan</span>
        </div>
```

---

## 5. Video Link Label Verification

### Quick Grep Checks

In terminal from `npe-web` directory:

```bash
# Should return 0 or very few matches (only in comments/migrations)
grep -r "Google Meet" --include="*.tsx" --include="*.ts"

# Should return 0
grep -r "meet_link" --include="*.tsx" --include="*.ts" | grep -v "migration\|\.sql"

# Should show usages of video_link
grep -r "video_link" --include="*.tsx" --include="*.ts" | head -10
```

---

## Testing Checklist

After implementing each feature:

```bash
cd npe-web

# Type check
npm run build

# Run locally
npm run dev

# Open http://localhost:3000/?admin=1 in browser
```

**For each feature test:**
- Schedule filters: Click each button, verify only that type shows
- session_type: Add a session, verify you can select type
- Quiz domain: Take a quiz, go to profile, see breakdown
- Study plan: Should see purple blocks on calendar if you have a study plan
- Video link: Join a session, verify link works

---

## Rollback If Needed

Each change is in a separate file/section, so if something breaks:

```bash
git diff # See what changed
git checkout -- file.tsx # Revert specific file
```

---

Good luck tomorrow! 🚀
