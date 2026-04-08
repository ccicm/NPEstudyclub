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
    process.env.ALLOW_MEMBER_BYPASS === "true" ||
    process.env.NEXT_PUBLIC_ALLOW_MEMBER_BYPASS === "true";

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

  const { data: keyReferences } = await supabase
    .from("key_references")
    .select("id,title,source,description,url,is_new")
    .order("display_order", { ascending: true })
    .limit(8);

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
            Preview mode is on, so this link should open without email sign-in.
          </p>
        ) : null}
      </section>

      {showOnboarding ? (
        <section className="rounded-2xl border bg-card p-6">
          <p className="text-2xl">Welcome to NPE Study Club</p>
          <p className="mt-2 text-sm text-muted-foreground">You are in. Here is a simple way to get started.</p>
          <ol className="mt-4 space-y-2 text-sm">
            <li>1. Browse the resource library.</li>
            <li>2. Set up your study plan.</li>
            <li>3. Introduce yourself in Community.</li>
          </ol>
          <Link
            href="/study-plan"
            className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Start plan
          </Link>
        </section>
      ) : null}

      <ExamCountdown />

      <div className="grid gap-6 lg:grid-cols-2">
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
                  <Link href="/resources" className="flex items-center gap-3 rounded-xl bg-muted/40 p-3 hover:bg-muted/60">
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
    </div>
  );
}
