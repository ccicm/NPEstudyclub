"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Bot } from "lucide-react";
import { saveQuizResultAction, voteExplanationAction } from "@/app/(member)/quizzes/actions";

type QuizQuestion = {
  id: string;
  question_text: string;
  options: Array<{ label: string; text: string }>;
  correct_index: number;
  explanation: string | null;
  citations?: Array<{
    source: string;
    clause?: string | null;
    external_url?: string | null;
    resource_id?: string | null;
  }> | null;
  wrong_answer_rationales?: Record<string, string> | null;
};

type Stage = "intro" | "question" | "results";

type AnswerRecord = {
  question_id: string;
  selected: number;
  correct: number;
};

type FeedbackVote = "up" | "down";

export function QuizRunner({
  quiz,
  questions,
}: {
  quiz: { id: string; title: string; domain: string | null; description: string | null };
  questions: QuizQuestion[];
}) {
  const [stage, setStage] = useState<Stage>("intro");
  const [index, setIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [feedbackVotes, setFeedbackVotes] = useState<Record<string, FeedbackVote>>({});
  const [checkedSources, setCheckedSources] = useState<Record<string, boolean>>({});
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const current = questions[index];

  const score = useMemo(() => {
    return answers.reduce((sum, answer) => (answer.selected === answer.correct ? sum + 1 : sum), 0);
  }, [answers]);

  const percent = questions.length ? Math.round((score / questions.length) * 100) : 0;

  const submitResult = (finalAnswers: AnswerRecord[]) => {
    const finalScore = finalAnswers.reduce((sum, answer) => (answer.selected === answer.correct ? sum + 1 : sum), 0);
    startTransition(async () => {
      await saveQuizResultAction({
        quizId: quiz.id,
        score: finalScore,
        totalQuestions: questions.length,
        answers: finalAnswers,
      });
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

  if (!questions.length) {
    return (
      <div className="rounded-2xl border bg-card p-6">
        <h1 className="text-3xl">{quiz.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">This quiz has no questions yet.</p>
      </div>
    );
  }

  if (stage === "intro") {
    return (
      <div className="rounded-2xl border bg-card p-6">
        <h1 className="text-3xl">{quiz.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{quiz.domain || "General"}</p>
        {quiz.description ? <p className="mt-3 text-sm text-muted-foreground">{quiz.description}</p> : null}
        <p className="mt-3 inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
          <Bot className="h-4 w-4" />
          AI-generated. Your feedback tunes the model.
        </p>
        <p className="mt-4 text-sm">{questions.length} questions · ~{questions.length} mins</p>
        <button
          type="button"
          onClick={() => setStage("question")}
          className="mt-5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Start quiz
        </button>
      </div>
    );
  }

  if (stage === "results") {
    const reviewQuestion = questions[reviewIndex];
    const reviewAnswer = answers[reviewIndex];
    const voted = reviewQuestion ? feedbackVotes[reviewQuestion.id] : undefined;
    const ratedCount = questions.filter((question) => Boolean(feedbackVotes[question.id])).length;
    const allRated = ratedCount === questions.length;

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
                setStage("question");
                setIndex(0);
                setSelectedIndex(null);
                setRevealed(false);
                setAnswers([]);
                setReviewIndex(0);
                setFeedbackVotes({});
                setCheckedSources({});
                setFeedbackMessage(null);
              }}
            >
              Retake
            </button>
            <Link href="/quizzes" className="rounded-md border px-3 py-2">
              Browse more quizzes
            </Link>
            <Link href={`/resources?domain=${encodeURIComponent(quiz.domain || "")}`} className="rounded-md border px-3 py-2">
              View related resources
            </Link>
            <Link href="/quizzes/results" className="rounded-md border px-3 py-2">
              Quiz history
            </Link>
          </div>
          {isPending ? <p className="mt-3 text-xs text-muted-foreground">Saving result...</p> : null}
        </div>

        <div className="rounded-2xl border bg-card p-6">
          <h2 className="text-2xl">Question review</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Rate each explanation to unlock the next question.
          </p>
          {feedbackMessage ? <p className="mt-2 text-xs text-muted-foreground">{feedbackMessage}</p> : null}

          {reviewQuestion ? (
            <div className="mt-4 rounded-xl border bg-background p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Question {reviewIndex + 1} of {questions.length}
              </p>
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

              {voted === "down" ? (
                <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="font-medium">Need a human review?</p>
                  <p className="mt-1 text-xs">
                    If you have reviewed the explanation and sources and still disagree, open a community review thread.
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
                  <Link href="/community" className="mt-2 inline-block text-xs underline">
                    Open community review board
                  </Link>

                  <div className="mt-3 rounded-md border bg-white/70 p-2 text-xs text-amber-950">
                    <p className="font-medium">Incorrect option review</p>
                    <div className="mt-1 space-y-1">
                      {reviewQuestion.options
                        .filter((_, optionIndex) => optionIndex !== reviewQuestion.correct_index)
                        .map((option) => (
                          <p key={`${reviewQuestion.id}-${option.label}`}>
                            {option.label}. {option.text} - {reviewQuestion.wrong_answer_rationales?.[option.label] || "Does not match the keyed answer for this question."}
                          </p>
                        ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3 text-sm">
            <p>
              {ratedCount} of {questions.length} rated
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
                  onClick={() => setReviewIndex((value) => Math.min(questions.length - 1, value + 1))}
                  disabled={!voted || reviewIndex === questions.length - 1}
                  className="rounded-md bg-primary px-3 py-2 font-semibold text-primary-foreground disabled:opacity-50"
                >
                  Next
                </button>
              ) : (
                <Link href="/quizzes" className="rounded-md bg-primary px-3 py-2 font-semibold text-primary-foreground">
                  Done
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-card p-6">
      <p className="text-sm text-muted-foreground">
        Q{index + 1} of {questions.length}
      </p>
      <h1 className="mt-3 text-2xl leading-tight">{current.question_text}</h1>

      <div className="mt-4 grid gap-2">
        {current.options.map((option, optionIndex) => {
          const selected = selectedIndex === optionIndex;
          const correct = revealed && optionIndex === current.correct_index;
          const selectedWrong = revealed && selected && optionIndex !== current.correct_index;

          return (
            <button
              key={`${current.id}-${option.label}`}
              type="button"
              onClick={() => {
                if (!revealed) {
                  setSelectedIndex(optionIndex);
                }
              }}
              className={`rounded-md border px-3 py-2 text-left text-sm ${
                correct
                  ? "border-green-600 bg-green-50"
                  : selectedWrong
                    ? "border-red-600 bg-red-50"
                    : selected
                      ? "border-primary bg-primary/5"
                      : "bg-background"
              }`}
            >
              <span className="font-semibold">{option.label}.</span> {option.text}
            </button>
          );
        })}
      </div>

      {!revealed ? (
        <button
          type="button"
          disabled={selectedIndex === null}
          onClick={() => setRevealed(true)}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          Check answer
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          {selectedIndex !== current.correct_index ? (
            <p className="text-sm text-muted-foreground">
              Correct answer: {current.options[current.correct_index]?.label}. {current.options[current.correct_index]?.text}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Correct.</p>
          )}
          {current.explanation ? <p className="text-sm text-muted-foreground">{current.explanation}</p> : null}
          <button
            type="button"
            onClick={() => {
              const nextAnswers = [
                ...answers,
                { question_id: current.id, selected: selectedIndex ?? 0, correct: current.correct_index },
              ];

              if (index + 1 === questions.length) {
                setAnswers(nextAnswers);
                setStage("results");
                submitResult(nextAnswers);
                return;
              }

              setAnswers(nextAnswers);
              setIndex((value) => value + 1);
              setSelectedIndex(null);
              setRevealed(false);
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            {index + 1 === questions.length ? "View results" : "Next question"}
          </button>
        </div>
      )}
    </div>
  );
}
