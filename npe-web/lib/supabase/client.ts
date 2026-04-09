import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) in .env.local.",
    );
  }

  return createBrowserClient(
    supabaseUrl,
    supabaseKey,
    {
      auth: {
        // Use implicit flow for email magic links so callback does not depend
        // on a PKCE verifier stored in the same browser context.
        flowType: "implicit",
        detectSessionInUrl: true,
      },
    },
  );
}
