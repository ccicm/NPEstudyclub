"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Bot } from "lucide-react";
import { EXAM_PREP_DOMAINS } from "@/lib/resource-options";

type QuizCard = {
  id: string;
  title: string;
  category: string;
  domain: string | null;
  author_name: string | null;
  is_curated: boolean | null;
  question_count: number;
  average_score: number | null;
};

type QuizTab = "All" | "Exam Prep" | "Clinical Practice";

export function QuizzesBrowser({
  quizzes,
  created,
  noticeMessage,
  fortnightlyMessage,
}: {
  quizzes: QuizCard[];
  created: boolean;
  noticeMessage?: string | null;
  fortnightlyMessage?: string | null;
}) {
  const [tab, setTab] = useState<QuizTab>("All");
  const [domain, setDomain] = useState("");

  const filtered = useMemo(() => {
    return quizzes.filter((quiz) => {
      if (tab !== "All" && quiz.category !== tab) {
        return false;
      }
      if (domain && (quiz.domain || "") !== domain) {
        return false;
      }
      return true;
    });
  }, [domain, quizzes, tab]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Quizzes</h1>
        <div className="flex items-center gap-3">
          <Link href="/quizzes/results" className="text-sm underline">
            Quiz history
          </Link>
          <Link href="/quizzes/add" className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
            + Add quiz
          </Link>
        </div>
      </div>

      {created ? (
        <p className="rounded-xl border border-primary/30 bg-accent p-3 text-sm">Quiz submitted successfully.</p>
      ) : null}

      {noticeMessage ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{noticeMessage}</p>
      ) : null}

      {fortnightlyMessage ? (
        <p className="rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-800">{fortnightlyMessage}</p>
      ) : null}

      <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
        <span className="inline-flex items-center gap-2 font-medium">
          <Bot className="h-4 w-4" />
          All quizzes are AI-generated.
        </span>{" "}
        Your ratings after each quiz help improve question quality.
      </p>

      <div className="flex flex-wrap gap-2">
        {(["All", "Exam Prep", "Clinical Practice"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`rounded-full border px-3 py-1.5 text-sm ${tab === item ? "bg-primary text-primary-foreground" : "bg-card"}`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="max-w-xs rounded-xl border bg-card p-3">
        <label className="grid gap-1 text-sm">
          <span>Domain filter</span>
          <select value={domain} onChange={(event) => setDomain(event.target.value)} className="h-10 rounded-md border bg-background px-3">
            <option value="">All domains</option>
            {EXAM_PREP_DOMAINS.filter((item) => item !== "Other").map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!filtered.length ? (
        <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
          <p>No quiz sets match these filters.</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setTab("All");
                setDomain("");
              }}
              className="underline"
            >
              Clear filters
            </button>
            <Link href="/quizzes/add" className="underline">
              Add a quiz
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((quiz) => (
            <article key={quiz.id} className="rounded-2xl border bg-card p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{quiz.domain || "General"}</p>
              <h2 className="mt-2 text-xl leading-tight">{quiz.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{quiz.question_count} questions</p>
              <p className="text-sm text-muted-foreground">
                Avg score: {quiz.average_score === null ? "Not attempted" : `${quiz.average_score}%`}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-muted px-2 py-1">By {quiz.author_name || "Member"}</span>
                {quiz.is_curated ? <span className="rounded-full bg-primary/15 px-2 py-1 text-primary">Admin curated</span> : null}
              </div>
              <Link href={`/quizzes/${quiz.id}`} className="mt-4 inline-block rounded-md border px-3 py-2 text-sm font-semibold">
                Start quiz
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
