import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ScheduleCalendar } from "@/components/member/schedule-calendar";
import { addAdHocSession } from "./actions";

export default async function SchedulePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: sessions } = await supabase
    .from("sessions")
    .select("id,title,session_type,scheduled_at,description,video_link,created_by")
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(50);

  const { data: studyPlan } = user
    ? await supabase.from("study_plans").select("id,preferred_days").eq("user_id", user.id).maybeSingle()
    : { data: null };

  const { data: studyPlanWeeks } = studyPlan
    ? await supabase
        .from("study_plan_weeks")
        .select("id,week_start,domain_focus")
        .eq("plan_id", studyPlan.id)
        .order("week_start", { ascending: true })
    : { data: null };

  const weeksWithDays = (studyPlanWeeks ?? []).map((week) => ({
    ...week,
    preferred_days: studyPlan?.preferred_days ?? [],
  }));

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <a href="/schedule/export" className="rounded-md border bg-card px-3 py-2 text-sm font-semibold">
          Download .ics
        </a>
      </div>
      {user && !studyPlan ? (
        <section className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">Set up your study plan to personalise this calendar.</p>
          <p className="mt-2">Your preferred study blocks will appear here once the plan is created.</p>
          <Link href="/study-plan" className="mt-3 inline-block underline">
            Create your study plan
          </Link>
        </section>
      ) : null}
      <ScheduleCalendar
        sessions={sessions ?? []}
        studyPlanWeeks={weeksWithDays}
        userId={user?.id ?? null}
        addSessionAction={addAdHocSession}
      />
    </div>
  );
}
