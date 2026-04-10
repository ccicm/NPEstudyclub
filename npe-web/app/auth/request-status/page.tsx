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

  const statusTitle = !user ? "Check your request" : isApproved ? "You are approved" : "Request received";
  const statusBody = !user
    ? "If you already submitted an access request, sign in with the same email to continue. If you have not requested access yet, submit the request first."
    : isApproved
      ? "Your access is approved. Sign in with the email from your request, then open the member dashboard."
      : "Your request is in review. We will let you know when a decision has been made.";

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl items-center px-6 py-10">
      <div className="w-full rounded-2xl border bg-card p-8">
        <h1 className="text-3xl">{statusTitle}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{statusBody}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          {!user ? (
            <>
              <Link className="rounded-md border px-4 py-2 text-sm" href="/auth/request">
                Submit access request
              </Link>
              <Link className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" href="/auth/login">
                Sign in
              </Link>
              <Link className="rounded-md border px-4 py-2 text-sm" href="/auth/sign-up">
                Create password
              </Link>
            </>
          ) : isApproved ? (
            <>
              <Link className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" href="/dashboard">
                Open member dashboard
              </Link>
              <Link className="rounded-md border px-4 py-2 text-sm" href="/resources">
                Browse resources
              </Link>
              <Link className="rounded-md border px-4 py-2 text-sm" href="/study-plan">
                Set up study plan
              </Link>
            </>
          ) : (
            <>
              <Link className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" href="/auth/login">
                Sign in again
              </Link>
              <Link className="rounded-md border px-4 py-2 text-sm" href="/auth/request">
                Update request
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
