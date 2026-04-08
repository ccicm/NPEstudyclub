"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { saveQuizResultAction } from "@/app/(member)/quizzes/actions";

type QuizQuestion = {
  id: string;
  question_text: string;
  options: Array<{ label: string; text: string }>;
  correct_index: number;
  explanation: string | null;
};

type Stage = "intro" | "question" | "results";

type AnswerRecord = {
  question_id: string;
  selected: number;
  correct: number;
};

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
          <h2 className="text-2xl">Question breakdown</h2>
          <div className="mt-3 space-y-2">
            {questions.map((question, questionIndex) => {
              const answer = answers[questionIndex];
              const correct = answer?.selected === answer?.correct;
              return (
                <details key={question.id} className="rounded-lg border bg-background p-3">
                  <summary className="cursor-pointer text-sm font-semibold">
                    Q{questionIndex + 1} · {correct ? "Correct" : "Incorrect"}
                  </summary>
                  <p className="mt-2 text-sm">{question.question_text}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Your answer: {question.options[answer?.selected ?? 0]?.label || "-"} · Correct: {question.options[answer?.correct ?? 0]?.label}
                  </p>
                  {question.explanation ? <p className="mt-1 text-sm text-muted-foreground">{question.explanation}</p> : null}
                </details>
              );
            })}
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
