"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type CallbackState =
  | { status: "loading"; message: string }
  | { status: "error"; message: string };

export function AuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<CallbackState>({
    status: "loading",
    message: "Signing you in...",
  });

  const next = useMemo(() => {
    const candidate = searchParams.get("next") || "/dashboard";
    return candidate.startsWith("/") ? candidate : "/dashboard";
  }, [searchParams]);

  useEffect(() => {
    const run = async () => {
      const supabase = createClient();

      try {
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            setState({ status: "error", message: error.message });
            return;
          }

          router.replace(next);
          return;
        }

        const code = searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setState({ status: "error", message: error.message });
            return;
          }

          router.replace(next);
          return;
        }

        setState({
          status: "error",
          message: "No auth callback params found. Request a fresh sign-in link and open it in the same browser.",
        });
      } catch (error) {
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Unexpected sign-in callback error.",
        });
      }
    };

    void run();
  }, [next, router, searchParams]);

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-xl items-center px-6 py-10">
      <div className="w-full rounded-2xl border bg-card p-8">
        <h1 className="text-2xl">Auth callback</h1>
        <p className="mt-3 text-sm text-muted-foreground">{state.message}</p>
        {state.status === "error" ? (
          <p className="mt-4 text-sm">
            <Link href="/auth/login" className="underline">
              Back to login
            </Link>
          </p>
        ) : null}
      </div>
    </main>
  );
}
