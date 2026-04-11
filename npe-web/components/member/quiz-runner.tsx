"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Bot } from "lucide-react";
import {
  clearQuizProgressAction,
  flagQuestionForReviewAction,
  saveQuizProgressAction,
  saveQuizResultAction,
  submitQuizOverallFeedbackAction,
  voteExplanationAction,
} from "@/app/(member)/quizzes/actions";
import { domainColour } from "@/lib/npe-taxonomy";

type QuizQuestion = {
  id: string;
  question_text: string;
  options: Array<{ label: string; text: string }>;
  correct_index: number;
  explanation: string | null;
  domain_number?: number | null;
  domain_label?: string | null;
  subdomain?: string | null;
  citations?: Array<{
    source: string;
    clause?: string | null;
    external_url?: string | null;
    resource_id?: string | null;
  }> | null;
  wrong_answer_rationales?: Record<string, string> | null;
  difficulty_seed?: string | null;
};

type Stage = "intro" | "question" | "results";

type AnswerRecord = {
  question_id: string;
  selected: number;
  correct: number;
};

type FeedbackVote = "up" | "down";

type ReviewPair = {
  question: QuizQuestion;
  answer: AnswerRecord;
};


const PAGE_SIZE = 5;

function getTimeEstimate(deliveryMode: string | null | undefined, questionCount: number): string {
  if (deliveryMode === "fortnightly") return "3.5 hours";
  if (deliveryMode === "targeted") return "~20 min";
  if (deliveryMode === "daily") return "~10 min";
  return `~${questionCount} min`;
}

export function QuizRunner({
  quiz,
  questions,
  savedProgress,
}: {
  quiz: { id: string; title: string; domain: string | null; description: string | null; delivery_mode?: string | null };
  questions: QuizQuestion[];
  savedProgress?: { answers: Record<string, number>; currentPage: number } | null;
}) {
  const [stage, setStage] = useState<Stage>("intro");
  const [currentPage, setCurrentPage] = useState(savedProgress?.currentPage ?? 0);
  // selectedAnswers: question_id → chosen option index (mutable until submit)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>(
    savedProgress?.answers ?? {},
  );
  // answers: locked in on submit, used by the review section
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewWrongOnly, setReviewWrongOnly] = useState(true);
  const [feedbackVotes, setFeedbackVotes] = useState<Record<string, FeedbackVote>>({});
  const [checkedSources, setCheckedSources] = useState<Record<string, boolean>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});
  const [discussionThreadByQuestion, setDiscussionThreadByQuestion] = useState<Record<string, string>>({});
  const [overallFeedback, setOverallFeedback] = useState({
    difficultyScore: 3,
    varietyScore: 3,
    clarityScore: 3,
    relevanceScore: 3,
    comment: "",
  });
  const [overallFeedbackSubmitted, setOverallFeedbackSubmitted] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalPages = Math.ceil(questions.length / PAGE_SIZE);
  const pageQuestions = questions.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const answeredCount = Object.keys(selectedAnswers).length;

  const score = useMemo(() => {
    return answers.reduce((sum, answer) => (answer.selected === answer.correct ? sum + 1 : sum), 0);
  }, [answers]);

  const percent = questions.length ? Math.round((score / questions.length) * 100) : 0;

  const domainPerformance = useMemo(() => {
    const byId = new Map(questions.map((question) => [question.id, question]));
    const stats = new Map<string, { correct: number; total: number }>();

    for (const answer of answers) {
      const question = byId.get(answer.question_id);
      const domain = question?.domain_label || question?.subdomain || "General";
      const currentStats = stats.get(domain) || { correct: 0, total: 0 };
      currentStats.total += 1;
      if (answer.selected === answer.correct) {
        currentStats.correct += 1;
      }
      stats.set(domain, currentStats);
    }

    return Array.from(stats.entries())
      .map(([domain, values]) => ({
        domain,
        correct: values.correct,
        total: values.total,
        percent: values.total > 0 ? Math.round((values.correct / values.total) * 100) : 0,
      }))
      .sort((a, b) => a.percent - b.percent);
  }, [answers, questions]);

  const weakestDomain = domainPerformance[0]?.domain || quiz.domain || "";

  const reviewQueue = useMemo<ReviewPair[]>(() => {
    const byId = new Map(questions.map((question) => [question.id, question]));
    const pairs = answers
      .map((answer) => {
        const question = byId.get(answer.question_id);
        if (!question) {
          return null;
        }
        return { question, answer };
      })
      .filter((pair): pair is ReviewPair => Boolean(pair));

    if (!reviewWrongOnly) {
      return pairs;
    }

    // Only show wrong answers if any exist, otherwise show all
    const wrongOnly = pairs.filter((pair) => {
      // Defensive: handle undefined/null selected/correct
      return (
        typeof pair.answer.selected === 'number' &&
        typeof pair.answer.correct === 'number' &&
        pair.answer.selected !== pair.answer.correct
      );
    });
    return wrongOnly.length > 0 ? wrongOnly : pairs;
  }, [answers, questions, reviewWrongOnly]);

  const handleSubmit = () => {
    const finalAnswers: AnswerRecord[] = questions.map((q) => ({
      question_id: q.id,
      selected: selectedAnswers[q.id] ?? -1,
      correct: q.correct_index,
    }));
    setAnswers(finalAnswers);
    setReviewWrongOnly(true);
    setReviewIndex(0);
    setStage("results");
    const finalScore = finalAnswers.filter((a) => a.selected === a.correct).length;
    startTransition(async () => {
      await Promise.all([
        saveQuizResultAction({
          quizId: quiz.id,
          score: finalScore,
          totalQuestions: questions.length,
          answers: finalAnswers,
        }),
        clearQuizProgressAction({ quizId: quiz.id }),
      ]);
    });
  };

  const handleSaveExit = () => {
    setSaveStatus("saving");
    startTransition(async () => {
      await saveQuizProgressAction({
        quizId: quiz.id,
        answers: selectedAnswers,
        currentPage,
      });
      setSaveStatus("saved");
    });
  };

  const submitFeedbackVote = (questionId: string, vote: FeedbackVote) => {
    setFeedbackMessage(null);
    setFeedbackVotes((previous) => ({ ...previous, [questionId]: vote }));

    startTransition(async () => {
      const result = await voteExplanationAction({ questionId, vote });
      if (!result.ok) {
        setFeedbackMessage("Could not save your feedback right now.");
        return;
      }
      setFeedbackMessage("Thanks. Your explanation feedback has been recorded.");
    });
  };

  const submitFlagForReview = (questionId: string, checkedSource: boolean) => {
    setFeedbackMessage(null);

    startTransition(async () => {
      const result = await flagQuestionForReviewAction({
        questionId,
        reason: checkedSource ? "member_checked_source" : "member_disagrees_with_explanation",
      });

      if (!result.ok) {
        setFeedbackMessage("Could not flag this question right now.");
        return;
      }

      setFlaggedQuestions((previous) => ({ ...previous, [questionId]: true }));
      if (result.threadId) {
        setDiscussionThreadByQuestion((previous) => ({ ...previous, [questionId]: result.threadId }));
      }
      setFeedbackMessage("Thanks. This question has been flagged for discussion.");
    });
  };

  const submitOverallFeedback = () => {
    setFeedbackMessage(null);
    startTransition(async () => {
      const result = await submitQuizOverallFeedbackAction({
        quizId: quiz.id,
        difficultyScore: overallFeedback.difficultyScore,
        varietyScore: overallFeedback.varietyScore,
        clarityScore: overallFeedback.clarityScore,
        relevanceScore: overallFeedback.relevanceScore,
        comment: overallFeedback.comment,
      });

      if (!result.ok) {
        setFeedbackMessage("Could not save overall feedback right now.");
        return;
      }

      setOverallFeedbackSubmitted(true);
      setFeedbackMessage("Thanks. Your overall feedback has been recorded.");
    });
  };

  if (!questions.length) {
    return (
      <div className="rounded-2xl border bg-card p-6">
        <h1 className="text-3xl">{quiz.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">This quiz has no questions yet.</p>
      </div>
    );
  }

  if (stage === "intro") {
    const isResume = Boolean(savedProgress && Object.keys(savedProgress.answers).length > 0);
    const timeEstimate = getTimeEstimate(quiz.delivery_mode, questions.length);
    return (
      <div className="rounded-2xl border bg-card p-6">
        <h1 className="text-3xl">{quiz.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{quiz.domain || "General"}</p>
        {quiz.description ? <p className="mt-3 text-sm text-muted-foreground">{quiz.description}</p> : null}
        <p className="mt-3 inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
          <Bot className="h-4 w-4" />
          AI-generated. Your feedback tunes the model.
        </p>
        <p className="mt-4 text-sm">
          {questions.length} questions · {timeEstimate}
        </p>
        {isResume ? (
          <p className="mt-2 text-xs text-amber-700">
            You have a saved attempt — {Object.keys(savedProgress!.answers).length} of {questions.length} answered.
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setStage("question")}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            {isResume ? "Resume" : "Start quiz"}
          </button>
          {isResume ? (
            <button
              type="button"
              onClick={() => {
                setCurrentPage(0);
                setSelectedAnswers({});
                setStage("question");
              }}
              className="rounded-md border px-4 py-2 text-sm"
            >
              Start fresh
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (stage === "results") {
    const reviewPair = reviewQueue[Math.min(reviewIndex, Math.max(reviewQueue.length - 1, 0))];
    const reviewQuestion = reviewPair?.question;
    const reviewAnswer = reviewPair?.answer;
    const voted = reviewQuestion ? feedbackVotes[reviewQuestion.id] : undefined;
    const ratedCount = reviewQueue.filter((pair) => Boolean(feedbackVotes[pair.question.id])).length;
    const allRated = reviewQueue.length > 0 && ratedCount === reviewQueue.length;

    return (
      <div className="space-y-4">
        <div className="rounded-2xl border bg-card p-6">
          <h1 className="text-3xl">Results</h1>
          <p className="mt-2 text-2xl font-semibold">
            {score} / {questions.length}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {percent}% · {percent >= 70 ? "Pass" : "Needs review"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">Domain: {quiz.domain || "General"}</p>
          <p className="mt-3 inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
            <Bot className="h-4 w-4" />
            These explanations were written by AI. Rate each one below to improve future questions.
          </p>

          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <button
              type="button"
              className="rounded-md border px-3 py-2"
              onClick={() => {
                setCurrentPage(0);
                setSelectedAnswers({});
                setAnswers([]);
                setReviewIndex(0);
                setReviewWrongOnly(true);
                setFeedbackVotes({});
                setCheckedSources({});
                setFlaggedQuestions({});
                setDiscussionThreadByQuestion({});
                setOverallFeedback({
                  difficultyScore: 3,
                  varietyScore: 3,
                  clarityScore: 3,
                  relevanceScore: 3,
                  comment: "",
                });
                setOverallFeedbackSubmitted(false);
                setFeedbackMessage(null);
                setSaveStatus("idle");
                setStage("question");
              }}
            >
              Retake
            </button>
            <Link href="/quizzes" className="rounded-md border px-3 py-2">
              Browse more quizzes
            </Link>
            <Link href={`/resources?domain=${encodeURIComponent(weakestDomain)}`} className="rounded-md border px-3 py-2">
              View related resources
            </Link>
            <Link href="/quizzes/results" className="rounded-md border px-3 py-2">
              Quiz history
            </Link>
          </div>
          {isPending ? <p className="mt-3 text-xs text-muted-foreground">Saving result...</p> : null}

          {domainPerformance.length > 0 ? (
            <div className="mt-4 rounded-lg border bg-background p-3 text-sm">
              <p className="font-medium">Domain performance</p>
              <div className="mt-2 space-y-2">
                {domainPerformance.map((item) => {
                  const dc = domainColour(item.domain);
                  return (
                    <div key={item.domain} className="flex items-center gap-2">
                      <span className={`shrink-0 rounded border px-2 py-0.5 text-xs font-medium ${dc.bg} ${dc.text} ${dc.border}`}>
                        {item.domain}
                      </span>
                      <div className="flex-1 overflow-hidden rounded-full bg-muted h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${item.percent >= 70 ? 'bg-emerald-500' : item.percent >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                          style={{ width: `${item.percent}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {item.percent}% ({item.correct}/{item.total})
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border bg-card p-6">
          <h2 className="text-2xl">Question review</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Review focuses on questions you got wrong. Switch to all if needed.
          </p>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => {
                setReviewWrongOnly(true);
                setReviewIndex(0);
              }}
              className={`rounded-md border px-2 py-1 ${reviewWrongOnly ? "bg-primary/10" : "bg-card"}`}
            >
              Wrong only
            </button>
            <button
              type="button"
              onClick={() => {
                setReviewWrongOnly(false);
                setReviewIndex(0);
              }}
              className={`rounded-md border px-2 py-1 ${!reviewWrongOnly ? "bg-primary/10" : "bg-card"}`}
            >
              All questions
            </button>
          </div>
          {feedbackMessage ? <p className="mt-2 text-xs text-muted-foreground">{feedbackMessage}</p> : null}

          {reviewQuestion ? (
            <div className="mt-4 rounded-xl border bg-background p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Question {reviewIndex + 1} of {questions.length}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {reviewQuestion.domain_label ? (() => {
                  const dc = domainColour(reviewQuestion.domain_label);
                  return (
                    <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${dc.bg} ${dc.text} ${dc.border}`}>
                      {reviewQuestion.domain_number ? `D${reviewQuestion.domain_number} · ` : ''}{reviewQuestion.domain_label}
                    </span>
                  );
                })() : null}
                {reviewQuestion.subdomain ? (
                  <span className="text-xs text-muted-foreground">{reviewQuestion.subdomain}</span>
                ) : null}
                {reviewQuestion.difficulty_seed ? (
                  <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${
                    reviewQuestion.difficulty_seed === 'advanced'
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : reviewQuestion.difficulty_seed === 'challenging'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-sky-50 text-sky-700 border-sky-200'
                  }`}>
                    {reviewQuestion.difficulty_seed === 'advanced'
                      ? 'Complex'
                      : reviewQuestion.difficulty_seed === 'challenging'
                      ? 'Applied'
                      : 'Foundational'}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm">{reviewQuestion.question_text}</p>

              <div className="mt-3 grid gap-2 rounded-lg border bg-card p-3 text-sm">
                <p>
                  <span className="font-semibold">Your answer:</span>{" "}
                  {reviewQuestion.options[reviewAnswer?.selected ?? -1]?.label || "-"}. {reviewQuestion.options[reviewAnswer?.selected ?? -1]?.text || "No answer"}
                </p>
                <p>
                  <span className="font-semibold">Correct answer:</span>{" "}
                  {reviewQuestion.options[reviewAnswer?.correct ?? reviewQuestion.correct_index]?.label}. {reviewQuestion.options[reviewAnswer?.correct ?? reviewQuestion.correct_index]?.text}
                </p>
              </div>

              {reviewQuestion.explanation ? (
                <div className="mt-3 rounded-lg border bg-card p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">AI explanation</p>
                  <p className="mt-2 text-sm text-muted-foreground">{reviewQuestion.explanation}</p>
                </div>
              ) : null}

              {reviewQuestion.citations?.length ? (
                <div className="mt-3 rounded-lg border bg-card p-3 text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">Sources</p>
                  <div className="mt-2 space-y-1">
                    {reviewQuestion.citations.map((citation, citationIndex) => (
                      <p key={`${reviewQuestion.id}-citation-${citationIndex}`}>
                        {citation.clause ? `${citation.source} - ${citation.clause}` : citation.source}
                        {citation.resource_id ? (
                          <Link href={`/resources?id=${citation.resource_id}`} className="ml-1 underline">
                            View resource
                          </Link>
                        ) : citation.external_url ? (
                          <a href={citation.external_url} target="_blank" rel="noreferrer" className="ml-1 underline">
                            External link
                          </a>
                        ) : null}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">Was this explanation helpful?</span>
                <button
                  type="button"
                  onClick={() => submitFeedbackVote(reviewQuestion.id, "up")}
                  className={`rounded-md border px-2 py-1 ${
                    voted === "up" ? "border-green-600 bg-green-50" : "bg-card"
                  }`}
                >
                  Thumb up
                </button>
                <button
                  type="button"
                  onClick={() => submitFeedbackVote(reviewQuestion.id, "down")}
                  className={`rounded-md border px-2 py-1 ${
                    voted === "down" ? "border-red-600 bg-red-50" : "bg-card"
                  }`}
                >
                  Thumb down
                </button>
              </div>

              {reviewAnswer && reviewAnswer.selected !== reviewAnswer.correct ? (
                <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="font-medium">Need a human review?</p>
                  <p className="mt-1 text-xs">
                    Review the rationale for each option, then flag this item for discussion if still needed.
                  </p>
                  <label className="mt-2 flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={Boolean(checkedSources[reviewQuestion.id])}
                      onChange={(event) =>
                        setCheckedSources((previous) => ({
                          ...previous,
                          [reviewQuestion.id]: event.target.checked,
                        }))
                      }
                    />
                    I checked the source
                  </label>
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => submitFlagForReview(reviewQuestion.id, Boolean(checkedSources[reviewQuestion.id]))}
                      disabled={Boolean(flaggedQuestions[reviewQuestion.id])}
                      className="rounded-md border px-2 py-1 text-xs disabled:opacity-60"
                    >
                      {flaggedQuestions[reviewQuestion.id] ? "Flagged for review" : "Flag for review"}
                    </button>
                  </div>
                  {discussionThreadByQuestion[reviewQuestion.id] ? (
                    <Link
                      href={`/community/${discussionThreadByQuestion[reviewQuestion.id]}`}
                      className="mt-2 inline-block text-xs underline"
                    >
                      Open flagged discussion
                    </Link>
                  ) : (
                    <Link href="/community" className="mt-2 inline-block text-xs underline">
                      Open community board
                    </Link>
                  )}

                  <div className="mt-3 rounded-md border bg-white/70 p-2 text-xs text-amber-950">
                    <p className="font-medium">Incorrect option review</p>
                    <div className="mt-1 space-y-1">
                      {reviewQuestion.options
                        .filter((_, optionIndex) => optionIndex !== reviewQuestion.correct_index)
                        .map((option) => {
                          const rationale = reviewQuestion.wrong_answer_rationales?.[option.label];
                          return (
                            <p key={`${reviewQuestion.id}-${option.label}`}>
                              {option.label}. {option.text} - {rationale && rationale.trim() !== ''
                                ? rationale
                                : 'No specific rationale provided for this distractor. Please review the main explanation or flag for discussion.'}
                            </p>
                          );
                        })}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3 text-sm">
            <p>
              {ratedCount} of {reviewQueue.length} rated
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setReviewIndex((value) => Math.max(0, value - 1))}
                disabled={reviewIndex === 0}
                className="rounded-md border px-3 py-2 disabled:opacity-50"
              >
                Previous
              </button>
              {!allRated ? (
                <button
                  type="button"
                  onClick={() => setReviewIndex((value) => Math.min(reviewQueue.length - 1, value + 1))}
                  disabled={!voted || reviewIndex === reviewQueue.length - 1}
                  className="rounded-md bg-primary px-3 py-2 font-semibold text-primary-foreground disabled:opacity-50"
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submitOverallFeedback}
                  disabled={overallFeedbackSubmitted}
                  className="rounded-md bg-primary px-3 py-2 font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {overallFeedbackSubmitted ? "Feedback submitted" : "Submit overall feedback"}
                </button>
              )}
            </div>
          </div>

          {allRated ? (
            <div className="rounded-2xl border bg-card p-6">
              <h3 className="text-lg font-semibold">Overall AI Quiz Feedback</h3>
              <p className="mt-1 text-xs text-muted-foreground">Optional but highly useful for tuning quality.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  ["difficultyScore", "Difficulty"],
                  ["varietyScore", "Variety"],
                  ["clarityScore", "Clarity"],
                  ["relevanceScore", "Relevance"],
                ].map(([field, label]) => (
                  <label key={field} className="grid gap-1 text-sm">
                    <span>{label} (1-5)</span>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={overallFeedback[field as keyof typeof overallFeedback] as number}
                      onChange={(event) =>
                        setOverallFeedback((prev) => ({
                          ...prev,
                          [field]: Math.max(1, Math.min(5, Number(event.target.value) || 1)),
                        }))
                      }
                      className="h-10 rounded-md border bg-background px-3"
                    />
                  </label>
                ))}
              </div>
              <label className="mt-3 grid gap-1 text-sm">
                <span>Comment (optional)</span>
                <textarea
                  value={overallFeedback.comment}
                  onChange={(event) => setOverallFeedback((prev) => ({ ...prev, comment: event.target.value }))}
                  rows={3}
                  className="rounded-md border bg-background px-3 py-2"
                />
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={submitOverallFeedback}
                  disabled={overallFeedbackSubmitted}
                  className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {overallFeedbackSubmitted ? "Submitted" : "Submit"}
                </button>
                <Link href="/quizzes" className="rounded-md border px-3 py-2 text-sm">
                  Done
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // ── Question stage (paginated) ──────────────────────────────────────────
  const isLastPage = currentPage === totalPages - 1;
  const showPageDots = totalPages <= 12;

  return (
    <div className="space-y-4">
      {/* Progress bar + save */}
      <div className="rounded-2xl border bg-card px-5 py-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Page {currentPage + 1} of {totalPages}</span>
          <span>{answeredCount} / {questions.length} answered</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-1.5 rounded-full bg-primary transition-all"
            style={{ width: `${questions.length > 0 ? (answeredCount / questions.length) * 100 : 0}%` }}
          />
        </div>
        <div className="mt-3 flex items-center gap-2">
          {saveStatus === "saved" ? (
            <>
              <span className="text-xs text-emerald-600">Progress saved.</span>
              <Link href="/quizzes" className="text-xs underline text-muted-foreground">Back to quizzes</Link>
            </>
          ) : (
            <button
              type="button"
              onClick={handleSaveExit}
              disabled={isPending || saveStatus === "saving"}
              className="rounded-md border px-3 py-1 text-xs disabled:opacity-50"
            >
              {saveStatus === "saving" ? "Saving…" : "Save & Exit"}
            </button>
          )}
        </div>
      </div>

      {/* Questions on this page */}
      {pageQuestions.map((question, qIdx) => {
        const globalIdx = currentPage * PAGE_SIZE + qIdx;
        const selected = selectedAnswers[question.id];
        return (
          <div key={question.id} className="rounded-2xl border bg-card p-6">
            <p className="text-xs text-muted-foreground">Q{globalIdx + 1} of {questions.length}</p>
            <p className="mt-3 text-base leading-snug font-medium">{question.question_text}</p>
            <div className="mt-4 grid gap-2">
              {question.options.map((option, optIdx) => (
                <button
                  key={`${question.id}-${option.label}`}
                  type="button"
                  onClick={() =>
                    setSelectedAnswers((prev) => ({ ...prev, [question.id]: optIdx }))
                  }
                  className={`rounded-md border px-3 py-2 text-left text-sm ${
                    selected === optIdx ? "border-primary bg-primary/5" : "bg-background"
                  }`}
                >
                  <span className="font-semibold">{option.label}.</span> {option.text}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {/* Page navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-sm">
        <button
          type="button"
          onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
          disabled={currentPage === 0}
          className="rounded-md border px-3 py-2 disabled:opacity-40"
        >
          ← Previous
        </button>

        {showPageDots ? (
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: totalPages }, (_, i) => {
              const pageAnswered = questions
                .slice(i * PAGE_SIZE, (i + 1) * PAGE_SIZE)
                .every((q) => selectedAnswers[q.id] !== undefined);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCurrentPage(i)}
                  className={`h-7 w-7 rounded text-xs font-medium ${
                    i === currentPage
                      ? "bg-primary text-primary-foreground"
                      : pageAnswered
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "border bg-background text-muted-foreground"
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Page {currentPage + 1} / {totalPages}</span>
        )}

        {isLastPage ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={answeredCount === 0}
            className="rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50"
          >
            Submit quiz
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
            className="rounded-md bg-primary px-3 py-2 font-semibold text-primary-foreground"
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
}
