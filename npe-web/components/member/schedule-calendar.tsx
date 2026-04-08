"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { EXAM_WINDOWS, windowToDates } from "@/lib/exam-windows";

type Session = {
  id: string;
  title: string | null;
  session_type: string;
  scheduled_at: string;
  description: string | null;
  meet_link: string | null;
};

type DayEvent =
  | {
      kind: "session";
      id: string;
      title: string;
      sessionType: string;
      at: Date;
      description: string | null;
      meetLink: string | null;
    }
  | {
      kind: "window";
      id: string;
      label: string;
      reg: string;
    };

function monthMatrix(viewDate: Date) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const first = new Date(year, month, 1);
  const shift = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - shift);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function eventPillClass(event: DayEvent) {
  if (event.kind === "window") return "bg-amber-100 text-amber-700";
  return event.sessionType === "Ad-hoc" ? "bg-primary/15 text-primary" : "bg-slate-800 text-slate-100";
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TOPICS = [
  "Assessment",
  "Intervention",
  "Formulation",
  "Ethics & law",
  "Psychopathology",
  "Lifespan development",
  "Research & stats",
  "Professional practice",
  "Peer revision",
  "Other",
];

export function ScheduleCalendar({
  sessions,
  addSessionAction,
}: {
  sessions: Session[];
  addSessionAction: (formData: FormData) => Promise<void>;
}) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [showForm, setShowForm] = useState(false);
  const [topic, setTopic] = useState(TOPICS[0]);

  const allEvents = useMemo(() => {
    const eventsByDay = new Map<string, DayEvent[]>();

    const addEvent = (key: string, event: DayEvent) => {
      const existing = eventsByDay.get(key) ?? [];
      existing.push(event);
      eventsByDay.set(key, existing);
    };

    sessions.forEach((session) => {
      const at = new Date(session.scheduled_at);
      addEvent(dateKey(at), {
        kind: "session",
        id: session.id,
        title: session.title || "Study session",
        sessionType: session.session_type,
        at,
        description: session.description,
        meetLink: session.meet_link,
      });
    });

    EXAM_WINDOWS.forEach((window) => {
      const { start, end } = windowToDates(window);
      const cursor = new Date(start);
      while (cursor <= end) {
        addEvent(dateKey(cursor), {
          kind: "window",
          id: `${window.label}-${dateKey(cursor)}`,
          label: window.label,
          reg: window.reg,
        });
        cursor.setDate(cursor.getDate() + 1);
      }
    });

    return eventsByDay;
  }, [sessions]);

  const visibleDays = useMemo(() => monthMatrix(viewDate), [viewDate]);
  const selectedEvents = selectedDate ? allEvents.get(dateKey(selectedDate)) ?? [] : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Schedule</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
            className="rounded-md border bg-card p-2"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="min-w-36 text-center text-sm font-semibold">
            {viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </p>
          <button
            type="button"
            onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
            className="rounded-md border bg-card p-2"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setViewDate(new Date())} className="rounded-md border bg-card px-3 py-2 text-xs">
            Today
          </button>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-3 md:p-4">
        <div className="grid grid-cols-7 gap-2 pb-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {WEEKDAYS.map((day) => (
            <p key={day}>{day}</p>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {visibleDays.map((day) => {
            const key = dateKey(day);
            const dayEvents = allEvents.get(key) ?? [];
            const inMonth = day.getMonth() === viewDate.getMonth();
            const isToday = key === dateKey(new Date());
            const selected = selectedDate ? key === dateKey(selectedDate) : false;

            return (
              <button
                type="button"
                key={key}
                onClick={() => setSelectedDate(day)}
                className={`min-h-24 rounded-xl border p-2 text-left transition ${
                  selected ? "border-primary bg-primary/5" : "bg-background"
                } ${inMonth ? "opacity-100" : "opacity-40"}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${isToday ? "ring-2 ring-primary" : ""}`}>
                    {day.getDate()}
                  </span>
                </div>
                <div className="mt-1 flex flex-col gap-1">
                  {dayEvents.slice(0, 2).map((event) => (
                    <span key={event.id} className={`truncate rounded-full px-2 py-0.5 text-[10px] ${eventPillClass(event)}`}>
                      {event.kind === "window" ? "NPE" : event.sessionType}
                    </span>
                  ))}
                  {dayEvents.length > 2 ? (
                    <span className="text-[10px] text-muted-foreground">+{dayEvents.length - 2} more</span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <h2 className="text-xl">
          {selectedDate
            ? selectedDate.toLocaleDateString(undefined, {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })
            : "Select a day"}
        </h2>
        {!selectedEvents.length ? (
          <p className="mt-2 text-sm text-muted-foreground">No events on this day.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {selectedEvents.map((event) => (
              <article key={event.id} className="rounded-xl border bg-background p-3">
                {event.kind === "window" ? (
                  <>
                    <p className="font-semibold">NPE {event.label} window open</p>
                    <p className="text-sm text-muted-foreground">{event.reg}</p>
                    <a href="https://www.ahpra.gov.au" target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm underline">
                      APS/AHPRA exam info
                    </a>
                  </>
                ) : (
                  <>
                    <p className="font-semibold">{event.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {event.at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · {event.sessionType}
                    </p>
                    {event.description ? <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{event.description}</p> : null}
                    {event.meetLink ? (
                      <a href={event.meetLink} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm underline">
                        Join Google Meet
                      </a>
                    ) : null}
                  </>
                )}
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <button type="button" onClick={() => setShowForm((previous) => !previous)} className="text-sm font-semibold text-primary">
          {showForm ? "Hide session form" : "+ Add session"}
        </button>

        {showForm ? (
          <form action={addSessionAction} className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span>Your name *</span>
              <input name="host_name" required className="h-10 rounded-md border bg-background px-3" />
            </label>
            <label className="grid gap-1 text-sm">
              <span>Date *</span>
              <input name="date" type="date" required className="h-10 rounded-md border bg-background px-3" />
            </label>
            <label className="grid gap-1 text-sm">
              <span>Time</span>
              <input name="time" type="time" defaultValue="19:00" className="h-10 rounded-md border bg-background px-3" />
            </label>
            <label className="grid gap-1 text-sm">
              <span>Topic</span>
              <select
                name="topic"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                className="h-10 rounded-md border bg-background px-3"
              >
                {TOPICS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            {topic === "Other" ? (
              <label className="grid gap-1 text-sm md:col-span-2">
                <span>Other topic</span>
                <input name="topic_other" className="h-10 rounded-md border bg-background px-3" required />
              </label>
            ) : null}

            <label className="grid gap-1 text-sm md:col-span-2">
              <span>Notes</span>
              <textarea name="notes" className="min-h-24 rounded-md border bg-background px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm md:col-span-2">
              <span>Google Meet link</span>
              <input name="meet_link" type="url" className="h-10 rounded-md border bg-background px-3" />
            </label>
            <div className="md:col-span-2">
              <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                Save session
              </button>
            </div>
          </form>
        ) : null}
      </div>

      <section className="rounded-2xl border bg-card p-4">
        <h2 className="text-xl">Upcoming sessions list</h2>
        <div className="mt-3 space-y-2">
          {sessions.length ? (
            sessions.map((session) => (
              <div key={session.id} className="rounded-xl bg-muted/40 p-3 text-sm">
                <p className="font-semibold">{session.title || "Session"}</p>
                <p className="text-muted-foreground">
                  {new Date(session.scheduled_at).toLocaleString()} · {session.session_type}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No upcoming sessions yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
