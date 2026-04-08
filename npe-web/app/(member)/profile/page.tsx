import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

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

  const { data: quizResults, error: quizError } = await supabase
    .from("quiz_results")
    .select("score,total_questions,completed_at")
    .eq("user_id", user.id);

  const done = completedCount || 0;
  const total = totalCount || 0;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const quizAttempts = quizError ? [] : quizResults ?? [];
  const quizCount = quizAttempts.length;
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
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Member since {new Date(user.created_at ?? Date.now()).toLocaleDateString()}
          </p>

          <div className="mt-5 rounded-xl border bg-muted/30 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Study Plan</p>
            {plan?.exam_date ? (
              <p className="mt-2 text-sm">Exam date: {new Date(plan.exam_date).toLocaleDateString()}</p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No plan created yet.</p>
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
              <p className="mt-1 text-sm text-muted-foreground">No completions yet.</p>
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
          <Link href="/quizzes" className="mt-3 inline-block text-sm underline">
            Browse quizzes
          </Link>
        </section>
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <Link href="/resources" className="text-sm underline">
          Go to Resources to mark items complete
        </Link>
      </div>
    </div>
  );
}
