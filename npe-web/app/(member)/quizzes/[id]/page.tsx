import { notFound } from "next/navigation";
import { QuizRunner } from "@/components/member/quiz-runner";
import { createClient } from "@/lib/supabase/server";

type Citation = {
  source: string;
  clause?: string | null;
  external_url?: string | null;
  resource_id?: string | null;
};

function normalizeCitations(value: unknown): Citation[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const citations: Citation[] = [];

  for (const item of value) {
    if (typeof item === "string") {
      citations.push({ source: item });
      continue;
    }

    if (item && typeof item === "object" && typeof (item as { source?: unknown }).source === "string") {
      const citation = item as {
        source: string;
        clause?: unknown;
        external_url?: unknown;
        resource_id?: unknown;
      };

      citations.push({
        source: citation.source,
        clause: typeof citation.clause === "string" ? citation.clause : null,
        external_url: typeof citation.external_url === "string" ? citation.external_url : null,
        resource_id: typeof citation.resource_id === "string" ? citation.resource_id : null,
      });
    }
  }

  return citations;
}

export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  type QuizQuestionRow = {
    id: string;
    question_text: string;
    options: unknown;
    correct_index: number;
    explanation: string | null;
    display_order: number;
    domain_number?: number | null;
    domain_label?: string | null;
    subdomain?: string | null;
    citations?: unknown;
    distractor_explanations?: unknown; // DB column name (mapped to wrong_answer_rationales for the runner)
    difficulty_seed?: string | null;
  };

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id,title,domain,description,delivery_mode,published_at")
    .eq("id", id)
    .maybeSingle();

  if (!quiz) {
    notFound();
  }

  let questionsData: QuizQuestionRow[] = [];

  const withOptionalFields = await supabase
    .from("quiz_questions")
    .select("id,question_text,options,correct_index,explanation,display_order,domain_number,domain_label,subdomain,citations,distractor_explanations,difficulty_seed")
    .eq("quiz_id", id)
    .order("display_order", { ascending: true });

  if (withOptionalFields.error) {
    const fallback = await supabase
      .from("quiz_questions")
      .select("id,question_text,options,correct_index,explanation,display_order")
      .eq("quiz_id", id)
      .order("display_order", { ascending: true });

    questionsData = (fallback.data as QuizQuestionRow[] | null) ?? [];
  } else {
    questionsData = (withOptionalFields.data as QuizQuestionRow[] | null) ?? [];
  }

  // Load any saved in-progress state for this user+quiz.
  let savedProgress: { answers: Record<string, number>; currentPage: number } | null = null;
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: progress } = await supabase
      .from("quiz_progress")
      .select("answers,current_page")
      .eq("user_id", user.id)
      .eq("quiz_id", id)
      .maybeSingle();
    if (progress && progress.answers && typeof progress.answers === "object") {
      savedProgress = {
        answers: progress.answers as Record<string, number>,
        currentPage: Number(progress.current_page ?? 0),
      };
    }
  }

  const preparedQuestions = questionsData.map((question) => ({
    id: question.id,
    question_text: question.question_text,
    options: Array.isArray(question.options)
      ? (question.options as Array<{ label: string; text: string }>).filter(
          (option) => option && typeof option.label === "string" && typeof option.text === "string",
        )
      : [],
    correct_index: question.correct_index,
    explanation: question.explanation,
    domain_number: question.domain_number ?? null,
    domain_label: question.domain_label ?? null,
    subdomain: question.subdomain ?? null,
    citations: normalizeCitations(question.citations),
    wrong_answer_rationales:
      question.distractor_explanations && typeof question.distractor_explanations === "object"
        ? (question.distractor_explanations as Record<string, string>)
        : null,
    difficulty_seed: typeof question.difficulty_seed === "string" ? question.difficulty_seed : null,
  }));

  return (
    <QuizRunner
      quiz={quiz}
      questions={preparedQuestions}
      savedProgress={savedProgress}
    />
  );
}
