import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

const EXAM_WINDOW_OPEN = new Date("2026-05-04T00:00:00+10:00");

function getDaysRemaining() {
  const now = new Date();
  const ms = EXAM_WINDOW_OPEN.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export default async function Home() {
  const daysRemaining = getDaysRemaining();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.email) {
    const { data } = await supabase
      .from("approved_users")
      .select("email")
      .eq("email", user.email.toLowerCase())
      .eq("status", "approved")
      .limit(1);

    if (data?.length) {
      redirect("/dashboard");
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-6 md:px-8">
      <header className="rounded-3xl border bg-card p-4 shadow-sm md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">NPE Study Club</p>
            <p className="text-sm text-muted-foreground">Dashboard preview for visitors. Sign in for full member features.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/auth/request">Request access</Link>
          </Button>
          <Button asChild>
            <Link href="/auth/login">Member sign in</Link>
          </Button>
        </div>
        </div>
        <nav className="mt-4 flex flex-wrap gap-2">
          {[
            { href: "/auth/login", label: "Dashboard" },
            { href: "/auth/login", label: "Resources" },
            { href: "/auth/login", label: "Quizzes" },
            { href: "/auth/login", label: "Study Plan" },
            { href: "/auth/login", label: "Schedule" },
            { href: "/auth/login", label: "Community" },
            { href: "/auth/login", label: "Profile" },
          ].map((link) => (
            <Link key={link.label} href={link.href} className="rounded-full border px-3 py-1.5 text-sm transition-colors hover:bg-muted">
              {link.label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="mt-6 space-y-6">
        <section className="rounded-2xl border bg-card p-6">
          <h1 className="text-3xl">Dashboard</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You are viewing the public dashboard shell. Sign in to unlock your personal study plan, progress, and
            community tools.
          </p>
          <div className="mt-4 rounded-xl border bg-muted/30 p-4">
            <p className="text-sm font-semibold">Countdown</p>
            <p className="mt-1 text-2xl font-semibold">{daysRemaining} days until May 2026 window opens</p>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border bg-card p-6">
            <h2 className="text-2xl">Upcoming Sessions</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to see upcoming group sessions, ad-hoc meetups, and your own calendar items.
            </p>
            <Link href="/auth/login" className="mt-3 inline-block text-sm underline">
              Open schedule after sign in
            </Link>
          </section>

          <section className="rounded-2xl border bg-card p-6">
            <h2 className="text-2xl">Recently Added Resources</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Member-only resources, quizzes, and notes are available after approval and sign-in.
            </p>
            <Link href="/auth/request" className="mt-3 inline-block text-sm underline">
              Request access
            </Link>
          </section>
        </div>

        <section className="rounded-2xl border bg-card p-6">
          <h2 className="text-2xl">How Access Works</h2>
          <div className="mt-3 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
            <div className="rounded-2xl bg-muted p-4">
              <p className="font-semibold text-foreground">1. Request</p>
              <p className="mt-1">Submit your access request.</p>
            </div>
            <div className="rounded-2xl bg-muted p-4">
              <p className="font-semibold text-foreground">2. Approval</p>
              <p className="mt-1">An admin reviews and approves your email.</p>
            </div>
            <div className="rounded-2xl bg-muted p-4">
              <p className="font-semibold text-foreground">3. Member app</p>
              <p className="mt-1">Create your password and use the full dashboard.</p>
            </div>
          </div>
        </section>
      </div>

      <p className="mt-6 text-sm text-muted-foreground">Read our <Link href="/privacy" className="underline">Privacy Policy</Link>.</p>
    </main>
  );
}
