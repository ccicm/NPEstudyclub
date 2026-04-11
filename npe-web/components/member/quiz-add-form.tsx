"use client";

import { useMemo, useState } from "react";
import { NPE_DOMAINS } from "@/lib/npe-taxonomy";

type DraftQuestion = {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e: string;
  correct_label: "A" | "B" | "C" | "D" | "E";
  explanation: string;
};

const blankQuestion = (): DraftQuestion => ({
  question_text: "",
  option_a: "",
  option_b: "",
  option_c: "",
  option_d: "",
  option_e: "",
  correct_label: "A",
  explanation: "",
});

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

export function QuizAddForm({
  action,
  errorCode,
}: {
  action: (formData: FormData) => Promise<void>;
  errorCode: string | null;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Exam Prep");
  const [domain, setDomain] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<DraftQuestion[]>([blankQuestion(), blankQuestion(), blankQuestion(), blankQuestion()]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const errorMessage = !errorCode
    ? null
    : errorCode === "missing_required"
      ? "Please complete the required fields before submitting."
      : errorCode === "min_questions"
        ? "Add at least 4 questions before submitting."
        : errorCode === "invalid_payload" || errorCode === "invalid_question"
          ? "The quiz data looks incomplete. Please check the form or CSV and try again."
          : errorCode === "schema_not_ready"
            ? "Quiz tools are temporarily unavailable. Please try again later."
            : errorCode === "not_authorized"
              ? "Your account cannot create quizzes right now. Please check your access."
              : "Unable to submit the quiz. Please try again.";

  const canContinue = useMemo(() => Boolean(title.trim() && category.trim() && domain.trim()), [category, domain, title]);
  const canSubmit = useMemo(() => questions.length >= 4, [questions.length]);

  return (
    <div className="space-y-4">
      <h1 className="text-3xl">Add Quiz</h1>

      {errorCode ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      {csvError ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{csvError}</p>
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
                {NPE_DOMAINS.map(({ label: item }) => (
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
            <div className="rounded-lg border bg-muted/20 p-3 text-sm md:col-span-2">
              <p className="font-semibold">CSV option</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Download the template, fill your questions, then upload to auto-populate Step 2.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <a href="/quizzes/add/template" className="underline" download>
                  Download CSV template
                </a>
                <label className="cursor-pointer underline">
                  Upload completed CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="sr-only"
                    onChange={async (event) => {
                      setCsvError(null);
                      const file = event.target.files?.[0];
                      if (!file) {
                        return;
                      }

                      try {
                        const text = await file.text();
                        const lines = text
                          .split(/\r?\n/)
                          .map((line) => line.trim())
                          .filter(Boolean);

                        if (lines.length < 2) {
                          setCsvError("CSV appears empty. Add at least 4 question rows.");
                          return;
                        }

                        const header = parseCsvLine(lines[0]).map((item) => item.toLowerCase());
                        const expected = [
                          "question_text",
                          "option_a",
                          "option_b",
                          "option_c",
                          "option_d",
                          "option_e",
                          "correct_label",
                          "explanation",
                        ];

                        const validHeader = expected.every((column, index) => header[index] === column);
                        if (!validHeader) {
                          setCsvError("CSV header is invalid. Please use the provided template.");
                          return;
                        }

                        const parsed = lines.slice(1).map((line) => {
                          const [
                            question_text,
                            option_a,
                            option_b,
                            option_c,
                            option_d,
                            option_e,
                            correct_label,
                            explanation,
                          ] = parseCsvLine(line);

                          const label = (correct_label || "A").toUpperCase();
                          if (!["A", "B", "C", "D", "E"].includes(label)) {
                            throw new Error("Invalid correct_label value. Use A, B, C, D, or E.");
                          }

                          return {
                            question_text: question_text || "",
                            option_a: option_a || "",
                            option_b: option_b || "",
                            option_c: option_c || "",
                            option_d: option_d || "",
                            option_e: option_e || "",
                            correct_label: label as "A" | "B" | "C" | "D" | "E",
                            explanation: explanation || "",
                          };
                        });

                        if (parsed.length < 4) {
                          setCsvError("CSV must include at least 4 questions.");
                          return;
                        }

                        setQuestions(parsed);
                        setStep(2);
                      } catch {
                        setCsvError("The CSV file needs a quick fix. Please check the template and try again.");
                      }
                    }}
                  />
                </label>
              </div>
            </div>
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
                  <input placeholder="Question text *" value={question.question_text} onChange={(event) => {
                    const next = [...questions];
                    next[index].question_text = event.target.value;
                    setQuestions(next);
                  }} className="h-10 rounded-md border bg-card px-3 text-sm" />
                  <input placeholder="Option A *" value={question.option_a} onChange={(event) => {
                    const next = [...questions];
                    next[index].option_a = event.target.value;
                    setQuestions(next);
                  }} className="h-10 rounded-md border bg-card px-3 text-sm" />
                  <input placeholder="Option B *" value={question.option_b} onChange={(event) => {
                    const next = [...questions];
                    next[index].option_b = event.target.value;
                    setQuestions(next);
                  }} className="h-10 rounded-md border bg-card px-3 text-sm" />
                  <input placeholder="Option C *" value={question.option_c} onChange={(event) => {
                    const next = [...questions];
                    next[index].option_c = event.target.value;
                    setQuestions(next);
                  }} className="h-10 rounded-md border bg-card px-3 text-sm" />
                  <input placeholder="Option D *" value={question.option_d} onChange={(event) => {
                    const next = [...questions];
                    next[index].option_d = event.target.value;
                    setQuestions(next);
                  }} className="h-10 rounded-md border bg-card px-3 text-sm" />
                  <input placeholder="Option E *" value={question.option_e} onChange={(event) => {
                    const next = [...questions];
                    next[index].option_e = event.target.value;
                    setQuestions(next);
                  }} className="h-10 rounded-md border bg-card px-3 text-sm" />
                  <select
                    value={question.correct_label}
                    onChange={(event) => {
                      const next = [...questions];
                      next[index].correct_label = event.target.value as "A" | "B" | "C" | "D" | "E";
                      setQuestions(next);
                    }}
                    className="h-10 rounded-md border bg-card px-3 text-sm"
                  >
                    <option value="A">Correct answer: A</option>
                    <option value="B">Correct answer: B</option>
                    <option value="C">Correct answer: C</option>
                    <option value="D">Correct answer: D</option>
                    <option value="E">Correct answer: E</option>
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
              <button type="button" onClick={() => setQuestions((prev) => [...prev, blankQuestion()])} className="rounded-md border px-3 py-2 text-sm">
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

            <button type="submit" disabled={!canSubmit} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              Submit quiz for review
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
