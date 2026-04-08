import { revalidatePath } from "next/cache";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

type AccessRequest = {
  id: string;
  full_name: string;
  email: string;
  ahpra_registration: string | null;
  psy_number: string | null;
  relationship_note: string | null;
  reason: string | null;
  status: "pending" | "approved" | "declined";
  created_at: string;
};

async function reviewRequest(formData: FormData) {
  "use server";

  const { user } = await requireAdmin();
  const reviewerId = user?.id;
  const requestId = String(formData.get("request_id") || "").trim();
  const decision = String(formData.get("decision") || "").trim();

  if (!reviewerId || !requestId || !["approve", "decline"].includes(decision)) {
    return;
  }

  const adminClient = createAdminClient();
  const { data: request } = await adminClient
    .from("access_requests")
    .select("id,full_name,email,ahpra_registration,relationship_note,status")
    .eq("id", requestId)
    .maybeSingle();

  if (!request) {
    return;
  }

  const now = new Date().toISOString();
  const newStatus = decision === "approve" ? "approved" : "declined";

  if (decision === "approve") {
    await adminClient.from("approved_users").upsert(
      {
        email: String(request.email || "").trim().toLowerCase(),
        full_name: request.full_name || null,
        ahpra_registration: request.ahpra_registration || null,
        verification_notes: request.relationship_note || null,
        status: "approved",
      },
      { onConflict: "email" },
    );
  }

  await adminClient
    .from("access_requests")
    .update({
      status: newStatus,
      reviewed_by: reviewerId,
      reviewed_at: now,
    })
    .eq("id", requestId);

  revalidatePath("/admin");
  revalidatePath("/auth/request-status");
}

async function grantSelfAccess() {
  "use server";

  const { user } = await requireAdmin();
  if (!user?.email) {
    return;
  }

  const adminClient = createAdminClient();
  await adminClient.from("approved_users").upsert(
    {
      email: user.email.toLowerCase(),
      full_name: String(user.user_metadata?.display_name || "").trim() || null,
      status: "approved",
    },
    { onConflict: "email" },
  );

  revalidatePath("/admin");
  revalidatePath("/auth/request-status");
}

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { user } = await requireAdmin();

  let pendingRequests: AccessRequest[] = [];
  let recentRequests: AccessRequest[] = [];
  let loadError: string | null = null;

  try {
    const adminClient = createAdminClient();

    const [{ data: pending, error: pendingError }, { data: recent, error: recentError }] = await Promise.all([
      adminClient
        .from("access_requests")
        .select("id,full_name,email,ahpra_registration,psy_number,relationship_note,reason,status,created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: true }),
      adminClient
        .from("access_requests")
        .select("id,full_name,email,ahpra_registration,psy_number,relationship_note,reason,status,created_at")
        .in("status", ["approved", "declined"])
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (pendingError || recentError) {
      loadError = pendingError?.message || recentError?.message || "Failed to load requests.";
    }

    pendingRequests = (pending as AccessRequest[] | null) || [];
    recentRequests = (recent as AccessRequest[] | null) || [];
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Admin client is not configured.";
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-8 md:px-8">
      <header className="rounded-2xl border bg-card p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Admin</p>
        <h1 className="mt-2 text-3xl">User management</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Signed in as {user?.email}. Approve requests here so people can access the member area.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/auth/login" className="rounded-md border px-3 py-2 text-sm">
            Member sign-in page
          </Link>
          <Link href="/dashboard" className="rounded-md border px-3 py-2 text-sm">
            Open member dashboard
          </Link>
          <form action={grantSelfAccess}>
            <button
              type="submit"
              className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
            >
              Grant my account member access
            </button>
          </form>
        </div>
      </header>

      {!process.env.SUPABASE_SERVICE_ROLE_KEY ? (
        <section className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-900">
          <p className="text-base font-semibold">One setup step needed</p>
          <p className="mt-2 text-sm">
            Add SUPABASE_SERVICE_ROLE_KEY to your .env.local, then restart the dev server. Without it, this page
            cannot approve users.
          </p>
        </section>
      ) : null}

      {loadError ? (
        <section className="mt-6 rounded-2xl border border-red-300 bg-red-50 p-5 text-red-900">
          <p className="font-semibold">Could not load access requests</p>
          <p className="mt-1 text-sm">{loadError}</p>
        </section>
      ) : null}

      <section className="mt-6 rounded-2xl border bg-card p-6">
        <h2 className="text-2xl">Pending requests</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Click Approve to instantly grant member access for that email.
        </p>

        {!pendingRequests.length ? (
          <p className="mt-4 text-sm text-muted-foreground">No pending requests right now.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {pendingRequests.map((request) => (
              <article key={request.id} className="rounded-xl border bg-background p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold">{request.full_name}</p>
                    <p className="text-sm text-muted-foreground">{request.email}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Submitted {new Date(request.created_at).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <form action={reviewRequest}>
                      <input type="hidden" name="request_id" value={request.id} />
                      <input type="hidden" name="decision" value="approve" />
                      <button
                        type="submit"
                        className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
                      >
                        Approve
                      </button>
                    </form>
                    <form action={reviewRequest}>
                      <input type="hidden" name="request_id" value={request.id} />
                      <input type="hidden" name="decision" value="decline" />
                      <button type="submit" className="rounded-md border px-3 py-2 text-sm">
                        Decline
                      </button>
                    </form>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                  <p>
                    <span className="font-semibold text-foreground">AHPRA:</span> {request.ahpra_registration || "-"}
                  </p>
                  <p>
                    <span className="font-semibold text-foreground">PSY number:</span> {request.psy_number || "-"}
                  </p>
                  <p className="md:col-span-2">
                    <span className="font-semibold text-foreground">Relationship:</span> {request.relationship_note || "-"}
                  </p>
                  <p className="md:col-span-2">
                    <span className="font-semibold text-foreground">Reason:</span> {request.reason || "-"}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border bg-card p-6">
        <h2 className="text-2xl">Recently reviewed</h2>
        {!recentRequests.length ? (
          <p className="mt-3 text-sm text-muted-foreground">No approvals or declines yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {recentRequests.map((request) => (
              <li key={request.id} className="rounded-lg border bg-background px-3 py-2">
                <span className="font-semibold">{request.full_name}</span> ({request.email}) - {request.status}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
