import { StudyPlanDashboard } from "@/components/member/study-plan-dashboard";
import { StudyPlanOnboarding } from "@/components/member/study-plan-onboarding";
import { createClient } from "@/lib/supabase/server";
import { createStudyPlanAction, logStudyTimeAction, updateStudyPlanAction } from "./actions";

export default async function StudyPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: plan } = await supabase
    .from("study_plans")
    .select("id,exam_date,hours_per_week,domain_priorities")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!plan) {
    return <StudyPlanOnboarding action={createStudyPlanAction} errorCode={params.error || null} />;
  }

  const { data: weeks } = await supabase
    .from("study_plan_weeks")
    .select("id,week_number,week_start,domain_focus,suggested_resource_id,suggested_quiz_id,status")
    .eq("plan_id", plan.id)
    .order("week_number", { ascending: true });

  const weekIds = (weeks ?? []).map((week) => week.id);

  const { data: logs } = weekIds.length
    ? await supabase.from("study_log").select("plan_week_id,hours_logged").eq("user_id", user.id).in("plan_week_id", weekIds)
    : { data: [] as Array<{ plan_week_id: string; hours_logged: number }> };

  const hoursByWeek = (logs ?? []).reduce<Record<string, number>>((accumulator, log) => {
    accumulator[log.plan_week_id] = (accumulator[log.plan_week_id] ?? 0) + Number(log.hours_logged || 0);
    return accumulator;
  }, {});

  const resourceIds = (weeks ?? [])
    .map((week) => week.suggested_resource_id)
    .filter((id): id is string => Boolean(id));
  const quizIds = (weeks ?? [])
    .map((week) => week.suggested_quiz_id)
    .filter((id): id is string => Boolean(id));

  const [{ data: resources }, { data: quizzes }] = await Promise.all([
    resourceIds.length
      ? supabase.from("resources").select("id,title").in("id", resourceIds)
      : Promise.resolve({ data: [] as Array<{ id: string; title: string }> }),
    quizIds.length
      ? supabase.from("quizzes").select("id,title").in("id", quizIds)
      : Promise.resolve({ data: [] as Array<{ id: string; title: string }> }),
  ]);

  return (
    <StudyPlanDashboard
      plan={{
        exam_date: plan.exam_date,
        hours_per_week: plan.hours_per_week,
        domain_priorities: (plan.domain_priorities as Record<string, number>) || {},
      }}
      weeks={(weeks ?? []) as Array<{
        id: string;
        week_number: number;
        week_start: string;
        domain_focus: string;
        suggested_resource_id: string | null;
        suggested_quiz_id: string | null;
        status: "upcoming" | "in_progress" | "complete";
      }>}
      hoursByWeek={hoursByWeek}
      resources={resources ?? []}
      quizzes={quizzes ?? []}
      logStudyTimeAction={logStudyTimeAction}
      updateStudyPlanAction={updateStudyPlanAction}
    />
  );
}
