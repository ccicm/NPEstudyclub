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
    ? await supabase.from("study_plans").select("id").eq("user_id", user.id).maybeSingle()
    : { data: null };

  const { data: studyPlanWeeks } = studyPlan
    ? await supabase
        .from("study_plan_weeks")
        .select("id,week_start,preferred_days,domain_focus")
        .eq("study_plan_id", studyPlan.id)
        .order("week_start", { ascending: true })
    : { data: null };

  return (
    <ScheduleCalendar
      sessions={sessions ?? []}
      studyPlanWeeks={studyPlanWeeks ?? []}
      userId={user?.id ?? null}
      addSessionAction={addAdHocSession}
    />
  );
}
