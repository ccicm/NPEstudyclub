import { LoginForm } from "@/components/login-form";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: approvedRows } = user?.email
    ? await supabase
        .from("approved_users")
        .select("email")
        .eq("email", user.email.toLowerCase())
        .eq("status", "approved")
        .limit(1)
    : { data: null };
  const isApproved = Boolean(approvedRows?.length);

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm space-y-4">
        <LoginForm />
        {user && isApproved ? (
          <Button asChild className="w-full">
            <Link href="/dashboard">Proceed to member dashboard</Link>
          </Button>
        ) : null}
        <Button asChild variant="secondary" className="w-full">
          <Link href="/dashboard?admin=1">Open app now</Link>
        </Button>
      </div>
    </div>
  );
}
