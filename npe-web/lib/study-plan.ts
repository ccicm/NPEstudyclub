export const STUDY_TIPS: Record<string, string> = {
  Assessment: "Use timed case vignettes and practice identifying the minimum clinically important information.",
  Intervention: "Rehearse intervention rationales out loud to improve retrieval under exam pressure.",
  Formulation: "Practice 5Ps formulations with strict time limits and compare to model answers.",
  "Ethics & law": "Build a one-page decision tree for common ethical dilemmas and legal thresholds.",
  Psychopathology: "Cluster disorders by distinguishing features and practice differential diagnosis drills.",
  "Lifespan development": "Map developmental milestones to common presenting concerns by age band.",
  "Research & stats": "Do short daily interpretation drills for effect sizes, confidence intervals, and designs.",
  "Professional practice": "Review role boundaries, scope, and supervision standards using scenario prompts.",
};

export type DomainPriorities = Record<string, number>;

export function normalizeDomain(domain: string | null | undefined) {
  return (domain ?? "").trim().toLowerCase();
}

export function parseDomainPriorities(raw: string): DomainPriorities {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result: DomainPriorities = {};
    Object.entries(parsed).forEach(([domain, value]) => {
      const numeric = Number(value);
      if (!Number.isNaN(numeric) && numeric >= 1 && numeric <= 3) {
        result[domain] = numeric;
      }
    });
    return result;
  } catch {
    return {};
  }
}

export function parsePreferredDays(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  } catch {
    return [];
  }
}

export function startOfWeek(date: Date) {
  const result = new Date(date);
  const offset = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - offset);
  result.setHours(0, 0, 0, 0);
  return result;
}
