import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

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

  const averagedDomains = Array.from(domainStats.entries()).map(([domain, values]) => ({
    domain,
    average: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
  }));

  const strongest = averagedDomains.sort((a, b) => b.average - a.average)[0]?.domain || "-";
  const weakest = averagedDomains.sort((a, b) => a.average - b.average)[0]?.domain || "-";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Quiz History</h1>
        <Link href="/quizzes" className="text-sm underline">
          Back to quizzes
        </Link>
      </div>

      <div className="rounded-2xl border bg-card p-5 text-sm">
        <p>Total quizzes taken: {totalTaken}</p>
        <p>Average score: {averageScore}%</p>
        <p>Strongest domain: {strongest}</p>
        <p>Needs work: {weakest}</p>
      </div>

      {!rows.length ? (
        <p className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">No quiz attempts yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-3">Quiz</th>
                <th className="px-4 py-3">Domain</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Retake</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="px-4 py-3">{row.title}</td>
                  <td className="px-4 py-3">{row.domain}</td>
                  <td className="px-4 py-3">{new Date(row.completed_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    {row.score}/{row.total_questions} ({row.percent}%)
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/quizzes/${row.quiz_id}`} className="underline">
                      Retake
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
