"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EXAM_WINDOWS, windowToDates } from "@/lib/exam-windows";

type CountdownState = {
  label: string;
  reg: string;
  status: "upcoming" | "open" | "none";
  diffMs: number;
};

function getCountdownState(now: Date): CountdownState {
  for (const window of EXAM_WINDOWS) {
    const { start, end } = windowToDates(window);

    if (now < start) {
      return {
        label: window.label,
        reg: window.reg,
        status: "upcoming",
        diffMs: start.getTime() - now.getTime(),
      };
    }

    if (now >= start && now <= end) {
      return {
        label: window.label,
        reg: window.reg,
        status: "open",
        diffMs: end.getTime() - now.getTime(),
      };
    }
  }

  return {
    label: "No upcoming window",
    reg: "Watch for updated exam dates",
    status: "none",
    diffMs: 0,
  };
}

function parts(diffMs: number) {
  const totalMinutes = Math.max(0, Math.floor(diffMs / 60000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  return { days, hours, minutes };
}

export function ExamCountdown() {
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60000);

    return () => window.clearInterval(timer);
  }, []);

  const state = useMemo(() => getCountdownState(now), [now]);
  const remaining = parts(state.diffMs);

  return (
    <section className="rounded-3xl bg-primary p-5 text-primary-foreground shadow-sm md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
            {state.label}
          </span>
          <h1 className="mt-3 text-3xl">NPE Countdown</h1>
          <p className="mt-1 text-sm text-primary-foreground/90">{state.reg}</p>
        </div>
        <Link href="/schedule" className="text-sm underline underline-offset-4">
          View in schedule
        </Link>
      </div>

      {state.status === "none" ? (
        <p className="mt-4 text-sm">No upcoming exam windows scheduled.</p>
      ) : (
        <div className="mt-5 grid grid-cols-3 gap-3 text-center md:max-w-md">
          <div className="rounded-xl bg-white/15 p-3">
            <p className="text-2xl font-semibold">{remaining.days}</p>
            <p className="text-xs uppercase tracking-wide text-primary-foreground/85">Days</p>
          </div>
          <div className="rounded-xl bg-white/15 p-3">
            <p className="text-2xl font-semibold">{remaining.hours}</p>
            <p className="text-xs uppercase tracking-wide text-primary-foreground/85">Hours</p>
          </div>
          <div className="rounded-xl bg-white/15 p-3">
            <p className="text-2xl font-semibold">{remaining.minutes}</p>
            <p className="text-xs uppercase tracking-wide text-primary-foreground/85">Minutes</p>
          </div>
        </div>
      )}

      {state.status === "open" ? (
        <p className="mt-3 text-sm font-medium">NPE window is open now.</p>
      ) : null}
    </section>
  );
}
