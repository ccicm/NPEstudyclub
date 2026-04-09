import Link from "next/link";
import { Button } from "@/components/ui/button";
import { QUICK_LINKS } from "@/lib/quick-links";

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
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold tracking-[0.24em] text-primary">NPE STUDY CLUB</p>
          <p className="text-sm text-muted-foreground">Private prep space for approved provisional psychologists.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="secondary">
            <Link href="/dashboard?admin=1">Open app now</Link>
          </Button>
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
            <h1 className="text-4xl leading-tight md:text-6xl">NPE prep, in one place.</h1>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
              Private resources, study sessions, and community for provisional psychologists sitting the National
              Psychology Exam.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" variant="secondary">
                <Link href="/dashboard?admin=1">Open app now</Link>
              </Button>
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
        <Link href="/auth/request" className="rounded-2xl border bg-card p-6 transition hover:bg-muted/30">
          <article>
            <h2 className="text-2xl">Resources</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Curated PDFs, protocols, and exam prep materials organised by topic, with private file access for members.
            </p>
            <p className="mt-3 text-sm font-semibold text-primary">Open request form -&gt;</p>
          </article>
        </Link>
        <Link href="/auth/request" className="rounded-2xl border bg-card p-6 transition hover:bg-muted/30">
          <article>
            <h2 className="text-2xl">Schedule</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Shared calendar with weekly sessions, ad-hoc meetups, and exam window markers.
            </p>
            <p className="mt-3 text-sm font-semibold text-primary">Open request form -&gt;</p>
          </article>
        </Link>
        <Link href="/auth/request" className="rounded-2xl border bg-card p-6 transition hover:bg-muted/30">
          <article>
            <h2 className="text-2xl">Community</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Private noticeboard/forum for announcements, questions, resource requests, and replies.
            </p>
            <p className="mt-3 text-sm font-semibold text-primary">Open request form -&gt;</p>
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

      <section className="mt-6 rounded-2xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">No-login preview mode</p>
        <p className="mt-1">
          If email sign-in is not working, use <Link href="/dashboard?admin=1" className="underline">Open app now</Link> to jump straight into the member area while preview mode is on.
        </p>
      </section>

      <section className="mt-10 rounded-3xl border bg-card p-8">
        <div className="grid gap-6 md:grid-cols-[0.9fr_1.1fr] md:items-center">
          <div>
            <h2 className="mt-2 text-3xl">Approved members get in. Everyone else requests access.</h2>
          </div>
          <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
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
              <p className="mt-1">Once approved, you will get an email with a sign-in link.</p>
            </div>
          </div>
        </div>
      </section>

      <p className="mt-6 text-sm text-muted-foreground">
        Read our <Link href="/privacy" className="underline">Privacy Policy</Link>.
      </p>
    </main>
  );
}
