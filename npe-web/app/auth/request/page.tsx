import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function submitAccessRequest(formData: FormData) {
  "use server";

  const consentGiven = formData.get("consent_privacy") === "on";

  const payload = {
    full_name: String(formData.get("full_name") || "").trim(),
    email: String(formData.get("email") || "").trim().toLowerCase(),
    psy_number: String(formData.get("psy_number") || "").trim().toUpperCase(),
    relationship_note: String(formData.get("relationship_note") || "").trim(),
    reason: String(formData.get("reason") || "").trim(),
    consented_at: consentGiven ? new Date().toISOString() : null,
  };

  if (!payload.full_name || !payload.email || !consentGiven) {
    redirect("/auth/request?error=missing_fields");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("access_requests").insert(payload);

  if (error) {
    redirect("/auth/request?error=submission_failed");
  }

  redirect("/auth/request-status");
}

export default function RequestAccessPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  const errorMessage =
    searchParams?.error === "missing_fields"
      ? "Please fill in your name, email, and consent before submitting."
      : searchParams?.error === "submission_failed"
        ? "We could not save your request. Please try again."
        : null;

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl items-center px-6 py-10">
      <div className="w-full rounded-2xl border bg-card p-8">
        <h1 className="text-3xl">Request access</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Membership is manually approved. Include your PSY number if relevant.
        </p>

        <p className="mt-3 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Your PSY number is collected to help verify your provisional psychologist status. It is stored securely and
          is not shared with third parties. You can request correction or deletion of your information by contacting
          the organiser.
        </p>

        {errorMessage ? (
          <p className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        <form action={submitAccessRequest} className="mt-6 space-y-3">
          <input
            name="full_name"
            required
            placeholder="Full name"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          <input
            name="email"
            type="email"
            required
            placeholder="Email"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          <div className="space-y-1">
            <label htmlFor="psy_number" className="block text-sm font-medium">
              PSY number (if registered with AHPRA)
            </label>
            <input
              id="psy_number"
              name="psy_number"
              pattern="PSY[0-9]{10}"
              placeholder="PSY0001234567"
              title="Enter a PSY number in the format PSY followed by 10 digits"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
            <p className="text-xs text-muted-foreground">e.g. PSY0001234567</p>
          </div>
          <input
            name="relationship_note"
            placeholder="How we know you / referral (optional)"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          <textarea
            name="reason"
            placeholder="Why you want access"
            className="min-h-28 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          <label className="flex items-start gap-2 rounded-md border bg-muted/20 px-3 py-2 text-sm">
            <input name="consent_privacy" type="checkbox" required className="mt-0.5" />
            <span>
              I agree to the <Link className="underline" href="/privacy">Privacy Policy</Link> and consent to my
              personal information, including my PSY number, being stored for membership verification and participation
              in NPE Study Club.
            </span>
          </label>
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Submit request
          </button>
        </form>

        <p className="mt-4 text-sm text-muted-foreground">
          Already approved? <Link className="text-primary underline" href="/auth/login">Use member sign in</Link>.
        </p>

        {process.env.NODE_ENV === "development" ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Preview mode on? <Link className="text-primary underline" href="/dashboard?admin=1">Open app now</Link>.
          </p>
        ) : null}
      </div>
    </div>
  );
}
