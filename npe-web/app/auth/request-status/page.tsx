import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function RequestStatusPage() {
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

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl items-center px-6 py-10">
      <div className="w-full rounded-2xl border bg-card p-8">
        <h1 className="text-3xl">Request status</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          If you have submitted a request, it is waiting for manual review. If you are approved, sign in with the same email to enter the member area.
        </p>

        <div className="mt-4 rounded-xl border bg-muted/30 p-4 text-sm">
          <p>
            Signed in: <span className="font-semibold">{user ? "Yes" : "No"}</span>
          </p>
          <p className="mt-1 break-all text-muted-foreground">
            Email: {user?.email || "Not signed in"}
          </p>
          <p className="mt-1">
            Approved for member area: <span className="font-semibold">{user ? (isApproved ? "Yes" : "No") : "Unknown"}</span>
          </p>
        </div>

        <div className="mt-6 flex gap-3">
          <Link className="rounded-md border px-4 py-2 text-sm" href="/auth/request">
            Submit or update request
          </Link>
          <Link className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" href="/auth/login">
            Try sign in
          </Link>
          {user && isApproved ? (
            <Link className="rounded-md border px-4 py-2 text-sm font-semibold" href="/dashboard">
              Go to member dashboard
            </Link>
          ) : null}
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Organiser only: after signing in with the admin email, open <Link className="underline" href="/admin">/admin</Link> to approve requests.
        </p>
      </div>
    </div>
  );
}
