import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ExamCountdown } from "@/components/member/exam-countdown";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const bypassEnabled =
    process.env.ALLOW_ADMIN_BYPASS === "true" ||
    process.env.ALLOW_MEMBER_BYPASS === "true";

  const adminEmails = (process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const authEmail = user?.email?.toLowerCase() || "";
  const isAdmin = Boolean(authEmail && adminEmails.includes(authEmail));

  const { data: sessions } = await supabase
    .from("sessions")
    .select("id,title,session_type,scheduled_at,description,video_link")
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(4);

  const { data: studyPlan } = user
    ? await supabase
        .from("study_plans")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  const dismissedOnboarding = Boolean(user?.user_metadata?.onboarding_dismissed);
  const showOnboarding = Boolean(user) && !studyPlan && !dismissedOnboarding;

  const { data: recentResources } = await supabase
    .from("resources")
    .select("id,title,category,file_type,created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  const { count: completedResources } = user
    ? await supabase
        .from("user_progress")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
    : { count: 0 };

  const { count: totalResources } = await supabase.from("resources").select("id", { count: "exact", head: true });

  const resourcePercent = totalResources ? Math.round(((completedResources || 0) / totalResources) * 100) : 0;

  const { data: keyReferences } = await supabase
    .from("key_references")
    .select("id,title,source,description,url,is_new")
    .order("display_order", { ascending: true })
    .limit(8);

  const [{ count: threadsStarted }, { count: repliesCount }, { data: quizResultsRaw, error: quizError }] = await Promise.all([
    user
      ? supabase.from("forum_threads").select("id", { count: "exact", head: true }).eq("created_by", user.id)
      : Promise.resolve({ count: 0 }),
    user
      ? supabase.from("forum_replies").select("id", { count: "exact", head: true }).eq("created_by", user.id)
      : Promise.resolve({ count: 0 }),
    user
      ? supabase
          .from("quiz_results")
          .select("score, total_questions, completed_at, quizzes(domain)")
          .eq("user_id", user.id)
      : Promise.resolve({ data: [], error: null }),
  ]);

  type QuizResultWithDomain = {
    score: number;
    total_questions: number;
    completed_at: string;
    quizzes: { domain?: string } | { domain?: string }[] | null;
  };

  const quizResults = (quizResultsRaw ?? []) as QuizResultWithDomain[];
  const quizAttempts = quizError ? [] : quizResults;
  const quizCount = quizAttempts.length;

  const domainStats = quizAttempts.reduce((acc, result) => {
    const quizRelation = Array.isArray(result.quizzes) ? result.quizzes[0] : result.quizzes;
    const domain = quizRelation?.domain || "Other";
    if (!acc[domain]) {
      acc[domain] = [];
    }
    acc[domain].push(result);
    return acc;
  }, {} as Record<string, typeof quizAttempts>);

  const domainPerformance = Object.entries(domainStats)
    .map(([domain, results]) => ({
      domain,
      avg: Math.round(
        results.reduce((sum, result) => sum + (result.total_questions > 0 ? (result.score / result.total_questions) * 100 : 0), 0) /
          results.length,
      ),
      count: results.length,
    }))
    .sort((a, b) => a.avg - b.avg);

  const avgQuizPercent = quizCount
    ? Math.round(
        quizAttempts.reduce((sum, result) => {
          const scorePercent = result.total_questions > 0 ? (result.score / result.total_questions) * 100 : 0;
          return sum + scorePercent;
        }, 0) / quizCount,
      )
    : 0;

  const fileTypeColor = (fileType: string | null) => {
    const type = (fileType || "").toLowerCase();
    if (type === "pdf") return "bg-red-100 text-red-700";
    if (type === "docx" || type === "doc") return "bg-blue-100 text-blue-700";
    if (type === "pptx" || type === "ppt") return "bg-orange-100 text-orange-700";
    if (type === "xlsx" || type === "xls") return "bg-green-100 text-green-700";
    return "bg-slate-100 text-slate-700";
  };

  const dateBlock = (isoDate: string) => {
    const date = new Date(isoDate);
    return {
      day: date.toLocaleDateString(undefined, { day: "2-digit" }),
      month: date.toLocaleDateString(undefined, { month: "short" }),
    };
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border bg-card p-8 shadow-sm md:p-10">
        <div className="grid gap-8 md:grid-cols-[1.2fr_0.8fr]">
          <div>
            <h1 className="text-4xl leading-tight md:text-5xl">Member Dashboard</h1>
            <p className="mt-3 max-w-2xl text-base text-muted-foreground">
              Your study hub for resources, schedule, quizzes, and plan tracking.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/resources" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                Open resources
              </Link>
              <Link href="/study-plan" className="rounded-md border bg-background px-4 py-2 text-sm font-semibold">
                Open study plan
              </Link>
            </div>
          </div>
          <div className="rounded-2xl bg-accent p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-foreground">Account</p>
            <p className="mt-2 break-all text-sm text-accent-foreground/90">{user?.email}</p>
            <p className="mt-3 text-sm text-accent-foreground/80">
              Signed in and approved for member features.
            </p>
          </div>
        </div>
      </section>

      {showOnboarding ? (
        <section className="rounded-2xl border bg-card p-6">
          <p className="text-2xl">Welcome to NPE Study Club</p>
          <p className="mt-2 text-sm text-muted-foreground">You are in. Here is a simple way to get started.</p>
          <ol className="mt-4 space-y-2 text-sm">
            <li>1. Browse the resource library.</li>
            <li>2. Set up your study plan.</li>
            <li>3. Introduce yourself in Community.</li>
            <li>
              4. Read <Link href="/community/guidelines" className="underline">community guidelines</Link> before posting.
            </li>
          </ol>
          <Link
            href="/study-plan"
            className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Start plan
          </Link>
        </section>
      ) : null}

      {isAdmin ? (
        <section className="rounded-2xl border border-primary/30 bg-primary/5 p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl">User management</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Approve access requests and review members from here.
              </p>
            </div>
            <Link
              href="/admin"
              className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Open user management
            </Link>
          </div>
          {bypassEnabled ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Preview mode is on. For normal member behavior, turn bypass off once sign-in is stable.
            </p>
          ) : null}
        </section>
      ) : null}

      <ExamCountdown />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border bg-card p-6">
          <h2 className="text-2xl">Resource Progress</h2>
          <p className="mt-2 text-sm">
            {(completedResources || 0)} of {totalResources || 0} resources completed
          </p>
          <div className="mt-2 h-2 w-full rounded bg-muted">
            <div className="h-2 rounded bg-primary" style={{ width: `${resourcePercent}%` }} />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Use the resource library to mark completed items and keep this overview current.
          </p>
          <Link href="/resources" className="mt-3 inline-block text-sm underline">
            Open Resources
          </Link>
        </section>

        <section className="rounded-2xl border bg-card p-6">
          <h2 className="text-2xl">Upcoming Sessions</h2>
          {!sessions?.length ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No upcoming sessions. Visit <Link href="/schedule" className="underline">Schedule</Link> to add one.
            </p>
          ) : (
            <ul className="mt-3 space-y-3 text-sm">
              {sessions.map((session) => {
                const date = dateBlock(session.scheduled_at);
                return (
                  <li key={session.id} className="grid grid-cols-[52px_1fr_auto] items-center gap-3 rounded-xl bg-muted/50 p-3">
                    <div className="rounded-lg border bg-card p-2 text-center">
                      <p className="text-lg font-semibold leading-none">{date.day}</p>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{date.month}</p>
                    </div>
                    <div>
                      <p className="font-semibold">{session.title || "Study session"}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(session.scheduled_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </p>
                    </div>
                    {session.video_link ? (
                      <Link href={session.video_link} target="_blank" className="text-xs underline">
                        Join
                      </Link>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border bg-card p-6">
          <h2 className="text-2xl">Recently Added Resources</h2>
          {!recentResources?.length ? (
            <p className="mt-2 text-sm text-muted-foreground">No resources yet.</p>
          ) : (
            <ul className="mt-3 space-y-3 text-sm">
              {recentResources.map((resource) => (
                <li key={resource.id}>
                  <Link href={`/resources?id=${resource.id}`} className="flex items-center gap-3 rounded-xl bg-muted/40 p-3 hover:bg-muted/60">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${fileTypeColor(resource.file_type)}`}>
                      {(resource.file_type || "file").toUpperCase()}
                    </span>
                    <div>
                      <p className="font-semibold">{resource.title}</p>
                      <p className="text-xs text-muted-foreground">{resource.category}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-2xl border bg-card p-6">
        <h2 className="text-2xl">Key References</h2>
        {!keyReferences?.length ? (
          <p className="mt-2 text-sm text-muted-foreground">No key references published yet.</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {keyReferences.map((reference) => (
              <article key={reference.id} className="rounded-xl border bg-background p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg leading-tight">{reference.title}</h3>
                  {reference.is_new ? (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">New</span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{reference.source}</p>
                {reference.description ? (
                  <p className="mt-2 text-sm text-muted-foreground">{reference.description}</p>
                ) : null}
                {reference.url ? (
                  <Link href={reference.url} target="_blank" className="mt-3 inline-block text-sm underline">
                    Open reference
                  </Link>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border bg-card p-6">
          <h2 className="text-2xl">Quiz Activity</h2>
          {quizError ? (
            <p className="mt-2 text-sm text-muted-foreground">Quiz statistics will appear after quiz activity is available.</p>
          ) : (
            <p className="mt-2 text-sm">
              {quizCount} quizzes taken · Average score: {avgQuizPercent}%
            </p>
          )}

          {domainPerformance.length > 0 ? (
            <div className="mt-4">
              <p className="mb-3 text-sm font-semibold">By domain:</p>
              <div className="grid gap-2">
                {domainPerformance.map((domain) => {
                  const getColor = (score: number) => {
                    if (score >= 70) return "bg-green-100 text-green-700";
                    if (score >= 50) return "bg-amber-100 text-amber-700";
                    return "bg-red-100 text-red-700";
                  };

                  return (
                    <div key={domain.domain} className={`rounded-lg px-3 py-2 text-sm font-semibold ${getColor(domain.avg)}`}>
                      {domain.domain} · {domain.avg}% avg · {domain.count} attempts
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {!quizCount && !quizError ? (
            <p className="mt-2 text-sm text-muted-foreground">Take a quiz to see your activity and performance by domain.</p>
          ) : null}

          <Link href="/quizzes/results" className="mt-3 inline-block text-sm underline">
            View quiz history
          </Link>
        </section>

        <section className="rounded-2xl border bg-card p-6">
          <h2 className="text-2xl">Community Activity</h2>
          {!(threadsStarted || 0) && !(repliesCount || 0) ? (
            <div className="mt-3 rounded-xl border bg-muted/30 p-4">
              <p className="text-sm">You haven&apos;t posted yet.</p>
              <Link href="/community" className="mt-2 inline-block text-sm font-semibold underline">
                Start a thread in Community -&gt;
              </Link>
            </div>
          ) : (
            <>
              <p className="mt-2 text-sm">Threads I started: {threadsStarted || 0}</p>
              <p className="mt-1 text-sm">Replies posted: {repliesCount || 0}</p>
            </>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/community?author=me" className="text-sm underline">
              View my posts
            </Link>
            <Link href="/community" className="text-sm underline">
              Open community
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
