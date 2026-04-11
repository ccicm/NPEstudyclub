/**
 * npe-taxonomy.ts
 * Single source of truth for NPE exam domains, subdomains, and UI colour tokens.
 *
 * Resources use a separate taxonomy (lib/resource-options.ts) — do not mix.
 * All quiz, study-plan, and community features should import from here.
 */

// ── Domains ──────────────────────────────────────────────────────────────────

export const NPE_DOMAINS = [
  { id: "ethics",        label: "Ethics",        fullLabel: "Ethics & Professional Practice", domain_number: 1 },
  { id: "assessment",    label: "Assessment",    fullLabel: "Assessment",                      domain_number: 2 },
  { id: "interventions", label: "Interventions", fullLabel: "Interventions",                   domain_number: 3 },
  { id: "communication", label: "Communication", fullLabel: "Communication & Consultation",    domain_number: 4 },
] as const;

export type DomainId = typeof NPE_DOMAINS[number]["id"];

// Canonical label strings — use these when writing to the DB or displaying to members.
export const DOMAIN_LABELS: Record<DomainId, string> = {
  ethics:        "Ethics",
  assessment:    "Assessment",
  interventions: "Interventions",
  communication: "Communication",
};

// ── Domain lookup ─────────────────────────────────────────────────────────────

// Maps any known variant/alias → canonical DomainId.
// Add aliases here as new data sources introduce new spellings.
const DOMAIN_ALIAS_MAP: Record<string, DomainId> = {
  // ethics
  "ethics":                          "ethics",
  "ethics & professional practice":  "ethics",
  "ethics & law":                    "ethics",
  "ethics and law":                  "ethics",
  "ethic":                           "ethics",

  // assessment
  "assessment":                      "assessment",

  // interventions
  "interventions":                   "interventions",
  "intervention":                    "interventions",

  // communication
  "communication":                   "communication",
  "communication & consultation":    "communication",
  "communication and consultation":  "communication",
};

/**
 * Resolve any domain string to a canonical DomainId.
 * Returns null for unrecognised strings — callers should handle this gracefully.
 *
 * Replaces the ad-hoc normalizeDomain() / normalizeDomainKey() pattern.
 */
export function domainId(raw: string | null | undefined): DomainId | null {
  const key = (raw ?? "").trim().toLowerCase();
  return DOMAIN_ALIAS_MAP[key] ?? null;
}

/** Canonical display label for a domain id. */
export function domainLabel(id: DomainId): string {
  return DOMAIN_LABELS[id];
}

/** Domain number (1–4) for a domain id. */
export function domainNumber(id: DomainId): number {
  return NPE_DOMAINS.find((d) => d.id === id)?.domain_number ?? 0;
}

// ── Subdomains (curriculum sequence) ─────────────────────────────────────────
// Order within each array is intentional — reflects curriculum progression used
// by the study plan and weekly focus quiz selector (§5c).

export const NPE_SUBDOMAINS: Record<DomainId, readonly string[]> = {
  ethics: [
    "Duty of care",
    "Confidentiality",
    "Dual relationships",
    "Mandatory reporting",
    "Professional boundaries",
    "Informed consent",
    "Record keeping",
  ],
  assessment: [
    "Psychometric selection",
    "Cultural considerations",
    "Report writing",
    "Risk assessment",
    "Cognitive assessment",
    "Diagnostic formulation",
  ],
  interventions: [
    "CBT",
    "ACT",
    "Trauma-informed care",
    "Psychoeducation",
    "Relapse prevention",
    "Crisis intervention",
    "Supervision",
  ],
  communication: [
    "Referral pathways",
    "Interdisciplinary collaboration",
    "Consumer communication",
    "Advocacy",
  ],
};

// ── UI colour tokens (Tailwind utility classes) ───────────────────────────────
// Kept here so all surfaces stay visually consistent without duplicating strings.
// Import domainColour() rather than the map directly.

export const DOMAIN_COLOURS: Record<
  DomainId,
  { bg: string; text: string; border: string; stripe: string }
> = {
  ethics:        { bg: "bg-purple-50",  text: "text-purple-700",  border: "border-purple-200",  stripe: "bg-purple-400"  },
  assessment:    { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200",    stripe: "bg-blue-400"    },
  interventions: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", stripe: "bg-emerald-400" },
  communication: { bg: "bg-orange-50",  text: "text-orange-700",  border: "border-orange-200",  stripe: "bg-orange-400"  },
};

const FALLBACK_COLOUR = {
  bg: "bg-muted",
  text: "text-muted-foreground",
  border: "border-border",
  stripe: "bg-border",
};

/**
 * Return Tailwind colour tokens for any domain string.
 * Falls back gracefully for unrecognised or null values.
 */
export function domainColour(label: string | null | undefined) {
  const id = domainId(label);
  return id ? DOMAIN_COLOURS[id] : FALLBACK_COLOUR;
}

// ── Study tips (used by study plan) ──────────────────────────────────────────
// Moved here from lib/study-plan.ts so tips use canonical domain ids.

export const DOMAIN_STUDY_TIPS: Record<DomainId, string> = {
  ethics:
    "Build a one-page decision tree for common ethical dilemmas and legal thresholds. Practice duty-of-care scenarios under time pressure.",
  assessment:
    "Use timed case vignettes and practise identifying the minimum clinically important information. Focus on test selection rationale.",
  interventions:
    "Rehearse intervention rationales out loud to improve retrieval under exam pressure. Practise matching modality to presentation.",
  communication:
    "Review referral pathways, interdisciplinary scope, and consumer communication standards using scenario prompts.",
};
