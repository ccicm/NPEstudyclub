import { LoginForm } from "@/components/login-form";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm space-y-4">
        <LoginForm />
        <Button asChild variant="secondary" className="w-full">
          <Link href="/dashboard?admin=1">Open app now</Link>
        </Button>
      </div>
    </div>
  );
}
