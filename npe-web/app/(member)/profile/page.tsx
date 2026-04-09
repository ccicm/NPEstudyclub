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

  const { count: completedCount } = await supabase
    .from("user_progress")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { count: totalCount } = await supabase
    .from("resources")
    .select("id", { count: "exact", head: true });

  const { data: recentCompletions } = await supabase
    .from("user_progress")
    .select("completed_at,resources(title)")
    .eq("user_id", user.id)
    .order("completed_at", { ascending: false })
    .limit(3);

  const { data: plan } = await supabase
    .from("study_plans")
    .select("exam_date")
    .eq("user_id", user.id)
    .maybeSingle();

  const [{ count: threadsStarted }, { count: repliesCount }] = await Promise.all([
    supabase.from("forum_threads").select("id", { count: "exact", head: true }).eq("created_by", user.id),
    supabase.from("forum_replies").select("id", { count: "exact", head: true }).eq("created_by", user.id),
  ]);

  const { data: quizResultsRaw, error: quizError } = await supabase
    .from("quiz_results")
    .select("score, total_questions, completed_at, quizzes(domain)")
    .eq("user_id", user.id);

  type QuizResultWithDomain = {
    score: number;
    total_questions: number;
    completed_at: string;
    quizzes: { domain?: string } | { domain?: string }[] | null;
  };
  const quizResults = (quizResultsRaw ?? []) as QuizResultWithDomain[];

  const done = completedCount || 0;
  const total = totalCount || 0;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const quizAttempts = quizError ? [] : quizResults;
  const quizCount = quizAttempts.length;

  const domainStats = quizAttempts.reduce((acc, result) => {
    const quizRelation = Array.isArray(result.quizzes) ? result.quizzes[0] : result.quizzes;
    const domain = quizRelation?.domain || "Other";
    if (!acc[domain]) {
      acc[domain] = [];
    }
    acc[domain].push(result);
    return acc;
  }, {} as Record<string, typeof quizAttempts>);

  const domainPerformance = Object.entries(domainStats)
    .map(([domain, results]) => ({
      domain,
      avg: Math.round(
        results.reduce((sum, result) => sum + (result.total_questions > 0 ? (result.score / result.total_questions) * 100 : 0), 0) /
          results.length,
      ),
      count: results.length,
    }))
    .sort((a, b) => a.avg - b.avg);

  const avgQuizPercent = quizCount
    ? Math.round(
        quizAttempts.reduce((sum, result) => {
          const scorePercent = result.total_questions > 0 ? (result.score / result.total_questions) * 100 : 0;
          return sum + scorePercent;
        }, 0) / quizCount,
      )
    : 0;

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

        <section className="rounded-2xl border bg-card p-6">
          <h2 className="text-2xl">Resource progress</h2>
          <p className="mt-2 text-sm">
            {done} of {total} resources completed
          </p>
          <div className="mt-2 h-2 w-full rounded bg-muted">
            <div className="h-2 rounded bg-primary" style={{ width: `${percent}%` }} />
          </div>

          <div className="mt-4">
            <p className="text-sm font-semibold">Recent completions</p>
            {!recentCompletions?.length ? (
              <p className="mt-1 text-sm text-muted-foreground">Open resources from the library to track your progress.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {recentCompletions.map((entry, index) => (
                  <li key={index}>• {(entry.resources as { title?: string } | null)?.title || "Resource"}</li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-6 lg:col-span-2">
          <h2 className="text-2xl">Quiz performance</h2>
          {quizError ? (
            <p className="mt-2 text-sm text-muted-foreground">Quiz statistics will appear after the quiz module is enabled.</p>
          ) : (
            <p className="mt-2 text-sm">
              {quizCount} quizzes taken · Average score: {avgQuizPercent}%
            </p>
          )}

          {domainPerformance.length > 0 ? (
            <div className="mt-4">
              <p className="mb-3 text-sm font-semibold">By domain:</p>
              <div className="grid gap-2 lg:grid-cols-2">
                {domainPerformance.map((domain) => {
                  const getColor = (score: number) => {
                    if (score >= 70) return "bg-green-100 text-green-700";
                    if (score >= 50) return "bg-amber-100 text-amber-700";
                    return "bg-red-100 text-red-700";
                  };

                  return (
                    <div key={domain.domain} className={`rounded-lg px-3 py-2 text-sm font-semibold ${getColor(domain.avg)}`}>
                      {domain.domain} - {domain.avg}% ({domain.count})
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {!quizCount && !quizError ? (
            <p className="mt-2 text-sm text-muted-foreground">Take a quiz to see your performance by domain.</p>
          ) : null}
          <Link href="/quizzes" className="mt-3 inline-block text-sm underline">
            Browse quizzes
          </Link>
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

      <section className="rounded-2xl border bg-card p-4">
        <h2 className="text-2xl">My Community Activity</h2>
        <p className="mt-2 text-sm">
          Threads I started: {threadsStarted || 0}
        </p>
        <p className="mt-1 text-sm">
          Threads I replied to: {repliesCount || 0}
        </p>
        {!(threadsStarted || 0) && !(repliesCount || 0) ? (
          <p className="mt-2 text-sm text-muted-foreground">You have not posted yet - join a thread in Community.</p>
        ) : null}
        <Link href="/community?author=me" className="mt-3 inline-block text-sm underline">
          View my posts
        </Link>
      </section>

      <div className="rounded-2xl border bg-card p-4">
        <Link href="/resources" className="text-sm underline">Go to Resources to mark items complete</Link>
      </div>
    </div>
  );
}
