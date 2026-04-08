import { createClient } from "@/lib/supabase/server";
import { ScheduleCalendar } from "@/components/member/schedule-calendar";
import { addAdHocSession } from "./actions";

export default async function SchedulePage() {
  const supabase = await createClient();

  const { data: sessions } = await supabase
    .from("sessions")
    .select("id,title,session_type,scheduled_at,description,video_link")
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(50);

  return <ScheduleCalendar sessions={sessions ?? []} addSessionAction={addAdHocSession} />;
}
