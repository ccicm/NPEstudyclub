"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarClock } from "lucide-react";
import { NPE_DOMAINS, domainColour } from "@/lib/npe-taxonomy";

// ── Constants ────────────────────────────────────────────────────────────────
const EXAM_COOLDOWN_DAYS = 30;

const MODE_OPTIONS = [
  { value: "",            label: "All types"  },
  { value: "daily",       label: "Daily"      },
  { value: "targeted",    label: "Weekly"     },
  { value: "fortnightly", label: "Exam sim"   },
] as const;

const MODE_LABELS: Record<string, { label: string; time: string }> = {
  daily:        { label: "Daily",    time: "~10 min"  },
  targeted:     { label: "Weekly",   time: "~20 min"  },
  fortnightly:  { label: "Exam sim", time: "3.5 hrs"  },
};

const STATUS_OPTIONS = [
  { value: "",          label: "All"       },
  { value: "new",       label: "New"       },
  { value: "attempted", label: "Attempted" },
] as const;

// ── Helpers ──────────────────────────────────────────────────────────────────
function examNextAvailable(lastAttemptedAt: string | null): Date | null {
  if (!lastAttemptedAt) return null;
  const d = new Date(lastAttemptedAt);
  d.setDate(d.getDate() + EXAM_COOLDOWN_DAYS);
  return d;
}

function fmtDate(d: Date) {
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function scoreColour(score: number) {
  if (score >= 70) return "text-emerald-600";
  if (score >= 50) return "text-amber-600";
  return "text-red-500";
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
  last_attempted_at: string | null;
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
}) {
  const [mode,   setMode]   = useState("");
  const [domain, setDomain] = useState("");
  const [status, setStatus] = useState("");

  // Hide domain filter for exam sims — they're always cross-domain
  const showDomainFilter = mode !== "fortnightly";

  const filtered = useMemo(() => {
    return quizzes.filter((quiz) => {
      if (mode   && quiz.delivery_mode !== mode) return false;
      if (domain && showDomainFilter && (quiz.domain || "") !== domain) return false;
      if (status === "new"       && quiz.average_score !== null) return false;
      if (status === "attempted" && quiz.average_score === null) return false;
      return true;
    });
  }, [mode, domain, status, quizzes, showDomainFilter]);

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
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

      {/* ── Notices ── */}
      {created ? (
        <p className="rounded-xl border border-primary/30 bg-accent p-3 text-sm">
          Quiz submitted successfully.
        </p>
      ) : null}
      {noticeMessage ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {noticeMessage}
        </p>
      ) : null}

      {/* ── Publishing note ── */}
      <div className="flex items-start gap-2 rounded-xl border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Daily sets drop Mon–Fri at 6 am AEST. Weekly domain sets are added throughout the week.
          Exam simulations are available once per month. Community members can add their own below.
        </span>
      </div>

      {/* ── Filters ── */}
      <div className="space-y-2">

        {/* Mode */}
        <div className="flex flex-wrap gap-2">
          {MODE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setMode(opt.value);
                if (opt.value === "fortnightly") setDomain("");
              }}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                mode === opt.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Domain — hidden for exam sim */}
        {showDomainFilter ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setDomain("")}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                !domain ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              All domains
            </button>
            {NPE_DOMAINS.map(({ label: d }) => {
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
                      : "bg-card text-muted-foreground border-border hover:bg-muted"
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        ) : null}

        {/* Status */}
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatus(opt.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                status === opt.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Grid ── */}
      {!filtered.length ? (
        <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
          <p>No quizzes match these filters.</p>
          <button
            type="button"
            onClick={() => { setMode(""); setDomain(""); setStatus(""); }}
            className="mt-3 underline"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((quiz) => {
            const dc = domainColour(quiz.domain);
            const mode = MODE_LABELS[quiz.delivery_mode ?? ""] ?? null;
            const isBot = quiz.author_name === "NPE Quiz Bot";
            const isAttempted = quiz.average_score !== null;
            const isExamSim = quiz.delivery_mode === "fortnightly";
            const nextAvail = isExamSim ? examNextAvailable(quiz.last_attempted_at) : null;
            const isLocked = Boolean(nextAvail && nextAvail > new Date());

            // CTA
            const ctaLabel = isLocked
              ? "Review results"
              : isAttempted && isExamSim
                ? "Start new sim"
                : isAttempted
                  ? "Retake"
                  : "Start →";

            const ctaPrimary = !isLocked && !isAttempted;

            return (
              <article
                key={quiz.id}
                className={`flex flex-col overflow-hidden rounded-2xl border bg-card transition-opacity ${isLocked ? "opacity-60" : ""}`}
              >
                {/* Domain stripe */}
                <div className={`h-1 w-full ${dc.stripe}`} />

                <div className="flex flex-1 flex-col gap-0 p-5">
                  {/* Tags row */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {quiz.domain ? (
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${dc.bg} ${dc.text} ${dc.border}`}>
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
                    {isAttempted ? (
                      <span className={`font-medium ${scoreColour(quiz.average_score!)}`}>
                        Your score: {quiz.average_score}%
                      </span>
                    ) : (
                      <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs font-medium text-primary">
                        New
                      </span>
                    )}
                  </div>

                  {/* Exam sim cooldown notice */}
                  {isLocked && nextAvail ? (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Next sim available {fmtDate(nextAvail)}
                    </p>
                  ) : null}

                  {/* Footer */}
                  <div className="mt-auto flex items-center justify-between pt-4">
                    <span className="text-xs text-muted-foreground">
                      {isBot ? "Auto-generated" : `By ${quiz.author_name || "Member"}`}
                    </span>
                    <Link
                      href={`/quizzes/${quiz.id}`}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                        ctaPrimary
                          ? "bg-primary text-primary-foreground"
                          : "border border-border bg-card text-foreground hover:bg-muted"
                      }`}
                    >
                      {ctaLabel}
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
