import Link from "next/link";
import { Button } from "@/components/ui/button";

const EXAM_WINDOW_OPEN = new Date("2026-05-04T00:00:00+10:00");

function getDaysRemaining() {
  const now = new Date();
  const ms = EXAM_WINDOW_OPEN.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export default function Home() {
  const daysRemaining = getDaysRemaining();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-8 md:px-8">
      <header className="flex items-center justify-between">
        <p className="text-sm font-semibold tracking-wide text-primary">NPE STUDY CLUB</p>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/auth/request">Request access</Link>
          </Button>
          <Button asChild>
            <Link href="/auth/login">Member sign in</Link>
          </Button>
        </div>
      </header>

      <section className="mt-16 rounded-3xl border bg-card p-8 shadow-sm md:p-12">
        <div className="grid gap-10 md:grid-cols-[1.2fr_0.8fr]">
          <div>
            <h1 className="text-4xl leading-tight md:text-6xl">NPE Study Club</h1>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
              Shared resources, study sessions, and a private member noticeboard
              for provisional psychologists preparing for the National
              Psychology Exam.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/auth/request">Apply for membership</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/auth/login">Already approved? Sign in</Link>
              </Button>
            </div>
          </div>
          <div className="rounded-2xl bg-accent p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-accent-foreground">
              Countdown
            </p>
            <p className="mt-2 text-5xl font-bold text-accent-foreground">{daysRemaining}</p>
            <p className="mt-1 text-sm text-accent-foreground/80">
              days until May 2026 NPE window opens
            </p>
            <p className="mt-4 text-sm text-accent-foreground/70">
              Access is approved manually by the owner. Membership is limited to
              trusted contacts and provisional psychologists registered with
              AHPRA.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border bg-card p-6">
          <h2 className="text-2xl">Resources</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Curated PDFs, protocols, and exam prep materials organised by topic.
          </p>
        </article>
        <article className="rounded-2xl border bg-card p-6">
          <h2 className="text-2xl">Schedule</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Shared calendar with weekly sessions and NPE exam markers.
          </p>
        </article>
        <article className="rounded-2xl border bg-card p-6">
          <h2 className="text-2xl">Community</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Private noticeboard/forum for announcements, requests, and questions.
          </p>
        </article>
      </section>
    </main>
  );
}
