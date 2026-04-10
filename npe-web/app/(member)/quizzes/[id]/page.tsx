import { notFound } from "next/navigation";
import { QuizRunner } from "@/components/member/quiz-runner";
import { getDailyQuizAvailabilityMessage, isDailyQuizLive } from "@/lib/quiz-availability";
import { createClient } from "@/lib/supabase/server";

export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id,title,domain,description,delivery_mode,published_at")
    .eq("id", id)
    .maybeSingle();

  if (!quiz) {
    notFound();
  }

  if (quiz.delivery_mode === "daily" && !isDailyQuizLive()) {
    return (
      <div className="rounded-2xl border bg-card p-6">
        <h1 className="text-3xl">{quiz.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{quiz.domain || "General"}</p>
        <p className="mt-4 text-sm text-muted-foreground">
          {getDailyQuizAvailabilityMessage() || "Daily quizzes are temporarily unavailable."}
        </p>
      </div>
    );
  }

  let questionsData: Array<{
    id: string;
    question_text: string;
    options: unknown;
    correct_index: number;
    explanation: string | null;
    display_order: number;
    citations?: unknown;
    wrong_answer_rationales?: unknown;
  }> | null = null;

  const withOptionalFields = await supabase
    .from("quiz_questions")
    .select("id,question_text,options,correct_index,explanation,display_order,citations,wrong_answer_rationales")
    .eq("quiz_id", id)
    .order("display_order", { ascending: true });

  if (withOptionalFields.error) {
    const fallback = await supabase
      .from("quiz_questions")
      .select("id,question_text,options,correct_index,explanation,display_order")
      .eq("quiz_id", id)
      .order("display_order", { ascending: true });

    questionsData = (fallback.data as typeof questionsData) ?? [];
  } else {
    questionsData = (withOptionalFields.data as typeof questionsData) ?? [];
  }

  const preparedQuestions = (questionsData ?? []).map((question) => ({
    id: question.id,
    question_text: question.question_text,
    options: Array.isArray(question.options)
      ? (question.options as Array<{ label: string; text: string }>).filter(
          (option) => option && typeof option.label === "string" && typeof option.text === "string",
        )
      : [],
    correct_index: question.correct_index,
    explanation: question.explanation,
    citations: Array.isArray(question.citations)
      ? (question.citations as Array<{
          source: string;
          clause?: string | null;
          external_url?: string | null;
          resource_id?: string | null;
        }>).filter((citation) => citation && typeof citation.source === "string")
      : [],
    wrong_answer_rationales:
      question.wrong_answer_rationales && typeof question.wrong_answer_rationales === "object"
        ? (question.wrong_answer_rationales as Record<string, string>)
        : null,
  }));

  return <QuizRunner quiz={quiz} questions={preparedQuestions} />;
}
