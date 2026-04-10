import ical from "ical-generator";
import { EXAM_WINDOWS, windowToDates } from "@/lib/exam-windows";
import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type ExportSession = {
  title: string | null;
  session_type: string;
  scheduled_at: string;
  description: string | null;
  video_link: string | null;
};

type ExportWeek = {
  id: string;
  week_start: string;
  domain_focus: string;
  suggested_quiz_id: string | null;
  suggested_resource_id: string | null;
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function studyBlockDates(weekStartRaw: string, preferredDays: string[]) {
  const weekStart = new Date(weekStartRaw);
  const dates: Date[] = [];

  for (let i = 0; i < 7; i += 1) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    const dayName = DAY_NAMES[date.getDay()];
    if (preferredDays.includes(dayName)) {
      dates.push(date);
    }
  }

  return dates;
}

export async function generateUserCalendarIcs(args: {
  supabase: SupabaseServerClient;
  userId: string;
  origin: string;
}) {
  const { supabase, userId, origin } = args;

  const [{ data: sessions }, { data: plan }] = await Promise.all([
    supabase
      .from("sessions")
      .select("title,session_type,scheduled_at,description,video_link")
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(100),
    supabase.from("study_plans").select("id,preferred_days").eq("user_id", userId).maybeSingle(),
  ]);

  const { data: studyWeeks } = plan
    ? await supabase
        .from("study_plan_weeks")
        .select("id,week_start,domain_focus,suggested_resource_id,suggested_quiz_id")
        .eq("plan_id", plan.id)
        .order("week_start", { ascending: true })
    : { data: [] as ExportWeek[] };

  const preferredDays = (plan?.preferred_days ?? []) as string[];
  const cal = ical({
    name: "NPE Study Club",
    prodId: "//NPE Study Club//Calendar Export//EN",
  });

  ((sessions ?? []) as ExportSession[]).forEach((session) => {
    const start = new Date(session.scheduled_at);
    if (Number.isNaN(start.getTime())) {
      return;
    }

    const end = new Date(start);
    end.setHours(end.getHours() + 1);

    cal.createEvent({
      start,
      end,
      summary: session.title || "Study session",
      description: [
        `Type: ${session.session_type}`,
        session.description || "",
        session.video_link ? `Video call: ${session.video_link}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      url: session.video_link || undefined,
    });
  });

  (studyWeeks ?? []).forEach((week) => {
    const dates = studyBlockDates(week.week_start, preferredDays);

    dates.forEach((date) => {
      const start = new Date(date);
      start.setHours(19, 0, 0, 0);
      const end = new Date(start);
      end.setHours(end.getHours() + 1);

      cal.createEvent({
        start,
        end,
        summary: `Study: ${week.domain_focus}`,
        description: [
          `Domain focus: ${week.domain_focus}`,
          week.suggested_resource_id ? `Suggested resource: ${origin}/resources` : "",
          week.suggested_quiz_id ? `Suggested quiz: ${origin}/quizzes/${week.suggested_quiz_id}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      });
    });
  });

  EXAM_WINDOWS.forEach((window) => {
    const { start, end } = windowToDates(window);
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endExclusive = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1);
    const registrationOpen = new Date(window.registrationOpen[0], window.registrationOpen[1] - 1, window.registrationOpen[2]);

    cal.createEvent({
      start: startDay,
      end: endExclusive,
      allDay: true,
      summary: `NPE ${window.label} exam window`,
      description: `Registrations open ${registrationOpen.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })}`,
    });
  });

  return cal.toString();
}
