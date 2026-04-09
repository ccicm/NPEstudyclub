"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type DraftQuestion = {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c?: string;
  option_d?: string;
  option_e?: string;
  correct_label: "A" | "B" | "C" | "D" | "E";
  explanation?: string;
};

function classifyError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("row-level security") || lower.includes("permission denied")) return "not_authorized";
  if (lower.includes("does not exist") || lower.includes("undefined table") || lower.includes("undefined column")) {
    return "schema_not_ready";
  }
  return null;
}

export async function saveQuizResultAction(input: {
  quizId: string;
  score: number;
  totalQuestions: number;
  answers: Array<{ question_id: string; selected: number; correct: number }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  await supabase.from("quiz_results").insert({
    user_id: user.id,
    quiz_id: input.quizId,
    score: input.score,
    total_questions: input.totalQuestions,
    answers: input.answers,
  });

  revalidatePath("/quizzes");
  revalidatePath("/quizzes/results");
  revalidatePath("/profile");
}

export async function voteExplanationAction(input: {
  questionId: string;
  vote: "up" | "down";
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, error: "not_authenticated" as const };
  }

  if (!input.questionId || !["up", "down"].includes(input.vote)) {
    return { ok: false as const, error: "invalid_input" as const };
  }

  const { error } = await supabase.from("explanation_feedback").upsert(
    {
      user_id: user.id,
      question_id: input.questionId,
      vote: input.vote,
    },
    { onConflict: "user_id,question_id" },
  );

  if (error) {
    const classified = classifyError(error.message || "");
    if (classified) {
      return { ok: false as const, error: classified };
    }
    return { ok: false as const, error: "save_vote" as const };
  }

  revalidatePath("/quizzes");
  revalidatePath("/quizzes/results");

  return { ok: true as const };
}

export async function createQuizAction(formData: FormData) {
  const title = String(formData.get("title") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const domain = String(formData.get("domain") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const questionsRaw = String(formData.get("questions") || "").trim();

  if (!title || !category || !domain || !questionsRaw) {
    redirect("/quizzes/add?error=missing_required");
  }

  let questions: DraftQuestion[] = [];

  try {
    questions = JSON.parse(questionsRaw) as DraftQuestion[];
  } catch {
    redirect("/quizzes/add?error=invalid_payload");
  }

  if (questions.length < 4) {
    redirect("/quizzes/add?error=min_questions");
  }

  const normalized = questions.map((question, index) => {
    const optionEntries = [
      { label: "A", text: String(question.option_a || "").trim() },
      { label: "B", text: String(question.option_b || "").trim() },
      { label: "C", text: String(question.option_c || "").trim() },
      { label: "D", text: String(question.option_d || "").trim() },
      { label: "E", text: String(question.option_e || "").trim() },
    ];

    const correctIndex = optionEntries.findIndex((entry) => entry.label === question.correct_label);

    if (
      !question.question_text?.trim() ||
      !question.option_a?.trim() ||
      !question.option_b?.trim() ||
      !question.option_c?.trim() ||
      !question.option_d?.trim() ||
      !question.option_e?.trim() ||
      correctIndex < 0
    ) {
      redirect("/quizzes/add?error=invalid_question");
    }

    return {
      question_text: question.question_text.trim(),
      options: optionEntries,
      correct_index: correctIndex,
      explanation: question.explanation?.trim() || null,
      display_order: index + 1,
    };
  });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: quiz, error: quizError } = await supabase
    .from("quizzes")
    .insert({
      title,
      category,
      domain,
      description: description || null,
      created_by: user.id,
      author_name: user.user_metadata?.full_name || user.email,
      is_curated: false,
    })
    .select("id")
    .single();

  if (quizError || !quiz) {
    const classified = classifyError(quizError?.message || "");
    if (classified) {
      redirect(`/quizzes/add?error=${classified}`);
    }
    redirect("/quizzes/add?error=save_quiz");
  }

  const { error: questionsError } = await supabase.from("quiz_questions").insert(
    normalized.map((question) => ({
      quiz_id: quiz.id,
      ...question,
    })),
  );

  if (questionsError) {
    const classified = classifyError(questionsError.message || "");
    if (classified) {
      redirect(`/quizzes/add?error=${classified}`);
    }
    redirect("/quizzes/add?error=save_questions");
  }

  revalidatePath("/quizzes");
  revalidatePath("/quizzes/add");
  redirect("/quizzes?created=1");
}
