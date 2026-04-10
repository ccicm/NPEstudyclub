import Link from "next/link";
import { NPE_DOMAINS } from "@/lib/resource-options";
import { STUDY_TIPS } from "@/lib/study-plan";

type WeekItem = {
  id: string;
  week_number: number;
  week_start: string;
  domain_focus: string;
  suggested_resource_id: string | null;
  suggested_quiz_id: string | null;
  status: "upcoming" | "in_progress" | "complete";
};

type ResourceItem = { id: string; title: string };

type QuizItem = { id: string; title: string };

type StudyLogItem = {
  id: string;
  plan_week_id: string;
  hours_logged: number;
  topics_covered: string | null;
  quiz_insight: string | null;
  notes: string | null;
  created_at: string | null;
};

export function StudyPlanDashboard({
  errorCode,
  plan,
  weeks,
  hoursByWeek,
  recentLogs,
  resources,
  quizzes,
  logStudyTimeAction,
  updateStudyPlanAction,
}: {
  errorCode: string | null;
  plan: {
    exam_date: string;
    hours_per_week: number;
    domain_priorities: Record<string, number>;
  };
  weeks: WeekItem[];
  hoursByWeek: Record<string, number>;
  recentLogs: StudyLogItem[];
  resources: ResourceItem[];
  quizzes: QuizItem[];
  logStudyTimeAction: (formData: FormData) => Promise<void>;
  updateStudyPlanAction: (formData: FormData) => Promise<void>;
}) {
  const now = new Date();
  const examDate = new Date(plan.exam_date);
  const weeksUntilExam = Math.max(0, Math.ceil((examDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 7)));

  const doneCount = weeks.filter((week) => week.status === "complete").length;
  const progressPercent = weeks.length ? Math.round((doneCount / weeks.length) * 100) : 0;

  const currentWeek =
    weeks.find((week) => {
      const start = new Date(week.week_start);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return now >= start && now < end;
    }) || weeks[0];

  const currentHours = currentWeek ? hoursByWeek[currentWeek.id] ?? 0 : 0;
  const currentResource = currentWeek ? resources.find((item) => item.id === currentWeek.suggested_resource_id) : null;
  const currentQuiz = currentWeek ? quizzes.find((item) => item.id === currentWeek.suggested_quiz_id) : null;

  const domainHours = NPE_DOMAINS.map((domain) => {
    const domainWeeks = weeks.filter((week) => week.domain_focus === domain);
    const allocatedPercent = weeks.length ? Math.round((domainWeeks.length / weeks.length) * 100) : 0;
    const completePercent = domainWeeks.length
      ? Math.round((domainWeeks.filter((week) => week.status === "complete").length / domainWeeks.length) * 100)
      : 0;
    return { domain, allocatedPercent, completePercent };
  });

  const tipDomain = currentWeek?.domain_focus || NPE_DOMAINS[0];
  const weeklyTip = STUDY_TIPS[tipDomain] || "Focus on active recall and spaced revision this week.";

  return (
    <div className="space-y-4">
      {errorCode ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {errorCode === "auth_required"
            ? "This action needs a real signed-in session. Sign in again and retry."
            : errorCode === "missing_exam_date"
              ? "Please choose your exam date before saving."
              : errorCode === "invalid_exam_date"
                ? "That exam date could not be parsed. Please select a valid date and save again."
                : errorCode === "missing_priorities"
                  ? "Please set at least one domain priority before saving."
            : errorCode === "schema_not_ready"
              ? "Study Plan tables/columns are not ready. Apply migrations (001-008) in Supabase, then retry."
              : errorCode === "not_authorized"
                ? "Database permissions blocked this save. Confirm this email is approved in approved_users."
                : errorCode === "save_conflict"
                  ? "A conflicting study-plan record was detected. Refresh and retry."
                : "Could not save study plan changes. Please try again."}
        </p>
      ) : null}

      <div className="rounded-2xl border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl">Study Plan</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {weeksUntilExam} weeks until exam · {plan.hours_per_week} hrs planned this week · {progressPercent}% plan complete
            </p>
          </div>
          <Link href="/study-plan/export" className="rounded-md border bg-background px-3 py-2 text-sm font-semibold">
            Download .ics
          </Link>
        </div>
      </div>

      {currentWeek ? (
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="text-2xl">This Week&apos;s Focus</h2>
          <p className="mt-2 text-sm">
            Week {currentWeek.week_number} · {currentWeek.domain_focus}
          </p>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border bg-background p-3">
              <p className="text-sm font-semibold">Suggested resource</p>
              {currentResource ? (
                <Link href="/resources" className="mt-1 inline-block text-sm underline">
                  {currentResource.title}
                </Link>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  No resources yet for this domain. <Link href="/add" className="underline">Upload one</Link> or <Link href="/community" className="underline">Request in Community</Link>.
                </p>
              )}
            </div>
            <div className="rounded-xl border bg-background p-3">
              <p className="text-sm font-semibold">Suggested quiz</p>
              {currentQuiz ? (
                <Link href={`/quizzes/${currentQuiz.id}`} className="mt-1 inline-block text-sm underline">
                  {currentQuiz.title}
                </Link>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">No matching quiz yet.</p>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-xl border bg-background p-3">
            <p className="text-sm">Hours logged this week: {currentHours.toFixed(1)} / {plan.hours_per_week}</p>
            <div className="mt-2 h-2 w-full rounded bg-muted">
              <div
                className="h-2 rounded bg-primary"
                style={{ width: `${Math.min(100, (currentHours / plan.hours_per_week) * 100)}%` }}
              />
            </div>
            <form action={logStudyTimeAction} className="mt-3 grid gap-2 md:grid-cols-2">
              <input type="hidden" name="plan_week_id" value={currentWeek.id} />
              <input name="hours" type="number" min="0.1" max="20" step="0.5" defaultValue="1" className="h-9 rounded-md border bg-background px-3 text-sm" />
              <input name="topics_covered" placeholder="Topics covered" className="h-9 rounded-md border bg-background px-3 text-sm" />
              <input name="quiz_insight" placeholder="Quiz insight" className="h-9 rounded-md border bg-background px-3 text-sm md:col-span-2" />
              <textarea name="notes" placeholder="Notes" className="min-h-20 rounded-md border bg-background px-3 py-2 text-sm md:col-span-2" />
              <button type="submit" className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground md:col-span-2">
                Log study session
              </button>
            </form>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="text-2xl">Recent Study Logs</h2>
        {recentLogs.length ? (
          <div className="mt-3 space-y-3">
            {recentLogs.map((log) => (
              <article key={log.id} className="rounded-xl border bg-background p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{log.hours_logged.toFixed(1)} hrs</p>
                  <p className="text-xs text-muted-foreground">
                    {log.created_at ? new Date(log.created_at).toLocaleString() : "Recently"}
                  </p>
                </div>
                {log.topics_covered ? <p className="mt-2 text-muted-foreground">Topics: {log.topics_covered}</p> : null}
                {log.quiz_insight ? <p className="mt-1 text-muted-foreground">Quiz insight: {log.quiz_insight}</p> : null}
                {log.notes ? <p className="mt-1 text-muted-foreground">Notes: {log.notes}</p> : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Your study log will appear here once you start logging sessions.</p>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="text-2xl">Plan Timeline</h2>
        <div className="mt-3 space-y-2">
          {weeks.map((week) => (
            <details key={week.id} className="rounded-xl border bg-background p-3">
              <summary className="cursor-pointer text-sm font-semibold">
                Week {week.week_number} · {week.domain_focus} · {week.status}
              </summary>
              <p className="mt-2 text-sm text-muted-foreground">Starts {new Date(week.week_start).toLocaleDateString()}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="text-2xl">Domain Progress</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {domainHours.map((row) => (
            <div key={row.domain} className="rounded-xl border bg-background p-3">
              <p className="text-sm font-semibold">{row.domain}</p>
              <p className="text-xs text-muted-foreground">Allocated {row.allocatedPercent}% · Completed {row.completePercent}%</p>
              <div className="mt-2 h-2 w-full rounded bg-muted">
                <div className="h-2 rounded bg-primary" style={{ width: `${row.completePercent}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="text-2xl">This Week&apos;s Tip</h2>
        <p className="mt-2 text-sm text-muted-foreground">{weeklyTip}</p>
      </section>

      <details className="rounded-2xl border bg-card p-5">
        <summary className="cursor-pointer text-lg font-semibold">Edit plan</summary>
        <form action={updateStudyPlanAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span>Exam date</span>
            <input name="exam_date" type="date" defaultValue={plan.exam_date} className="h-10 rounded-md border bg-background px-3" />
          </label>
          <label className="grid gap-1 text-sm">
            <span>Hours per week</span>
            <input
              name="hours_per_week"
              type="number"
              min="1"
              max="20"
              defaultValue={plan.hours_per_week}
              className="h-10 rounded-md border bg-background px-3"
            />
          </label>

          <div className="md:col-span-2">
            <p className="text-sm font-medium">Domain priorities</p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {NPE_DOMAINS.map((domain) => (
                <label key={domain} className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm">
                  <span>{domain}</span>
                  <select
                    defaultValue={String(plan.domain_priorities?.[domain] ?? 2)}
                    name={`priority_${domain}`}
                    className="h-8 rounded-md border bg-card px-2 text-sm"
                  >
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                  </select>
                </label>
              ))}
            </div>
          </div>

          <div className="md:col-span-2">
            <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Save and regenerate remaining weeks
            </button>
          </div>
        </form>
      </details>
    </div>
  );
}
