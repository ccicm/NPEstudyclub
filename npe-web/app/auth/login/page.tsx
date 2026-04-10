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
  const adminEmails = (process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const isAdmin = Boolean(user?.email && adminEmails.includes(user.email.toLowerCase()));

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm space-y-4">
        <LoginForm />
        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have access yet? <Link href="/auth/request" className="text-primary underline">Request membership</Link>.
        </p>
        {user && isApproved ? (
          <Button asChild className="w-full">
            <Link href="/dashboard">Proceed to member dashboard</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
