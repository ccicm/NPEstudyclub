import { notFound } from "next/navigation";
import { QuizRunner } from "@/components/member/quiz-runner";
import { createClient } from "@/lib/supabase/server";

export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id,title,domain,description")
    .eq("id", id)
    .maybeSingle();

  if (!quiz) {
    notFound();
  }

  const { data: questions } = await supabase
    .from("quiz_questions")
    .select("id,question_text,options,correct_index,explanation,display_order")
    .eq("quiz_id", id)
    .order("display_order", { ascending: true });

  const preparedQuestions = (questions ?? []).map((question) => ({
    id: question.id,
    question_text: question.question_text,
    options: Array.isArray(question.options)
      ? (question.options as Array<{ label: string; text: string }>).filter(
          (option) => option && typeof option.label === "string" && typeof option.text === "string",
        )
      : [],
    correct_index: question.correct_index,
    explanation: question.explanation,
  }));

  return <QuizRunner quiz={quiz} questions={preparedQuestions} />;
}
