"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeDomain,
  parseDomainPriorities,
  parsePreferredDays,
  startOfWeek,
  type DomainPriorities,
} from "@/lib/study-plan";

type SuggestionMaps = {
  resourcesByDomain: Map<string, string[]>;
  quizzesByDomain: Map<string, string[]>;
};

function classifyStudyPlanError(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes("duplicate key value") || lower.includes("unique constraint")) {
    return "save_conflict";
  }

  if (
    lower.includes("does not exist") ||
    lower.includes("undefined table") ||
    lower.includes("undefined column")
  ) {
    return "schema_not_ready";
  }

  if (lower.includes("row-level security") || lower.includes("permission denied")) {
    return "not_authorized";
  }

  return "save_failed";
}

async function loadSuggestionMaps(supabase: Awaited<ReturnType<typeof createClient>>): Promise<SuggestionMaps> {
  const [{ data: resources }, { data: quizzes }] = await Promise.all([
    supabase.from("resources").select("id,domain"),
    supabase.from("quizzes").select("id,domain"),
  ]);

  const resourcesByDomain = new Map<string, string[]>();
  (resources ?? []).forEach((resource) => {
    const key = normalizeDomain(resource.domain);
    if (!key) return;
    const current = resourcesByDomain.get(key) ?? [];
    current.push(resource.id);
    resourcesByDomain.set(key, current);
  });

  const quizzesByDomain = new Map<string, string[]>();
  (quizzes ?? []).forEach((quiz) => {
    const key = normalizeDomain(quiz.domain);
    if (!key) return;
    const current = quizzesByDomain.get(key) ?? [];
    current.push(quiz.id);
    quizzesByDomain.set(key, current);
  });

  return { resourcesByDomain, quizzesByDomain };
}

type QuizResultWithDomain = {
  score: number;
  total_questions: number;
  quizzes: { domain?: string } | { domain?: string }[] | null;
};

async function loadDomainPerformance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<Map<string, number>> {
  const fromQuestionPerformance = new Map<string, number>();

  const { data: performanceRows, error: performanceError } = await supabase
    .from("user_performance")
    .select("domain_label,attempts,correct_responses")
    .eq("user_id", userId);

  if (!performanceError && performanceRows?.length) {
    const totals = new Map<string, { correct: number; attempts: number }>();

    performanceRows.forEach((row) => {
      const key = normalizeDomain(row.domain_label);
      if (!key) {
        return;
      }

      const current = totals.get(key) ?? { correct: 0, attempts: 0 };
      current.correct += Number(row.correct_responses || 0);
      current.attempts += Number(row.attempts || 0);
      totals.set(key, current);
    });

    totals.forEach((value, domain) => {
      if (value.attempts > 0) {
        fromQuestionPerformance.set(domain, (value.correct / value.attempts) * 100);
      }
    });

    if (fromQuestionPerformance.size > 0) {
      return fromQuestionPerformance;
    }
  }

  const { data } = await supabase
    .from("quiz_results")
    .select("score,total_questions,quizzes(domain)")
    .eq("user_id", userId);

  const totals = new Map<string, { score: number; total: number }>();

  ((data ?? []) as QuizResultWithDomain[]).forEach((result) => {
    const quizRelation = Array.isArray(result.quizzes) ? result.quizzes[0] : result.quizzes;
    const domain = normalizeDomain(quizRelation?.domain);
    if (!domain || !result.total_questions) {
      return;
    }

    const current = totals.get(domain) ?? { score: 0, total: 0 };
    current.score += Number(result.score || 0);
    current.total += Number(result.total_questions || 0);
    totals.set(domain, current);
  });

  const performance = new Map<string, number>();
  totals.forEach((value, domain) => {
    performance.set(domain, value.total > 0 ? (value.score / value.total) * 100 : 0);
  });

  return performance;
}

function applyQuizPerformanceAdjustments(
  domainPriorities: DomainPriorities,
  domainPerformance: Map<string, number>,
): DomainPriorities {
  const adjusted: DomainPriorities = { ...domainPriorities };

  Object.entries(adjusted).forEach(([domain, priority]) => {
    const normalized = normalizeDomain(domain);
    const score = domainPerformance.get(normalized);
    if (typeof score !== "number") {
      return;
    }

    let boosted = priority;
    if (score < 45) {
      boosted += 2;
    } else if (score < 60) {
      boosted += 1;
    }

    adjusted[domain] = Math.max(1, Math.min(3, boosted));
  });

  return adjusted;
}

function buildDomainPool(domainPriorities: DomainPriorities) {
  const entries = Object.entries(domainPriorities)
    .filter(([, priority]) => priority >= 1 && priority <= 3)
    .sort((left, right) => right[1] - left[1]);

  if (!entries.length) {
    return [] as string[];
  }

  const pool: string[] = [];

  entries.forEach(([domain, priority]) => {
    const repeats = priority === 3 ? 2 : 1;
    for (let i = 0; i < repeats; i += 1) {
      pool.push(domain);
    }
  });

  return pool;
}

function generateWeeks(args: {
  examDate: Date;
  domainPriorities: DomainPriorities;
  startingWeekNumber: number;
  startDate: Date;
  maxWeeks?: number;
  suggestionMaps: SuggestionMaps;
}) {
  const { examDate, domainPriorities, startDate, maxWeeks, startingWeekNumber, suggestionMaps } = args;
  const today = new Date();
  const effectiveStart = new Date(Math.max(today.getTime(), startDate.getTime()));
  const msDiff = examDate.getTime() - effectiveStart.getTime();
  const weekSpan = Math.max(1, Math.ceil(msDiff / (1000 * 60 * 60 * 24 * 7)));
  const weeksToBuild = maxWeeks ? Math.max(1, Math.min(maxWeeks, weekSpan)) : weekSpan;

  const domainPool = buildDomainPool(domainPriorities);
  if (!domainPool.length) {
    return [] as Array<{
      week_number: number;
      week_start: string;
      domain_focus: string;
      suggested_resource_id: string | null;
      suggested_quiz_id: string | null;
      status: "upcoming";
    }>;
  }

  const firstWeekStart = startOfWeek(effectiveStart);

  return Array.from({ length: weeksToBuild }, (_, index) => {
    const domain = domainPool[index % domainPool.length];
    const domainKey = normalizeDomain(domain);
    const resourceOptions = suggestionMaps.resourcesByDomain.get(domainKey) ?? [];
    const quizOptions = suggestionMaps.quizzesByDomain.get(domainKey) ?? [];

    const weekStart = new Date(firstWeekStart);
    weekStart.setDate(firstWeekStart.getDate() + index * 7);

    return {
      week_number: startingWeekNumber + index,
      week_start: weekStart.toISOString().slice(0, 10),
      domain_focus: domain,
      suggested_resource_id: resourceOptions.length ? resourceOptions[index % resourceOptions.length] : null,
      suggested_quiz_id: quizOptions.length ? quizOptions[index % quizOptions.length] : null,
      status: "upcoming" as const,
    };
  });
}

export async function createStudyPlanAction(formData: FormData) {
  const examDateRaw = String(formData.get("exam_date") || "").trim();
  const hoursRaw = String(formData.get("hours_per_week") || "5").trim();
  const prioritiesRaw = String(formData.get("domain_priorities") || "{}").trim();
  const daysRaw = String(formData.get("preferred_days") || "[]").trim();

  if (!examDateRaw) {
    redirect("/study-plan?error=missing_exam_date");
  }

  const examDate = new Date(examDateRaw);
  if (Number.isNaN(examDate.getTime())) {
    redirect("/study-plan?error=invalid_exam_date");
  }
  const hoursPerWeek = Math.max(1, Math.min(20, Number(hoursRaw) || 5));
  const domainPriorities = parseDomainPriorities(prioritiesRaw);
  const preferredDays = parsePreferredDays(daysRaw);

  if (!Object.keys(domainPriorities).length) {
    redirect("/study-plan?error=missing_priorities");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/study-plan?error=auth_required");
  }

  const suggestionMaps = await loadSuggestionMaps(supabase);
  const domainPerformance = await loadDomainPerformance(supabase, user.id);
  const adjustedPriorities = applyQuizPerformanceAdjustments(domainPriorities, domainPerformance);

  const planPayload = {
    user_id: user.id,
    exam_date: examDate.toISOString().slice(0, 10),
    hours_per_week: hoursPerWeek,
    preferred_days: preferredDays,
    domain_priorities: adjustedPriorities,
    updated_at: new Date().toISOString(),
  };

  const { data: plan, error: planError } = await supabase
    .from("study_plans")
    .upsert(planPayload, { onConflict: "user_id" })
    .select("id")
    .single();

  if (planError || !plan) {
    const errorCode = classifyStudyPlanError(String(planError?.message || ""));
    redirect(`/study-plan?error=${errorCode}`);
  }

  const { data: existingWeeks } = await supabase
    .from("study_plan_weeks")
    .select("id")
    .eq("plan_id", plan.id);

  const existingWeekIds = (existingWeeks ?? []).map((week) => week.id);

  const weeks = generateWeeks({
    examDate,
    domainPriorities: adjustedPriorities,
    startDate: new Date(),
    startingWeekNumber: 1,
    suggestionMaps,
  });

  if (weeks.length) {
    const { error: weeksError } = await supabase.from("study_plan_weeks").insert(
      weeks.map((week) => ({
        plan_id: plan.id,
        ...week,
      })),
    );

    if (weeksError) {
      const errorCode = classifyStudyPlanError(String(weeksError.message || ""));
      redirect(`/study-plan?error=${errorCode}`);
    }

    if (existingWeekIds.length) {
      const { error: logDeleteError } = await supabase.from("study_log").delete().in("plan_week_id", existingWeekIds);
      if (logDeleteError) {
        const errorCode = classifyStudyPlanError(String(logDeleteError.message || ""));
        redirect(`/study-plan?error=${errorCode}`);
      }

      const { error: weekDeleteError } = await supabase.from("study_plan_weeks").delete().in("id", existingWeekIds);
      if (weekDeleteError) {
        const errorCode = classifyStudyPlanError(String(weekDeleteError.message || ""));
        redirect(`/study-plan?error=${errorCode}`);
      }
    }
  }

  revalidatePath("/study-plan");
  redirect("/study-plan");
}

export async function logStudyTimeAction(formData: FormData) {
  const planWeekId = String(formData.get("plan_week_id") || "").trim();
  const hoursRaw = String(formData.get("hours") || "1").trim();
  const topicsCovered = String(formData.get("topics_covered") || "").trim();
  const quizInsight = String(formData.get("quiz_insight") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  const hours = Math.max(0.1, Math.min(20, Number(hoursRaw) || 1));

  if (!planWeekId) {
    return;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/study-plan?error=auth_required");
  }

  const { error: logError } = await supabase.from("study_log").insert({
    user_id: user.id,
    plan_week_id: planWeekId,
    hours_logged: hours,
    topics_covered: topicsCovered || null,
    quiz_insight: quizInsight || null,
    notes: notes || null,
  });

  if (logError) {
    const errorCode = classifyStudyPlanError(String(logError.message || ""));
    redirect(`/study-plan?error=${errorCode}`);
  }

  const { data: week } = await supabase
    .from("study_plan_weeks")
    .select("id,plan_id")
    .eq("id", planWeekId)
    .maybeSingle();

  if (week) {
    const [{ data: plan }, { data: logs }] = await Promise.all([
      supabase.from("study_plans").select("hours_per_week").eq("id", week.plan_id).maybeSingle(),
      supabase.from("study_log").select("hours_logged,topics_covered,quiz_insight,notes").eq("plan_week_id", week.id),
    ]);

    const totalLogged = (logs ?? []).reduce((sum, row) => sum + Number(row.hours_logged || 0), 0);
    const target = plan?.hours_per_week ?? 5;

    const { error: statusError } = await supabase
      .from("study_plan_weeks")
      .update({ status: totalLogged >= target ? "complete" : "in_progress" })
      .eq("id", week.id);

    if (statusError) {
      const errorCode = classifyStudyPlanError(String(statusError.message || ""));
      redirect(`/study-plan?error=${errorCode}`);
    }
  }

  revalidatePath("/study-plan");
}

export async function updateStudyPlanAction(formData: FormData) {
  const examDateRaw = String(formData.get("exam_date") || "").trim();
  const hoursRaw = String(formData.get("hours_per_week") || "5").trim();

  if (!examDateRaw) {
    return;
  }

  const examDate = new Date(examDateRaw);
  if (Number.isNaN(examDate.getTime())) {
    redirect("/study-plan?error=invalid_exam_date");
  }
  const hoursPerWeek = Math.max(1, Math.min(20, Number(hoursRaw) || 5));
  const domainPriorities: DomainPriorities = {};

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("priority_")) {
      continue;
    }
    const domain = key.replace("priority_", "");
    const numeric = Number(String(value));
    if (!domain || Number.isNaN(numeric)) {
      continue;
    }
    domainPriorities[domain] = Math.max(1, Math.min(3, numeric));
  }

  if (!Object.keys(domainPriorities).length) {
    return;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/study-plan?error=auth_required");
  }

  const { data: plan } = await supabase
    .from("study_plans")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!plan) {
    redirect("/study-plan?error=save_failed");
  }

  const { data: existingWeeks } = await supabase
    .from("study_plan_weeks")
    .select("id,week_number,status,week_start")
    .eq("plan_id", plan.id)
    .order("week_number", { ascending: true });

  const completedWeeks = (existingWeeks ?? []).filter((week) => week.status === "complete");
  const removableWeeks = (existingWeeks ?? []).filter((week) => week.status !== "complete");

  const suggestionMaps = await loadSuggestionMaps(supabase);
  const domainPerformance = await loadDomainPerformance(supabase, user.id);
  const adjustedPriorities = applyQuizPerformanceAdjustments(domainPriorities, domainPerformance);

  const newWeeks = generateWeeks({
    examDate,
    domainPriorities: adjustedPriorities,
    startDate: new Date(),
    startingWeekNumber: completedWeeks.length + 1,
    maxWeeks: undefined,
    suggestionMaps,
  });

  if (newWeeks.length) {
    const { error: insertError } = await supabase.from("study_plan_weeks").insert(
      newWeeks.map((week) => ({
        plan_id: plan.id,
        ...week,
      })),
    );

    if (insertError) {
      const errorCode = classifyStudyPlanError(String(insertError.message || ""));
      redirect(`/study-plan?error=${errorCode}`);
    }

    if (removableWeeks.length) {
      const { error: deleteError } = await supabase
        .from("study_plan_weeks")
        .delete()
        .in(
          "id",
          removableWeeks.map((week) => week.id),
        );

      if (deleteError) {
        const errorCode = classifyStudyPlanError(String(deleteError.message || ""));
        redirect(`/study-plan?error=${errorCode}`);
      }
    }
  }

  const { error: updateError } = await supabase
    .from("study_plans")
    .update({
      exam_date: examDate.toISOString().slice(0, 10),
      hours_per_week: hoursPerWeek,
      domain_priorities: adjustedPriorities,
      updated_at: new Date().toISOString(),
    })
    .eq("id", plan.id);

  if (updateError) {
    const errorCode = classifyStudyPlanError(String(updateError.message || ""));
    redirect(`/study-plan?error=${errorCode}`);
  }

  revalidatePath("/study-plan");
}

export async function resetStudyPlanAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/study-plan?error=auth_required");
  }

  const { data: plan } = await supabase
    .from("study_plans")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!plan) {
    redirect("/study-plan");
  }

  const { data: weeks } = await supabase
    .from("study_plan_weeks")
    .select("id")
    .eq("plan_id", plan.id);

  const weekIds = (weeks ?? []).map((week) => week.id);
  if (weekIds.length) {
    const { error: logDeleteError } = await supabase.from("study_log").delete().in("plan_week_id", weekIds);
    if (logDeleteError) {
      const errorCode = classifyStudyPlanError(String(logDeleteError.message || ""));
      redirect(`/study-plan?error=${errorCode}`);
    }

    const { error: weekDeleteError } = await supabase.from("study_plan_weeks").delete().in("id", weekIds);
    if (weekDeleteError) {
      const errorCode = classifyStudyPlanError(String(weekDeleteError.message || ""));
      redirect(`/study-plan?error=${errorCode}`);
    }
  }

  const { error: planDeleteError } = await supabase.from("study_plans").delete().eq("id", plan.id);
  if (planDeleteError) {
    const errorCode = classifyStudyPlanError(String(planDeleteError.message || ""));
    redirect(`/study-plan?error=${errorCode}`);
  }

  revalidatePath("/study-plan");
  revalidatePath("/dashboard");
  revalidatePath("/schedule");
  redirect("/study-plan");
}
