import Link from "next/link";

export default function StudyPlanPage() {
  return (
    <div className="rounded-2xl border bg-card p-6">
      <h1 className="text-3xl">Study Plan</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Personal plan onboarding and week-by-week generation are queued for the next build phase.
      </p>
      <div className="mt-4 flex gap-3 text-sm">
        <Link href="/schedule" className="underline">
          View schedule
        </Link>
        <Link href="/resources" className="underline">
          Open resources
        </Link>
      </div>
    </div>
  );
}
