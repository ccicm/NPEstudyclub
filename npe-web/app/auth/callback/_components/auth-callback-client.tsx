"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type CallbackState =
  | { status: "loading"; message: string }
  | { status: "error"; message: string };

function mapCallbackError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (message.includes("expired") || message.includes("invalid") || message.includes("token")) {
    return "This sign-in link is no longer valid. Request a new link and try again.";
  }
  if (message.includes("too many") || message.includes("rate limit")) {
    return "Too many attempts right now. Please wait a moment and request a new link.";
  }

  return "We could not complete sign-in right now. Request a fresh sign-in link and try again.";
}

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
            setState({ status: "error", message: mapCallbackError(error) });
            return;
          }

          router.replace(next);
          return;
        }

        const code = searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            if (error.message.toLowerCase().includes("pkce code verifier")) {
              setState({
                status: "error",
                message:
                  "This sign-in link was opened in a different browser or app. Request a new link and open it in the same browser where you started sign-in.",
              });
              return;
            }
            setState({ status: "error", message: mapCallbackError(error) });
            return;
          }

          router.replace(next);
          return;
        }

        setState({
          status: "error",
          message: "This sign-in link is incomplete or expired. Request a new link and open it in the same browser.",
        });
      } catch (error) {
        setState({
          status: "error",
          message: mapCallbackError(error),
        });
      }
    };

    void run();
  }, [next, router, searchParams]);

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-xl items-center px-6 py-10">
      <div className="w-full rounded-2xl border bg-card p-8">
        <h1 className="text-2xl">Sign-in update</h1>
        <p className="mt-3 text-sm text-muted-foreground">{state.message}</p>
        {state.status === "error" ? (
          <div className="mt-4 space-y-2 text-sm">
            <p className="text-muted-foreground">
              Tip: if the email opened in a different browser or app, copy the link and open it in the same browser where you requested sign-in.
            </p>
            <p>
              <Link href="/auth/login" className="underline">
                Back to login
              </Link>
            </p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
