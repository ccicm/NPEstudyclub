export const RESOURCE_CATEGORIES = ["All", "Exam Prep", "Clinical Practice"] as const;

export const EXAM_PREP_DOMAINS = [
  "Assessment",
  "Intervention",
  "Formulation",
  "Ethics & law",
  "Psychopathology",
  "Lifespan development",
  "Research & stats",
  "Professional practice",
  "Other",
] as const;

export const CLINICAL_MODALITIES = [
  "CBT",
  "ACT",
  "DBT",
  "Schema therapy",
  "Motivational interviewing",
  "Psychodynamic",
  "Integrative / eclectic",
  "Other",
] as const;

export const CLINICAL_POPULATIONS = [
  "Adults",
  "Children",
  "Adolescents",
  "Older adults",
  "Couples/families",
  "Mixed / not specified",
  "Other",
] as const;

export const CONTENT_TYPES = [
  "Case study",
  "Worksheet / tool",
  "Summary / notes",
  "Guideline / framework",
  "Research article",
  "Textbook chapter",
  "Practice exam",
  "Other",
] as const;

export const NPE_DOMAINS = EXAM_PREP_DOMAINS.filter((domain) => domain !== "Other");
