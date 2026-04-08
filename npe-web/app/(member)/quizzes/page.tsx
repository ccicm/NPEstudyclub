import { QuizzesBrowser } from "@/components/member/quizzes-browser";
import { createClient } from "@/lib/supabase/server";

export default async function QuizzesPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: quizzes } = await supabase
    .from("quizzes")
    .select("id,title,category,domain,author_name,is_curated,created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const quizIds = (quizzes ?? []).map((quiz) => quiz.id);

  const [questionsResult, resultsResult] = await Promise.all([
    quizIds.length
      ? supabase.from("quiz_questions").select("id,quiz_id").in("quiz_id", quizIds)
      : Promise.resolve({ data: [] as Array<{ id: string; quiz_id: string }> }),
    user && quizIds.length
      ? supabase
          .from("quiz_results")
          .select("quiz_id,score,total_questions")
          .eq("user_id", user.id)
          .in("quiz_id", quizIds)
      : Promise.resolve({ data: [] as Array<{ quiz_id: string; score: number; total_questions: number }> }),
  ]);

  const questionCountMap = new Map<string, number>();
  (questionsResult.data ?? []).forEach((question) => {
    questionCountMap.set(question.quiz_id, (questionCountMap.get(question.quiz_id) ?? 0) + 1);
  });

  const resultsByQuiz = new Map<string, number[]>();
  (resultsResult.data ?? []).forEach((result) => {
    const percentage = result.total_questions > 0 ? Math.round((result.score / result.total_questions) * 100) : 0;
    const current = resultsByQuiz.get(result.quiz_id) ?? [];
    current.push(percentage);
    resultsByQuiz.set(result.quiz_id, current);
  });

  const preparedQuizzes = (quizzes ?? []).map((quiz) => {
    const attempts = resultsByQuiz.get(quiz.id) ?? [];
    const average = attempts.length
      ? Math.round(attempts.reduce((sum, value) => sum + value, 0) / attempts.length)
      : null;

    return {
      ...quiz,
      question_count: questionCountMap.get(quiz.id) ?? 0,
      average_score: average,
    };
  });

  return <QuizzesBrowser quizzes={preparedQuizzes} created={params.created === "1"} />;
}
