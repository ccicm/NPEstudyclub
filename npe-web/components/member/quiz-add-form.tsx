"use client";

import { useMemo, useState } from "react";
import { EXAM_PREP_DOMAINS } from "@/lib/resource-options";

type DraftQuestion = {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_label: "A" | "B" | "C" | "D";
  explanation: string;
};

const blankQuestion = (): DraftQuestion => ({
  question_text: "",
  option_a: "",
  option_b: "",
  option_c: "",
  option_d: "",
  correct_label: "A",
  explanation: "",
});

export function QuizAddForm({
  action,
  hasError,
}: {
  action: (formData: FormData) => Promise<void>;
  hasError: boolean;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Exam Prep");
  const [domain, setDomain] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<DraftQuestion[]>([blankQuestion(), blankQuestion(), blankQuestion(), blankQuestion()]);

  const canContinue = useMemo(() => Boolean(title.trim() && category.trim() && domain.trim()), [category, domain, title]);
  const canSubmit = useMemo(() => questions.length >= 4, [questions.length]);

  return (
    <div className="space-y-4">
      <h1 className="text-3xl">Add Quiz</h1>

      {hasError ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Unable to submit quiz. Please check all required fields.
        </p>
      ) : null}

      <form action={action} className="rounded-2xl border bg-card p-5">
        <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span className={step === 1 ? "text-primary" : ""}>Step 1: Details</span>
          <span>•</span>
          <span className={step === 2 ? "text-primary" : ""}>Step 2: Questions</span>
        </div>

        {step === 1 ? (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm md:col-span-2">
              <span>Title *</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} className="h-10 rounded-md border bg-background px-3" />
            </label>
            <label className="grid gap-1 text-sm">
              <span>Category *</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-10 rounded-md border bg-background px-3">
                <option value="Exam Prep">Exam Prep</option>
                <option value="Clinical Practice">Clinical Practice</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span>Domain *</span>
              <select value={domain} onChange={(event) => setDomain(event.target.value)} className="h-10 rounded-md border bg-background px-3">
                <option value="">Select domain</option>
                {EXAM_PREP_DOMAINS.filter((item) => item !== "Other").map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm md:col-span-2">
              <span>Description</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="min-h-24 rounded-md border bg-background px-3 py-2"
              />
            </label>
            <div className="md:col-span-2">
              <button
                type="button"
                disabled={!canContinue}
                onClick={() => setStep(2)}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                Continue to questions
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map((question, index) => (
              <div key={index} className="rounded-xl border bg-background p-4">
                <p className="text-sm font-semibold">Question {index + 1}</p>
                <div className="mt-2 grid gap-2">
                  <input
                    placeholder="Question text *"
                    value={question.question_text}
                    onChange={(event) => {
                      const next = [...questions];
                      next[index].question_text = event.target.value;
                      setQuestions(next);
                    }}
                    className="h-10 rounded-md border bg-card px-3 text-sm"
                  />
                  <input
                    placeholder="Option A *"
                    value={question.option_a}
                    onChange={(event) => {
                      const next = [...questions];
                      next[index].option_a = event.target.value;
                      setQuestions(next);
                    }}
                    className="h-10 rounded-md border bg-card px-3 text-sm"
                  />
                  <input
                    placeholder="Option B *"
                    value={question.option_b}
                    onChange={(event) => {
                      const next = [...questions];
                      next[index].option_b = event.target.value;
                      setQuestions(next);
                    }}
                    className="h-10 rounded-md border bg-card px-3 text-sm"
                  />
                  <input
                    placeholder="Option C"
                    value={question.option_c}
                    onChange={(event) => {
                      const next = [...questions];
                      next[index].option_c = event.target.value;
                      setQuestions(next);
                    }}
                    className="h-10 rounded-md border bg-card px-3 text-sm"
                  />
                  <input
                    placeholder="Option D"
                    value={question.option_d}
                    onChange={(event) => {
                      const next = [...questions];
                      next[index].option_d = event.target.value;
                      setQuestions(next);
                    }}
                    className="h-10 rounded-md border bg-card px-3 text-sm"
                  />
                  <select
                    value={question.correct_label}
                    onChange={(event) => {
                      const next = [...questions];
                      next[index].correct_label = event.target.value as "A" | "B" | "C" | "D";
                      setQuestions(next);
                    }}
                    className="h-10 rounded-md border bg-card px-3 text-sm"
                  >
                    <option value="A">Correct answer: A</option>
                    <option value="B">Correct answer: B</option>
                    <option value="C">Correct answer: C</option>
                    <option value="D">Correct answer: D</option>
                  </select>
                  <textarea
                    placeholder="Explanation"
                    value={question.explanation}
                    onChange={(event) => {
                      const next = [...questions];
                      next[index].explanation = event.target.value;
                      setQuestions(next);
                    }}
                    className="min-h-20 rounded-md border bg-card px-3 py-2 text-sm"
                  />
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setQuestions((prev) => [...prev, blankQuestion()])}
                className="rounded-md border px-3 py-2 text-sm"
              >
                + Add another question
              </button>
              <button type="button" onClick={() => setStep(1)} className="rounded-md border px-3 py-2 text-sm">
                Back to details
              </button>
            </div>

            <input type="hidden" name="title" value={title} />
            <input type="hidden" name="category" value={category} />
            <input type="hidden" name="domain" value={domain} />
            <input type="hidden" name="description" value={description} />
            <input type="hidden" name="questions" value={JSON.stringify(questions)} />

            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              Submit quiz for review
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
