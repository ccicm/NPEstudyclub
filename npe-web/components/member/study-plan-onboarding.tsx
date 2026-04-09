"use client";

import { useMemo, useState } from "react";
import { EXAM_WINDOWS } from "@/lib/exam-windows";
import { NPE_DOMAINS } from "@/lib/resource-options";

type Step = 1 | 2 | 3;

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function StudyPlanOnboarding({
  action,
  errorCode,
}: {
  action: (formData: FormData) => Promise<void>;
  errorCode: string | null;
}) {
  const [step, setStep] = useState<Step>(1);
  const [examDate, setExamDate] = useState("");
  const [hoursPerWeek, setHoursPerWeek] = useState(5);
  const [preferredDays, setPreferredDays] = useState<string[]>([]);
  const [domainPriorities, setDomainPriorities] = useState<Record<string, number>>(
    Object.fromEntries(NPE_DOMAINS.map((domain) => [domain, 2])),
  );

  const canSubmit = useMemo(() => Boolean(examDate), [examDate]);

  return (
    <div className="space-y-4 rounded-3xl border bg-card p-6">
      <h1 className="text-3xl">Build Your Study Plan</h1>

      {errorCode ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {errorCode === "auth_required"
            ? "This action needs a real signed-in session. If preview mode is active, sign in with your email and password, then try again."
            : errorCode === "schema_not_ready"
              ? "Study Plan tables are not ready in Supabase yet. Apply the SQL migrations (001, 002, 003) in your Supabase project, then refresh and try again."
              : errorCode === "not_authorized"
                ? "Your account is signed in, but database permissions blocked this save. Confirm this email is in approved_users with status 'approved'."
            : "Could not save your plan. Please check all fields and try again."}
        </p>
      ) : null}

      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span className={step === 1 ? "text-primary" : ""}>Step 1 Exam date</span>
        <span>•</span>
        <span className={step === 2 ? "text-primary" : ""}>Step 2 Study capacity</span>
        <span>•</span>
        <span className={step === 3 ? "text-primary" : ""}>Step 3 Domain priorities</span>
      </div>

      <form action={action} className="space-y-4">
        {step === 1 ? (
          <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
            <label className="grid gap-1 text-sm">
              <span>When is your NPE exam?</span>
              <input
                type="date"
                name="exam_date"
                value={examDate}
                onChange={(event) => setExamDate(event.target.value)}
                className="h-10 rounded-md border bg-background px-3"
                required
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {EXAM_WINDOWS.map((window) => {
                const quickDate = `${window.start[0]}-${String(window.start[1]).padStart(2, "0")}-${String(window.start[2]).padStart(2, "0")}`;
                return (
                  <button
                    key={window.label}
                    type="button"
                    onClick={() => setExamDate(quickDate)}
                    className="rounded-full border bg-background px-3 py-1 text-xs"
                  >
                    {window.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
            <label className="grid gap-2 text-sm">
              <span>How many hours per week can you study?</span>
              <input
                type="range"
                min={1}
                max={20}
                value={hoursPerWeek}
                onChange={(event) => setHoursPerWeek(Number(event.target.value))}
              />
              <span className="text-xs text-muted-foreground">{hoursPerWeek} hrs/week</span>
            </label>

            <div>
              <p className="text-sm">Which days work best?</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {DAYS.map((day) => {
                  const checked = preferredDays.includes(day);
                  return (
                    <label key={day} className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setPreferredDays((previous) =>
                            checked ? previous.filter((item) => item !== day) : [...previous, day],
                          );
                        }}
                      />
                      {day}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
            <p className="text-sm">Rate each domain from 1 (confident) to 3 (need work).</p>
            <div className="space-y-2">
              {NPE_DOMAINS.map((domain) => (
                <div key={domain} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background p-2">
                  <p className="text-sm">{domain}</p>
                  <div className="flex gap-2">
                    {[1, 2, 3].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          setDomainPriorities((previous) => ({
                            ...previous,
                            [domain]: value,
                          }))
                        }
                        className={`h-8 w-8 rounded-full border text-sm ${
                          domainPriorities[domain] === value ? "bg-primary text-primary-foreground" : "bg-card"
                        }`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <input type="hidden" name="hours_per_week" value={hoursPerWeek} />
        <input type="hidden" name="preferred_days" value={JSON.stringify(preferredDays)} />
        <input type="hidden" name="domain_priorities" value={JSON.stringify(domainPriorities)} />

        <div className="flex flex-wrap gap-2">
          {step > 1 ? (
            <button type="button" onClick={() => setStep((prev) => (prev - 1) as Step)} className="rounded-md border px-3 py-2 text-sm">
              Back
            </button>
          ) : null}
          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((prev) => (prev + 1) as Step)}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Continue
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              Generate plan
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
