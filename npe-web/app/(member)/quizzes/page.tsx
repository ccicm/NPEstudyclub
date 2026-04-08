import Link from "next/link";

export default function QuizzesPage() {
  return (
    <div className="rounded-2xl border bg-card p-6">
      <h1 className="text-3xl">Quizzes</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Quiz browsing and attempts are next in the implementation queue.
      </p>
      <div className="mt-4 flex gap-3 text-sm">
        <Link href="/resources" className="underline">
          Browse resources
        </Link>
        <Link href="/community" className="underline">
          Ask in community
        </Link>
      </div>
    </div>
  );
}
