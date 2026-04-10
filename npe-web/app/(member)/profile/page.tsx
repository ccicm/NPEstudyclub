import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/admin-access";

async function updateDisplayName(formData: FormData) {
  "use server";

  const displayName = String(formData.get("display_name") || "").trim();
  if (!displayName) {
    return;
  }

  const supabase = await createClient();
  await supabase.auth.updateUser({
    data: {
      display_name: displayName,
    },
  });

  revalidatePath("/profile");
}

async function updateEmail(formData: FormData) {
  "use server";

  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email) {
    return;
  }

  const supabase = await createClient();
  await supabase.auth.updateUser({ email });

  revalidatePath("/profile");
}

async function updateAdminNote(formData: FormData) {
  "use server";

  const note = String(formData.get("admin_note") || "").trim();
  const { isAdmin } = await getAdminSession();

  if (!isAdmin) {
    return;
  }

  const supabase = await createClient();
  await supabase.auth.updateUser({
    data: {
      admin_note: note,
    },
  });

  revalidatePath("/profile");
}

export default async function ProfilePage() {
  const { user, isAdmin } = await getAdminSession();

  const supabase = await createClient();

  if (!user) {
    return null;
  }

  const displayName = String(user.user_metadata?.display_name || "").trim();
  const adminNote = String(user.user_metadata?.admin_note || "").trim();

  const { data: plan } = await supabase
    .from("study_plans")
    .select("exam_date")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="space-y-4">
      <h1 className="text-3xl">Profile</h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border bg-card p-6">
          <p className="text-lg font-semibold">{displayName || "Member"}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Member since {new Date(user.created_at ?? Date.now()).toLocaleDateString()}
          </p>

          <div className="mt-5 rounded-xl border bg-muted/30 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Study Plan</p>
            {plan?.exam_date ? (
              <p className="mt-2 text-sm">Exam date: {new Date(plan.exam_date).toLocaleDateString()}</p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No plan created yet. Start in Study Plan to personalise your schedule.</p>
            )}
            <Link href="/study-plan" className="mt-3 inline-block text-sm underline">
              View your plan
            </Link>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border bg-card p-4">
        <h2 className="text-2xl">Account settings</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <form action={updateDisplayName} className="space-y-2 rounded-xl border bg-background p-4">
            <p className="text-sm font-semibold">Display name</p>
            <input
              name="display_name"
              defaultValue={displayName}
              placeholder="Display name"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
            <button type="submit" className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
              Save display name
            </button>
          </form>

          <form action={updateEmail} className="space-y-2 rounded-xl border bg-background p-4">
            <p className="text-sm font-semibold">Email</p>
            <input
              name="email"
              type="email"
              defaultValue={user.email || ""}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
            <button type="submit" className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
              Update email
            </button>
            <p className="text-xs text-muted-foreground">Supabase will send a confirmation link to your new email before it changes.</p>
          </form>
        </div>

        <div className="mt-4">
          <Link href="/auth/update-password" className="text-sm underline">
            Change password
          </Link>
        </div>
      </section>

      {isAdmin ? (
        <section className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
          <div className="max-w-2xl">
            <h2 className="text-2xl">Admin controls</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This section is only visible to your configured admin account. Use it for internal notes or site-specific
              reminders while you are in the app.
            </p>

            <form action={updateAdminNote} className="mt-4 space-y-2 rounded-xl border bg-card p-4">
              <p className="text-sm font-semibold">Internal admin note</p>
              <textarea
                name="admin_note"
                defaultValue={adminNote}
                placeholder="Add an internal note for yourself"
                className="min-h-28 w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
              <button type="submit" className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
                Save admin note
              </button>
            </form>
          </div>
        </section>
      ) : null}

      <div className="rounded-2xl border bg-card p-4">
        <Link href="/resources" className="text-sm underline">Go to Resources to mark items complete</Link>
      </div>
    </div>
  );
}
