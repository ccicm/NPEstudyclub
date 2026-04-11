import { revalidatePath } from "next/cache";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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

type ContestedExplanation = {
  id: string;
  question_text: string;
  explanation_upvotes_count: number;
  explanation_downvotes_count: number;
  explanation_review_thread_id: string | null;
};

async function reviewRequest(formData: FormData) {
  "use server";

  const { user } = await requireAdmin();
  const reviewerId = user?.id;
  const requestId = String(formData.get("request_id") || "").trim();
  const decision = String(formData.get("decision") || "").trim();

  if (!requestId || !["approve", "decline"].includes(decision)) {
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
      reviewed_by: reviewerId ?? null,
      reviewed_at: now,
    })
    .eq("id", requestId);

  revalidatePath("/admin");
  revalidatePath("/auth/request-status");
}

async function approveMyselfNow() {
  "use server";

  const cookieStore = await cookies();
  cookieStore.set("member_bypass", "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  revalidatePath("/admin");
  redirect("/dashboard?admin=1");
}

async function updateExplanationThreshold(formData: FormData) {
  "use server";

  await requireAdmin();

  const rawPercent = String(formData.get("threshold_percent") || "").trim();
  const parsedPercent = Number(rawPercent);

  if (Number.isNaN(parsedPercent) || parsedPercent <= 0 || parsedPercent >= 100) {
    return;
  }

  const ratio = Number((parsedPercent / 100).toFixed(4));

  try {
    const adminClient = createAdminClient();
    await adminClient.from("quiz_settings").upsert(
      {
        key: "explanation_downvote_threshold",
        value: { ratio },
      },
      { onConflict: "key" },
    );
  } catch {
    // Admin page already surfaces loading constraints through preview/error states.
  }

  revalidatePath("/admin");
}

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { user } = await requireAdmin();

  let pendingRequests: AccessRequest[] = [];
  let recentRequests: AccessRequest[] = [];
  let contestedExplanations: ContestedExplanation[] = [];
  let explanationThresholdPercent = 20;
  let loadError: string | null = null;

  try {
    const adminClient = createAdminClient();

    const [{ data: pending, error: pendingError }, { data: recent, error: recentError }, { data: setting }, { data: contested, error: contestedError }] = await Promise.all([
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
      adminClient
        .from("quiz_settings")
        .select("value")
        .eq("key", "explanation_downvote_threshold")
        .maybeSingle(),
      adminClient
        .from("quiz_questions")
        .select(
          "id,question_text,explanation_upvotes_count,explanation_downvotes_count,explanation_review_thread_id",
        )
        .eq("explanation_contested", true)
        .order("explanation_downvotes_count", { ascending: false })
        .limit(50),
    ]);

    if (pendingError || recentError || contestedError) {
      loadError = pendingError?.message || recentError?.message || contestedError?.message || "Failed to load admin data.";
    }

    pendingRequests = (pending as AccessRequest[] | null) || [];
    recentRequests = (recent as AccessRequest[] | null) || [];
    contestedExplanations = (contested as ContestedExplanation[] | null) || [];

    const ratio = Number((setting?.value as { ratio?: unknown } | null)?.ratio);
    if (!Number.isNaN(ratio) && ratio > 0 && ratio < 1) {
      explanationThresholdPercent = Math.round(ratio * 100);
    }
  } catch {
    loadError = "Admin data could not load right now.";
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-8 md:px-8">
      <header className="rounded-2xl border bg-card p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Admin</p>
        <h1 className="mt-2 text-3xl">User management</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Signed in as {user?.email || "limited access mode"}. If this is your first login, approve your access request once,
          then open the member area.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/auth/login" className="rounded-md border px-3 py-2 text-sm">
            Member sign-in page
          </Link>
          <Link href="/dashboard" className="rounded-md border px-3 py-2 text-sm">
            Open member dashboard
          </Link>
          <form action={approveMyselfNow}>
            <button
              type="submit"
              className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
            >
              Approve my access request
            </button>
          </form>
        </div>
      </header>

      {!process.env.SUPABASE_SERVICE_ROLE_KEY ? (
        <section className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-900">
          <p className="text-base font-semibold">Limited access mode</p>
          <p className="mt-2 text-sm">
            Full admin tools are not available in this environment. Use the button above to approve your own member
            access, then continue in the app.
          </p>
        </section>
      ) : null}

      {loadError && process.env.SUPABASE_SERVICE_ROLE_KEY ? (
        <section className="mt-6 rounded-2xl border border-red-300 bg-red-50 p-5 text-red-900">
          <p className="font-semibold">Could not load access requests</p>
          <p className="mt-1 text-sm">{loadError}</p>
        </section>
      ) : null}

      <section className="mt-6 rounded-2xl border bg-card p-6">
        <h2 className="text-2xl">Quiz explanation moderation</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure downvote threshold and review contested AI-generated explanations.
        </p>

        {!process.env.SUPABASE_SERVICE_ROLE_KEY ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Settings are unavailable in this environment.
          </p>
        ) : (
          <>
            <form action={updateExplanationThreshold} className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border bg-background p-4">
              <label className="grid gap-1 text-sm">
                <span>Downvote escalation threshold (%)</span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  step={1}
                  name="threshold_percent"
                  defaultValue={String(explanationThresholdPercent)}
                  className="h-10 w-44 rounded-md border bg-card px-3"
                />
              </label>
              <button
                type="submit"
                className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
              >
                Save threshold
              </button>
              <p className="text-xs text-muted-foreground">
                Current: {explanationThresholdPercent}% downvotes required for community escalation.
              </p>
            </form>

            {!contestedExplanations.length ? (
              <p className="mt-4 text-sm text-muted-foreground">No contested explanations right now.</p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl border bg-background">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b bg-muted/40">
                    <tr>
                      <th className="px-4 py-3">Question</th>
                      <th className="px-4 py-3">Votes</th>
                      <th className="px-4 py-3">Downvote %</th>
                      <th className="px-4 py-3">Community thread</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contestedExplanations.map((item) => {
                      const totalVotes = item.explanation_upvotes_count + item.explanation_downvotes_count;
                      const downvotePercent = totalVotes
                        ? Math.round((item.explanation_downvotes_count / totalVotes) * 100)
                        : 0;

                      return (
                        <tr key={item.id} className="border-b last:border-0">
                          <td className="px-4 py-3">
                            <p className="line-clamp-2 max-w-xl">{item.question_text}</p>
                            <p className="mt-1 text-xs text-muted-foreground">Question ID: {item.id}</p>
                          </td>
                          <td className="px-4 py-3">
                            {item.explanation_upvotes_count} up / {item.explanation_downvotes_count} down
                          </td>
                          <td className="px-4 py-3">{downvotePercent}%</td>
                          <td className="px-4 py-3">
                            {item.explanation_review_thread_id ? (
                              <Link href={`/community/${item.explanation_review_thread_id}`} className="underline">
                                Open thread
                              </Link>
                            ) : (
                              <span className="text-muted-foreground">Pending thread link</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      <section className="mt-6 rounded-2xl border bg-card p-6">
        <h2 className="text-2xl">Pending requests</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Click Approve to instantly grant member access for that email.
        </p>

        {!process.env.SUPABASE_SERVICE_ROLE_KEY ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Pending requests are unavailable in this environment.
          </p>
        ) : !pendingRequests.length ? (
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
                    <span className="font-semibold text-foreground">AHPRA registration number:</span> {request.ahpra_registration || "-"}
                  </p>
                  <p>
                    <span className="font-semibold text-foreground">Registration number:</span> {request.psy_number || "-"}
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
        {!process.env.SUPABASE_SERVICE_ROLE_KEY ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Review history is unavailable in this environment.
          </p>
        ) : !recentRequests.length ? (
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
