import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function submitAccessRequest(formData: FormData) {
  "use server";

  const payload = {
    full_name: String(formData.get("full_name") || "").trim(),
    email: String(formData.get("email") || "").trim().toLowerCase(),
    ahpra_registration: String(formData.get("ahpra_registration") || "").trim(),
    relationship_note: String(formData.get("relationship_note") || "").trim(),
    reason: String(formData.get("reason") || "").trim(),
  };

  if (!payload.full_name || !payload.email || !payload.reason) {
    return;
  }

  const supabase = await createClient();
  await supabase.from("access_requests").insert(payload);

  redirect("/auth/request-status");
}

export default function RequestAccessPage() {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl items-center px-6 py-10">
      <div className="w-full rounded-2xl border bg-card p-8">
        <h1 className="text-3xl">Request access</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Membership is manually approved. Include your AHPRA registration if relevant.
        </p>

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
          <input
            name="ahpra_registration"
            placeholder="AHPRA registration number (optional)"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          <input
            name="relationship_note"
            placeholder="How we know you / referral (optional)"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          <textarea
            name="reason"
            required
            placeholder="Why you want access"
            className="min-h-28 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
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
      </div>
    </div>
  );
}
