import Link from "next/link";
import { Button } from "@/components/ui/button";
import { QUICK_LINKS } from "@/lib/quick-links";
import { EXAM_WINDOWS, windowToDates } from "@/lib/exam-windows";
import { createClient } from "@/lib/supabase/server";

function getTimelineWindow(now: Date) {
  const active = EXAM_WINDOWS.find((window) => {
    const { start, end } = windowToDates(window);
    return now >= start && now <= end;
  });

  if (active) {
    return active;
  }

  const upcoming = EXAM_WINDOWS.find((window) => {
    const registrationOpen = new Date(window.registrationOpen[0], window.registrationOpen[1] - 1, window.registrationOpen[2]);
    return now < registrationOpen;
  });

  return upcoming ?? EXAM_WINDOWS[EXAM_WINDOWS.length - 1] ?? null;
}

function formatDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isApproved = false;
  if (user?.email) {
    const { data } = await supabase
      .from("approved_users")
      .select("email")
      .eq("email", user.email.toLowerCase())
      .eq("status", "approved")
      .limit(1);

    isApproved = Boolean(data?.length);
  }

  const now = new Date();
  const timelineWindow = getTimelineWindow(now);

  const memberDestination = isApproved ? "/dashboard" : "/auth/login";
  const resourcesDestination = isApproved ? "/resources" : "/auth/request";
  const scheduleDestination = isApproved ? "/schedule" : "/auth/request";
  const communityDestination = isApproved ? "/community" : "/auth/request";

  const registrationOpen = timelineWindow
    ? new Date(
        timelineWindow.registrationOpen[0],
        timelineWindow.registrationOpen[1] - 1,
        timelineWindow.registrationOpen[2],
      )
    : null;
  const windowDates = timelineWindow ? windowToDates(timelineWindow) : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-8 md:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold tracking-[0.24em] text-primary">NPE STUDY CLUB</p>
          <p className="text-sm text-muted-foreground">Private prep space for approved provisional psychologists.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/auth/login">Sign in</Link>
          </Button>
        </div>
      </header>

      <section className="mt-16 rounded-3xl border bg-card p-8 shadow-sm md:p-12">
        <div className="grid gap-10 md:grid-cols-[1.2fr_0.8fr]">
          <div>
            <h1 className="text-4xl leading-tight md:text-6xl">NPE prep, in one place.</h1>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
              Private resources, study sessions, and community for provisional psychologists sitting the National
              Psychology Exam.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href={isApproved ? "/dashboard" : "/auth/request"}>{isApproved ? "Go to dashboard" : "Apply for membership"}</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href={memberDestination}>{isApproved ? "Open member area" : "Already a member? Sign in"}</Link>
              </Button>
            </div>
          </div>
          <div className="rounded-2xl bg-accent p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-accent-foreground">
              NPE Timeline
            </p>
            {timelineWindow && registrationOpen && windowDates ? (
              <div className="mt-3 space-y-2 text-sm text-accent-foreground/90">
                <p className="font-medium">{timelineWindow.label}</p>
                <p>Registrations open: {formatDate(registrationOpen)}</p>
                <p>Exam window opens: {formatDate(windowDates.start)}</p>
                <p>Exam window closes: {formatDate(windowDates.end)}</p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-accent-foreground/90">Exam dates will appear here once configured.</p>
            )}
          </div>
        </div>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-3">
        <Link href={resourcesDestination} className="rounded-2xl border bg-card p-6 transition hover:bg-muted/30">
          <article>
            <h2 className="text-2xl">Resources</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Curated PDFs, protocols, and exam prep materials organised by topic, with private file access for members.
            </p>
            <p className="mt-3 text-sm font-semibold text-primary">
              {isApproved ? "Open resources -&gt;" : "Request access -&gt;"}
            </p>
          </article>
        </Link>
        <Link href={scheduleDestination} className="rounded-2xl border bg-card p-6 transition hover:bg-muted/30">
          <article>
            <h2 className="text-2xl">Schedule</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Shared calendar with weekly sessions, ad-hoc meetups, and exam window markers.
            </p>
            <p className="mt-3 text-sm font-semibold text-primary">
              {isApproved ? "Open schedule -&gt;" : "Request access -&gt;"}
            </p>
          </article>
        </Link>
        <Link href={communityDestination} className="rounded-2xl border bg-card p-6 transition hover:bg-muted/30">
          <article>
            <h2 className="text-2xl">Community</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Private noticeboard/forum for announcements, questions, resource requests, and replies.
            </p>
            <p className="mt-3 text-sm font-semibold text-primary">
              {isApproved ? "Open community -&gt;" : "Request access -&gt;"}
            </p>
          </article>
        </Link>
      </section>

      <section className="mt-6 rounded-2xl border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Quick links</h2>
          <p className="text-xs text-muted-foreground">External resources</p>
        </div>
        <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {QUICK_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="min-w-56 rounded-xl border bg-background px-3 py-2 text-sm transition hover:bg-muted/40"
            >
              <p className="font-medium">{link.label}</p>
              <p className="mt-1 text-xs text-primary">Open link -&gt;</p>
            </a>
          ))}
        </div>
      </section>

      <section className="mt-10 rounded-3xl border bg-card p-8">
        <div className="grid gap-6 md:grid-cols-[0.9fr_1.1fr] md:items-center">
          <div>
            <h2 className="mt-2 text-3xl">A private study space for a small cohort of peers.</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              If you have been told about this space, you are probably in the right place.
            </p>
          </div>
          <div className="mt-3 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
            <div className="rounded-2xl bg-muted p-4">
              <p className="font-semibold text-foreground">1. Request</p>
              <p className="mt-1">Submit a short access request via the button above.</p>
            </div>
            <div className="rounded-2xl bg-muted p-4">
              <p className="font-semibold text-foreground">2. Approval</p>
              <p className="mt-1">Your request is reviewed and approved by the group organiser.</p>
            </div>
            <div className="rounded-2xl bg-muted p-4">
              <p className="font-semibold text-foreground">3. Access</p>
              <p className="mt-1">Once approved, create your password and sign in to the member app.</p>
            </div>
          </div>
        </div>
      </section>

      <p className="mt-6 text-sm text-muted-foreground">Read our <Link href="/privacy" className="underline">Privacy Policy</Link>.</p>
    </main>
  );
}
