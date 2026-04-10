import Link from "next/link";

const permittedItems = [
  "Hypothetical or composite case questions framed for exam prep.",
  "NPE exam technique, question interpretation, and study strategy.",
  "Resource sharing and recommendations.",
  "Study schedule coordination and accountability check-ins.",
  "General questions about provisional practice, supervision pathways, and AHPRA registration.",
  "Broad framework discussions (for example consent, boundaries, and ethics principles).",
];

const prohibitedItems = [
  "Any real client information, including details that could identify a person indirectly.",
  "Placement, school, or organization details tied to clinical context.",
  "Supervisor or colleague identifying details shared in case discussion.",
  "Screenshots or excerpts from case notes, assessments, or clinical records.",
  "Posts that are effectively live case consultation disguised as a hypothetical.",
  "Defamatory or accusatory discussion about individuals or organizations.",
];

export default function CommunityGuidelinesPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border bg-card p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Community Guidelines</p>
        <h1 className="mt-2 text-3xl leading-tight md:text-4xl">Exam prep discussion only</h1>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground md:text-base">
          This forum supports a small cohort of provisional psychologists preparing for the NPE. Keep posts focused on
          study and exam preparation. Do not share client, student, or placement-identifying information, even if
          de-identified.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link href="/community" className="rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground">
            Back to Community
          </Link>
          <Link href="/community?channel=clinical-practice" className="rounded-md border bg-background px-4 py-2 font-semibold">
            Open Hypothetical Cases Channel
          </Link>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border bg-card p-5">
          <h2 className="text-2xl">Permitted</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {permittedItems.map((item) => (
              <li key={item} className="rounded-xl bg-muted/30 px-3 py-2">
                {item}
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl border bg-card p-5">
          <h2 className="text-2xl">Not Permitted</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {prohibitedItems.map((item) => (
              <li key={item} className="rounded-xl bg-destructive/5 px-3 py-2">
                {item}
              </li>
            ))}
          </ul>
        </article>
      </section>
    </div>
  );
}