import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { domainColour } from "@/lib/npe-taxonomy";

export default async function QuizResultsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: results } = await supabase
    .from("quiz_results")
    .select("id,quiz_id,score,total_questions,completed_at")
    .eq("user_id", user.id)
    .order("completed_at", { ascending: false })
    .limit(200);

  const quizIds = (results ?? []).map((result) => result.quiz_id);

  const { data: quizzes } = quizIds.length
    ? await supabase.from("quizzes").select("id,title,domain").in("id", quizIds)
    : { data: [] as Array<{ id: string; title: string; domain: string | null }> };

  const quizMap = new Map((quizzes ?? []).map((quiz) => [quiz.id, quiz]));

  const rows = (results ?? []).map((result) => {
    const quiz = quizMap.get(result.quiz_id);
    const percent = result.total_questions > 0 ? Math.round((result.score / result.total_questions) * 100) : 0;
    return {
      ...result,
      title: quiz?.title || "Quiz",
      domain: quiz?.domain || "General",
      percent,
    };
  });

  const totalTaken = rows.length;
  const averageScore = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.percent, 0) / rows.length) : 0;

  const domainStats = new Map<string, number[]>();
  rows.forEach((row) => {
    const current = domainStats.get(row.domain) ?? [];
    current.push(row.percent);
    domainStats.set(row.domain, current);
  });

  const averagedDomains = Array.from(domainStats.entries())
    .map(([domain, values]) => ({
      domain,
      average: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
    }))
    .sort((a, b) => b.average - a.average);

  const strongest = averagedDomains[0];
  const weakest = averagedDomains[averagedDomains.length - 1];

  function scoreColour(pct: number) {
    if (pct >= 70) return "text-emerald-600";
    if (pct >= 50) return "text-amber-600";
    return "text-red-500";
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Quiz History</h1>
        <Link href="/quizzes" className="text-sm underline">
          Back to quizzes
        </Link>
      </div>

      {/* ── Stat cards ── */}
      {totalTaken > 0 ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-2xl border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Taken</p>
            <p className="mt-1 text-2xl font-bold">{totalTaken}</p>
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Avg score</p>
            <p className={`mt-1 text-2xl font-bold ${scoreColour(averageScore)}`}>{averageScore}%</p>
          </div>
          {strongest ? (
            <div className="rounded-2xl border bg-card p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Strongest</p>
              {(() => {
                const dc = domainColour(strongest.domain);
                return (
                  <span className={`mt-2 inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${dc.bg} ${dc.text} ${dc.border}`}>
                    {strongest.domain}
                  </span>
                );
              })()}
              <p className={`mt-1 text-lg font-semibold ${scoreColour(strongest.average)}`}>{strongest.average}%</p>
            </div>
          ) : null}
          {weakest && weakest.domain !== strongest?.domain ? (
            <div className="rounded-2xl border bg-card p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Focus area</p>
              {(() => {
                const dc = domainColour(weakest.domain);
                return (
                  <span className={`mt-2 inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${dc.bg} ${dc.text} ${dc.border}`}>
                    {weakest.domain}
                  </span>
                );
              })()}
              <p className={`mt-1 text-lg font-semibold ${scoreColour(weakest.average)}`}>{weakest.average}%</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ── Table ── */}
      {!rows.length ? (
        <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
          <p>No quiz attempts yet.</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Link href="/quizzes" className="underline">Browse quizzes</Link>
            <Link href="/quizzes/add" className="underline">Add a quiz</Link>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-3 font-medium">Quiz</th>
                <th className="px-4 py-3 font-medium">Domain</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const dc = domainColour(row.domain);
                return (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/quizzes/${row.quiz_id}`} className="font-medium hover:underline">
                        {row.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${dc.bg} ${dc.text} ${dc.border}`}>
                        {row.domain}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(row.completed_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className={`px-4 py-3 font-semibold ${scoreColour(row.percent)}`}>
                      {row.percent}%
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        ({row.score}/{row.total_questions})
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
