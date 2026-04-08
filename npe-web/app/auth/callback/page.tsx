import { Suspense } from "react";
import { AuthCallbackClient } from "./_components/auth-callback-client";

export const dynamic = "force-dynamic";

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-svh w-full max-w-xl items-center px-6 py-10">
          <div className="w-full rounded-2xl border bg-card p-8">
            <h1 className="text-2xl">Auth callback</h1>
            <p className="mt-3 text-sm text-muted-foreground">Signing you in...</p>
          </div>
        </main>
      }
    >
      <AuthCallbackClient />
    </Suspense>
  );
}
