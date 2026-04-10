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
  video_link: string | null;
  created_by?: string | null;
};

type StudyPlanWeek = {
  id: string;
  week_start: string;
  preferred_days: string[] | string;
  domain_focus: string;
};

type DayEvent =
  | {
      kind: "session";
      id: string;
      title: string;
      sessionType: string;
      at: Date;
      description: string | null;
      videoLink: string | null;
      createdBy: string | null;
    }
  | {
      kind: "studyBlock";
      id: string;
      title: string;
      domainFocus: string;
      at: Date;
      sessionType: "Study plan";
    }
  | {
      kind: "window";
      id: string;
      label: string;
      registrationInfo: string;
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
  if (event.kind === "studyBlock") return "bg-violet-100 text-violet-700";
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
  studyPlanWeeks = [],
  userId = null,
  addSessionAction,
}: {
  sessions: Session[];
  studyPlanWeeks?: StudyPlanWeek[];
  userId?: string | null;
  addSessionAction: (formData: FormData) => Promise<void>;
}) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [filter, setFilter] = useState<"all" | "group" | "adhoc" | "studyplan" | "mine">("all");
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
        videoLink: session.video_link,
        createdBy: session.created_by ?? null,
      });
    });

    studyPlanWeeks.forEach((week) => {
      const weekStart = new Date(week.week_start);
      const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const preferredDays = Array.isArray(week.preferred_days)
        ? week.preferred_days
        : String(week.preferred_days || "")
            .split(",")
            .map((day) => day.trim())
            .filter(Boolean);

      for (let i = 0; i < 7; i += 1) {
        const dayDate = new Date(weekStart);
        dayDate.setDate(weekStart.getDate() + i);
        const dayName = daysOfWeek[dayDate.getDay()];

        if (preferredDays.includes(dayName)) {
          addEvent(dateKey(dayDate), {
            kind: "studyBlock",
            id: `study-${week.id}-${i}`,
            title: `Study: ${week.domain_focus}`,
            domainFocus: week.domain_focus,
            at: dayDate,
            sessionType: "Study plan",
          });
        }
      }
    });

    EXAM_WINDOWS.forEach((window) => {
      const { start, end } = windowToDates(window);
      const registrationOpen = new Date(window.registrationOpen[0], window.registrationOpen[1] - 1, window.registrationOpen[2]);
      const cursor = new Date(start);
      while (cursor <= end) {
        addEvent(dateKey(cursor), {
          kind: "window",
          id: `${window.label}-${dateKey(cursor)}`,
          label: window.label,
          registrationInfo: `Registrations open ${registrationOpen.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}`,
        });
        cursor.setDate(cursor.getDate() + 1);
      }
    });

    return eventsByDay;
  }, [sessions, studyPlanWeeks]);

  const filteredEvents = useMemo(() => {
    const result = new Map<string, DayEvent[]>();

    for (const [date, events] of allEvents.entries()) {
      const filtered = events.filter((event) => {
        if (event.kind === "window") return true;
        if (filter === "all") return true;
        if (filter === "group") return event.kind === "session" && event.sessionType !== "Ad-hoc";
        if (filter === "adhoc") return event.kind === "session" && event.sessionType === "Ad-hoc";
        if (filter === "studyplan") return event.kind === "studyBlock";
        if (filter === "mine") return event.kind === "session" && event.createdBy === userId;
        return false;
      });

      if (filtered.length > 0) {
        result.set(date, filtered);
      }
    }

    return result;
  }, [allEvents, filter, userId]);

  const visibleDays = useMemo(() => monthMatrix(viewDate), [viewDate]);
  const selectedEvents = selectedDate ? filteredEvents.get(dateKey(selectedDate)) ?? [] : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Schedule</h1>
        <div className="flex gap-2 flex-wrap">
          {(["all", "group", "adhoc", "studyplan", "mine"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                filter === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {value === "all"
                ? "All"
                : value === "group"
                  ? "Group"
                  : value === "adhoc"
                    ? "Ad-hoc"
                    : value === "studyplan"
                      ? "My study plan"
                      : "My sessions"}
            </button>
          ))}
        </div>
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

        <div className="mt-4 flex flex-wrap gap-4 text-sm md:col-span-7">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-slate-800"></div>
            <span className="text-muted-foreground">Group session</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-primary/15"></div>
            <span className="text-muted-foreground">Ad-hoc</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-violet-100"></div>
            <span className="text-muted-foreground">My study plan</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-amber-100"></div>
            <span className="text-muted-foreground">NPE exam window</span>
          </div>
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
            const dayEvents = filteredEvents.get(key) ?? [];
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
                      {event.kind === "window" ? "NPE" : event.kind === "studyBlock" ? "Study" : event.sessionType}
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
                    <p className="text-sm text-muted-foreground">{event.registrationInfo}</p>
                    <a href="https://www.ahpra.gov.au" target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm underline">
                      APS/AHPRA exam info
                    </a>
                  </>
                ) : event.kind === "studyBlock" ? (
                  <>
                    <p className="font-semibold">{event.title}</p>
                    <p className="text-sm text-muted-foreground">{event.sessionType}</p>
                    <p className="mt-2 text-sm text-muted-foreground">Domain focus: {event.domainFocus}</p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold">{event.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {event.at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · {event.sessionType}
                    </p>
                    {event.description ? <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{event.description}</p> : null}
                    {event.videoLink ? (
                      <a href={event.videoLink} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm underline">
                        Open video call link
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
            <label className="grid gap-1 text-sm">
              <span>Session type</span>
              <select name="session_type" defaultValue="Ad-hoc" className="h-10 rounded-md border bg-background px-3">
                <option value="Group">Group session</option>
                <option value="Ad-hoc">Ad-hoc</option>
                <option value="Personal">Personal study</option>
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
              <span>Video call link</span>
              <input
                name="video_link"
                type="url"
                placeholder="https://zoom.us/j/... or any video call link"
                className="h-10 rounded-md border bg-background px-3"
              />
            </label>
            <div className="md:col-span-2">
              <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                Save session
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}
