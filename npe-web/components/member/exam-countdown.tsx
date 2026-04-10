"use client";

import Link from "next/link";
import { EXAM_WINDOWS, windowToDates } from "@/lib/exam-windows";

function getTimelineWindow(now: Date) {
  const current = EXAM_WINDOWS.find((window) => {
    const { start, end } = windowToDates(window);
    return now >= start && now <= end;
  });

  if (current) {
    return { window: current, status: "open" as const };
  }

  const upcoming = EXAM_WINDOWS.find((window) => {
    const registrationOpen = new Date(window.registrationOpen[0], window.registrationOpen[1] - 1, window.registrationOpen[2]);
    return now < registrationOpen;
  });

  if (upcoming) {
    return { window: upcoming, status: "upcoming" as const };
  }

  const lastWindow = EXAM_WINDOWS[EXAM_WINDOWS.length - 1] ?? null;
  if (!lastWindow) {
    return { window: null, status: "none" as const };
  }

  return { window: lastWindow, status: "past" as const };
}

function formatDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function parseDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function findWindowForDate(targetDate: Date) {
  return (
    EXAM_WINDOWS.find((window) => {
      const { start, end } = windowToDates(window);
      return targetDate >= start && targetDate <= end;
    }) ?? null
  );
}

export function ExamCountdown({ studyPlanExamDate = null }: { studyPlanExamDate?: string | null }) {
  const now = new Date();
  const personalExamDate = parseDate(studyPlanExamDate);
  const personalWindow = personalExamDate ? findWindowForDate(personalExamDate) : null;
  const timeline = getTimelineWindow(now);
  const activeWindow = personalWindow ?? timeline.window;

  if (!activeWindow) {
    return (
      <section className="rounded-3xl bg-primary p-5 text-primary-foreground shadow-sm md:p-6">
        <h1 className="text-3xl">NPE Timeline</h1>
        <p className="mt-2 text-sm text-primary-foreground/90">No exam windows are configured yet.</p>
      </section>
    );
  }

  const registrationOpen = new Date(
    activeWindow.registrationOpen[0],
    activeWindow.registrationOpen[1] - 1,
    activeWindow.registrationOpen[2],
  );
  const { start, end } = windowToDates(activeWindow);

  return (
    <section className="rounded-3xl bg-primary p-5 text-primary-foreground shadow-sm md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
            {activeWindow.label}
          </span>
          <h1 className="mt-3 text-3xl">{personalExamDate ? "Your exam timeline" : "NPE Timeline"}</h1>
          <p className="mt-1 text-sm text-primary-foreground/90">
            {personalExamDate
              ? "Based on the exam date you set in your study plan."
              : "Key dates for planning, not a countdown clock."}
          </p>
        </div>
        <Link href="/schedule" className="text-sm underline underline-offset-4">
          View in schedule
        </Link>
      </div>

      {personalExamDate ? (
        <div className="mt-5 rounded-xl bg-white/15 px-4 py-3 text-sm">
          <p className="font-semibold">Your exam date</p>
          <p>{formatDate(personalExamDate)}</p>
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 text-sm md:max-w-2xl">
        <div className="grid grid-cols-[170px_1fr] items-center rounded-xl bg-white/15 px-4 py-3">
          <p className="font-semibold">Registrations open</p>
          <p>{formatDate(registrationOpen)}</p>
        </div>
        <div className="grid grid-cols-[170px_1fr] items-center rounded-xl bg-white/15 px-4 py-3">
          <p className="font-semibold">Exam window opens</p>
          <p>{formatDate(start)}</p>
        </div>
        <div className="grid grid-cols-[170px_1fr] items-center rounded-xl bg-white/15 px-4 py-3">
          <p className="font-semibold">Exam window closes</p>
          <p>{formatDate(end)}</p>
        </div>
      </div>

      {timeline.status === "open" ? (
        <p className="mt-3 text-sm font-medium">The current exam sitting window is open.</p>
      ) : timeline.status === "upcoming" ? (
        <p className="mt-3 text-sm font-medium">This is the next scheduled exam window.</p>
      ) : (
        <p className="mt-3 text-sm font-medium">This is the latest configured exam window. Update dates as new windows are published.</p>
      )}
    </section>
  );
}
