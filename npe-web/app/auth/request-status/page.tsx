import Link from "next/link";

export default function RequestStatusPage() {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl items-center px-6 py-10">
      <div className="w-full rounded-2xl border bg-card p-8">
        <h1 className="text-3xl">Request status</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          If you have submitted a request, it is waiting for manual review. If you are approved, sign in with the same email to enter the member area.
        </p>
        <div className="mt-6 flex gap-3">
          <Link className="rounded-md border px-4 py-2 text-sm" href="/auth/request">
            Submit or update request
          </Link>
          <Link className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" href="/auth/login">
            Try sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
