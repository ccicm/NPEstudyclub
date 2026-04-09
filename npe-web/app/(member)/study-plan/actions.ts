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

  const { data: existingPlan } = await supabase
    .from("study_plans")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingPlan) {
    const { data: existingWeeks } = await supabase
      .from("study_plan_weeks")
      .select("id")
      .eq("plan_id", existingPlan.id);

    const weekIds = (existingWeeks ?? []).map((week) => week.id);

    if (weekIds.length) {
      await supabase.from("study_log").delete().in("plan_week_id", weekIds);
      await supabase.from("study_plan_weeks").delete().in("id", weekIds);
    }

    await supabase.from("study_plans").delete().eq("id", existingPlan.id);
  }

  const { data: plan, error: planError } = await supabase
    .from("study_plans")
    .insert({
      user_id: user.id,
      exam_date: examDate.toISOString().slice(0, 10),
      hours_per_week: hoursPerWeek,
      preferred_days: preferredDays,
      domain_priorities: domainPriorities,
    })
    .select("id")
    .single();

  if (planError || !plan) {
    const message = String(planError?.message || "").toLowerCase();
    if (
      message.includes("does not exist") ||
      message.includes("undefined table") ||
      message.includes("undefined column")
    ) {
      redirect("/study-plan?error=schema_not_ready");
    }
    if (message.includes("row-level security") || message.includes("permission denied")) {
      redirect("/study-plan?error=not_authorized");
    }
    redirect("/study-plan?error=create_failed");
  }

  const weeks = generateWeeks({
    examDate,
    domainPriorities,
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
      const message = String(weeksError.message || "").toLowerCase();
      if (
        message.includes("does not exist") ||
        message.includes("undefined table") ||
        message.includes("undefined column")
      ) {
        redirect("/study-plan?error=schema_not_ready");
      }
      if (message.includes("row-level security") || message.includes("permission denied")) {
        redirect("/study-plan?error=not_authorized");
      }
      redirect("/study-plan?error=create_failed");
    }
  }

  revalidatePath("/study-plan");
  redirect("/study-plan");
}

export async function logStudyTimeAction(formData: FormData) {
  const planWeekId = String(formData.get("plan_week_id") || "").trim();
  const hoursRaw = String(formData.get("hours") || "1").trim();
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

  await supabase.from("study_log").insert({
    user_id: user.id,
    plan_week_id: planWeekId,
    hours_logged: hours,
  });

  const { data: week } = await supabase
    .from("study_plan_weeks")
    .select("id,plan_id")
    .eq("id", planWeekId)
    .maybeSingle();

  if (week) {
    const [{ data: plan }, { data: logs }] = await Promise.all([
      supabase.from("study_plans").select("hours_per_week").eq("id", week.plan_id).maybeSingle(),
      supabase.from("study_log").select("hours_logged").eq("plan_week_id", week.id),
    ]);

    const totalLogged = (logs ?? []).reduce((sum, row) => sum + Number(row.hours_logged || 0), 0);
    const target = plan?.hours_per_week ?? 5;

    await supabase
      .from("study_plan_weeks")
      .update({ status: totalLogged >= target ? "complete" : "in_progress" })
      .eq("id", week.id);
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
    return;
  }

  await supabase
    .from("study_plans")
    .update({
      exam_date: examDate.toISOString().slice(0, 10),
      hours_per_week: hoursPerWeek,
      domain_priorities: domainPriorities,
      updated_at: new Date().toISOString(),
    })
    .eq("id", plan.id);

  const { data: existingWeeks } = await supabase
    .from("study_plan_weeks")
    .select("id,week_number,status,week_start")
    .eq("plan_id", plan.id)
    .order("week_number", { ascending: true });

  const completedWeeks = (existingWeeks ?? []).filter((week) => week.status === "complete");
  const removableWeeks = (existingWeeks ?? []).filter((week) => week.status !== "complete");

  if (removableWeeks.length) {
    await supabase
      .from("study_plan_weeks")
      .delete()
      .in(
        "id",
        removableWeeks.map((week) => week.id),
      );
  }

  const suggestionMaps = await loadSuggestionMaps(supabase);

  const newWeeks = generateWeeks({
    examDate,
    domainPriorities,
    startDate: new Date(),
    startingWeekNumber: completedWeeks.length + 1,
    maxWeeks: undefined,
    suggestionMaps,
  });

  if (newWeeks.length) {
    await supabase.from("study_plan_weeks").insert(
      newWeeks.map((week) => ({
        plan_id: plan.id,
        ...week,
      })),
    );
  }

  revalidatePath("/study-plan");
}
