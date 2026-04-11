"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Bot } from "lucide-react";

// ── Domain colours (matches quiz-runner.tsx) ────────────────────────────────
const DOMAIN_COLOURS: Record<string, { bg: string; text: string; border: string; stripe: string }> = {
  ethics:        { bg: "bg-purple-50",  text: "text-purple-700",  border: "border-purple-200",  stripe: "bg-purple-400"  },
  assessment:    { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200",    stripe: "bg-blue-400"    },
  interventions: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", stripe: "bg-emerald-400" },
  communication: { bg: "bg-orange-50",  text: "text-orange-700",  border: "border-orange-200",  stripe: "bg-orange-400"  },
};

// NPE quiz domains — distinct from the resource taxonomy in resource-options.ts
const NPE_QUIZ_DOMAINS = ["Ethics", "Assessment", "Interventions", "Communication"] as const;

function domainColour(label: string | null | undefined) {
  const key = (label || "").toLowerCase().trim();
  return DOMAIN_COLOURS[key] ?? { bg: "bg-muted", text: "text-muted-foreground", border: "border-border", stripe: "bg-border" };
}

// ── Delivery mode display ────────────────────────────────────────────────────
const MODE_LABELS: Record<string, { label: string; time: string }> = {
  daily:        { label: "Daily",    time: "~10 min"   },
  targeted:     { label: "Weekly",   time: "~20 min"   },
  fortnightly:  { label: "Exam sim", time: "3.5 hrs"   },
};

function modeDisplay(mode: string | null | undefined) {
  if (!mode) return null;
  return MODE_LABELS[mode] ?? null;
}

// ── Types ────────────────────────────────────────────────────────────────────
type QuizCard = {
  id: string;
  title: string;
  category: string;
  domain: string | null;
  author_name: string | null;
  is_curated: boolean | null;
  delivery_mode: string | null;
  question_count: number;
  average_score: number | null;
};

// ── Component ────────────────────────────────────────────────────────────────
export function QuizzesBrowser({
  quizzes,
  created,
  noticeMessage,
}: {
  quizzes: QuizCard[];
  created: boolean;
  noticeMessage?: string | null;
  // fortnightlyMessage removed — fortnightly sets no longer run
}) {
  const [domain, setDomain] = useState("");

  const filtered = useMemo(() => {
    return quizzes.filter((quiz) => {
      if (domain && (quiz.domain || "") !== domain) return false;
      return true;
    });
  }, [domain, quizzes]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Quizzes</h1>
        <div className="flex items-center gap-3">
          <Link href="/quizzes/results" className="text-sm underline">
            Quiz history
          </Link>
          <Link
            href="/quizzes/add"
            className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
          >
            + Add quiz
          </Link>
        </div>
      </div>

      {/* Success notice */}
      {created ? (
        <p className="rounded-xl border border-primary/30 bg-accent p-3 text-sm">
          Quiz submitted successfully.
        </p>
      ) : null}

      {/* Custom notice */}
      {noticeMessage ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {noticeMessage}
        </p>
      ) : null}

      {/* Publishing cadence note */}
      <div className="flex items-start gap-2 rounded-xl border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <Bot className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          New quizzes are published regularly — daily sets drop Mon–Fri at 6 am AEST, and targeted
          domain sets are added throughout the week. Community members can add their own below.
        </span>
      </div>

      {/* Domain filter pills */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setDomain("")}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            !domain ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground"
          }`}
        >
          All domains
        </button>
        {NPE_QUIZ_DOMAINS.map((d) => {
          const dc = domainColour(d);
          const active = domain === d;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setDomain(active ? "" : d)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? `${dc.bg} ${dc.text} ${dc.border}`
                  : "bg-card text-muted-foreground border-border"
              }`}
            >
              {d}
            </button>
          );
        })}
      </div>

      {/* Quiz grid */}
      {!filtered.length ? (
        <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
          <p>No quizzes match this filter.</p>
          <button
            type="button"
            onClick={() => setDomain("")}
            className="mt-3 underline"
          >
            Clear filter
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((quiz) => {
            const dc = domainColour(quiz.domain);
            const mode = modeDisplay(quiz.delivery_mode);
            const isBot = quiz.author_name === "NPE Quiz Bot";
            const score = quiz.average_score;

            return (
              <article
                key={quiz.id}
                className="flex flex-col overflow-hidden rounded-2xl border bg-card"
              >
                {/* Coloured domain stripe */}
                <div className={`h-1 w-full ${dc.stripe}`} />

                <div className="flex flex-1 flex-col gap-0 p-5">
                  {/* Tags */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {quiz.domain ? (
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${dc.bg} ${dc.text} ${dc.border}`}
                      >
                        {quiz.domain}
                      </span>
                    ) : null}
                    {mode ? (
                      <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {mode.label} · {mode.time}
                      </span>
                    ) : null}
                    {quiz.is_curated ? (
                      <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        Curated
                      </span>
                    ) : !isBot ? (
                      <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        Community
                      </span>
                    ) : null}
                  </div>

                  {/* Title */}
                  <h2 className="mt-3 text-base font-semibold leading-snug">{quiz.title}</h2>

                  {/* Stats */}
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{quiz.question_count} questions</span>
                    {score !== null ? (
                      <span
                        className={`font-medium ${
                          score >= 70
                            ? "text-emerald-600"
                            : score >= 50
                            ? "text-amber-600"
                            : "text-red-500"
                        }`}
                      >
                        {score}% avg
                      </span>
                    ) : (
                      <span>Not attempted</span>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="mt-auto flex items-center justify-between pt-4">
                    <span className="text-xs text-muted-foreground">
                      {isBot ? "Auto-generated" : `By ${quiz.author_name || "Member"}`}
                    </span>
                    <Link
                      href={`/quizzes/${quiz.id}`}
                      className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                    >
                      Start →
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
