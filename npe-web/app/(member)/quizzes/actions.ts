"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { domainId } from "@/lib/npe-taxonomy";

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

function normalizeDomainKey(domain: string | null | undefined) {
  return String(domain || "").trim().toLowerCase();
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

  const optionLabels = ["A", "B", "C", "D", "E"] as const;
  const responseRows = input.answers
    .map((answer) => ({
      user_id: user.id,
      quiz_id: input.quizId,
      question_id: answer.question_id,
      selected_answer: optionLabels[answer.selected],
      set_id: input.quizId,
    }))
    .filter((row) => Boolean(row.selected_answer));

  if (responseRows.length > 0) {
    await supabase.from("user_responses").insert(responseRows);
  }

  // Keep study-plan suggestions responsive to the latest quiz data.
  const { data: performanceRows } = await supabase
    .from("user_performance")
    .select("domain_label,attempts,correct_responses")
    .eq("user_id", user.id);

  if (performanceRows?.length) {
    const totals = new Map<string, { label: string; attempts: number; correct: number }>();

    performanceRows.forEach((row) => {
      const key = normalizeDomainKey(row.domain_label);
      if (!key) {
        return;
      }

      const current = totals.get(key) ?? {
        label: String(row.domain_label || "General"),
        attempts: 0,
        correct: 0,
      };
      current.attempts += Number(row.attempts || 0);
      current.correct += Number(row.correct_responses || 0);
      totals.set(key, current);
    });

    const weakest = Array.from(totals.values())
      .filter((item) => item.attempts > 0)
      .map((item) => ({ ...item, accuracy: item.correct / item.attempts }))
      .sort((left, right) => left.accuracy - right.accuracy)[0];

    if (weakest) {
      const { data: plan } = await supabase
        .from("study_plans")
        .select("id,domain_priorities")
        .eq("user_id", user.id)
        .maybeSingle();

      if (plan?.id) {
        const priorities = (plan.domain_priorities as Record<string, number> | null) ?? {};
        const adjusted = { ...priorities };

        Object.entries(adjusted).forEach(([domain, priority]) => {
          if (normalizeDomainKey(domain) === normalizeDomainKey(weakest.label)) {
            adjusted[domain] = Math.min(3, Math.max(1, Number(priority || 1) + 1));
          }
        });

        await supabase
          .from("study_plans")
          .update({ domain_priorities: adjusted, updated_at: new Date().toISOString() })
          .eq("id", plan.id);

        const [{ data: resources }, { data: quizzes }, { data: nextWeek }] = await Promise.all([
          supabase.from("resources").select("id,domain"),
          supabase.from("quizzes").select("id,domain"),
          supabase
            .from("study_plan_weeks")
            .select("id")
            .eq("plan_id", plan.id)
            .in("status", ["upcoming", "in_progress"])
            .order("week_number", { ascending: true })
            .limit(1)
            .maybeSingle(),
        ]);

        if (nextWeek?.id) {
          const resourceMatch = (resources || []).find(
            (resource) => normalizeDomainKey(resource.domain) === normalizeDomainKey(weakest.label),
          );
          const quizMatch = (quizzes || []).find(
            (quiz) => normalizeDomainKey(quiz.domain) === normalizeDomainKey(weakest.label),
          );

          await supabase
            .from("study_plan_weeks")
            .update({
              domain_focus: weakest.label,
              suggested_resource_id: resourceMatch?.id || null,
              suggested_quiz_id: quizMatch?.id || null,
            })
            .eq("id", nextWeek.id);
        }
      }
    }
  }

  revalidatePath("/quizzes");
  revalidatePath("/quizzes/results");
  revalidatePath("/profile");
  revalidatePath("/study-plan");
}

export async function submitQuizOverallFeedbackAction(input: {
  quizId: string;
  difficultyScore: number;
  varietyScore: number;
  clarityScore: number;
  relevanceScore: number;
  comment?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, error: "not_authenticated" as const };
  }

  const scores = [input.difficultyScore, input.varietyScore, input.clarityScore, input.relevanceScore];
  if (!input.quizId || scores.some((score) => !Number.isInteger(score) || score < 1 || score > 5)) {
    return { ok: false as const, error: "invalid_input" as const };
  }

  const { error } = await supabase.from("quiz_overall_feedback").upsert(
    {
      quiz_id: input.quizId,
      user_id: user.id,
      difficulty_score: input.difficultyScore,
      variety_score: input.varietyScore,
      clarity_score: input.clarityScore,
      relevance_score: input.relevanceScore,
      comment: (input.comment || "").trim() || null,
    },
    { onConflict: "quiz_id,user_id" },
  );

  if (error) {
    const classified = classifyError(error.message || "");
    if (classified) {
      return { ok: false as const, error: classified };
    }
    return { ok: false as const, error: "save_feedback" as const };
  }

  revalidatePath("/quizzes/results");
  revalidatePath("/profile");

  return { ok: true as const };
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

export async function flagQuestionForReviewAction(input: {
  questionId: string;
  reason?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, error: "not_authenticated" as const };
  }

  if (!input.questionId) {
    return { ok: false as const, error: "invalid_input" as const };
  }

  const reason = (input.reason || "").trim();

  const { error } = await supabase.from("question_flags").upsert(
    {
      user_id: user.id,
      question_id: input.questionId,
      reason: reason || null,
    },
    { onConflict: "user_id,question_id" },
  );

  if (error) {
    const classified = classifyError(error.message || "");
    if (classified) {
      return { ok: false as const, error: classified };
    }
    return { ok: false as const, error: "save_flag" as const };
  }

  // Create contextual discussion thread immediately when member flags for review.
  const { data: questionRow } = await supabase
    .from("quiz_questions")
    .select("id,quiz_id,question_text,domain_label,subdomain,correct_answer,review_thread_id")
    .eq("id", input.questionId)
    .maybeSingle();

  let threadId = questionRow?.review_thread_id || null;

  if (!threadId && questionRow?.id) {
    const { data: existingReview } = await supabase
      .from("question_reviews")
      .select("thread_id")
      .eq("question_id", questionRow.id)
      .maybeSingle();

    threadId = existingReview?.thread_id || null;
  }

  if (!threadId && questionRow?.id) {
    const { data: quizRow } = await supabase
      .from("quizzes")
      .select("title")
      .eq("id", questionRow.quiz_id)
      .maybeSingle();

    const domainLabel = questionRow.domain_label || "General";
    const subdomain = questionRow.subdomain || "General";
    const canonicalTag = domainId(domainLabel) ?? "quiz-review";

    const threadTitle = `Peer review: ${domainLabel} - ${subdomain}`;
    const threadBody = [
      `**Community review requested - ${domainLabel}: ${subdomain}**`,
      "",
      `Quiz: ${quizRow?.title || "Quiz"}`,
      `Domain: ${domainLabel} · Study area: ${subdomain}`,
      "",
      "Question:",
      questionRow.question_text || "(missing question text)",
      "",
      `Correct answer (per AI): ${questionRow.correct_answer || "?"}`,
      "",
      "A member flagged this for discussion. Please review the answer quality and cite sources where possible.",
    ].join("\n");

    const { data: thread, error: threadError } = await supabase
      .from("forum_threads")
      .insert({
        title: threadTitle,
        body: threadBody,
        tag: canonicalTag,
        channel: "general",
        created_by: user.id,
        author_name: user.user_metadata?.full_name || user.email || "Member",
        quiz_id: questionRow.quiz_id,
        publish_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (!threadError && thread?.id) {
      threadId = thread.id;

      await supabase.from("question_reviews").upsert(
        {
          question_id: questionRow.id,
          quiz_id: questionRow.quiz_id,
          publish_at: new Date().toISOString(),
          threshold_ratio: 0,
          thread_id: thread.id,
        },
        { onConflict: "question_id" },
      );

      await supabase
        .from("quiz_questions")
        .update({ review_thread_id: thread.id })
        .eq("id", questionRow.id);
    }
  }

  revalidatePath("/quizzes");
  revalidatePath("/quizzes/results");
  revalidatePath("/community");

  return { ok: true as const, threadId };
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

// ---------------------------------------------------------------------------
// Quiz progress — pause / save / resume
// ---------------------------------------------------------------------------

export async function saveQuizProgressAction(input: {
  quizId: string;
  answers: Record<string, number>; // question_id → selected option index
  currentPage: number;
}) {
  if (!input.quizId) return { ok: false as const, error: "invalid_input" as const };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false as const, error: "not_authenticated" as const };

  const { error } = await supabase.from("quiz_progress").upsert(
    {
      user_id: user.id,
      quiz_id: input.quizId,
      answers: input.answers,
      current_page: input.currentPage,
      saved_at: new Date().toISOString(),
    },
    { onConflict: "user_id,quiz_id" },
  );

  if (error) return { ok: false as const, error: "save_failed" as const };
  return { ok: true as const };
}

export async function clearQuizProgressAction(input: { quizId: string }) {
  if (!input.quizId) return { ok: false as const, error: "invalid_input" as const };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false as const, error: "not_authenticated" as const };

  await supabase
    .from("quiz_progress")
    .delete()
    .eq("user_id", user.id)
    .eq("quiz_id", input.quizId);

  return { ok: true as const };
}
