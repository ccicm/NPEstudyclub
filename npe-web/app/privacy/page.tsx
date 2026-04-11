import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <h1 className="text-3xl">Privacy Policy</h1>
      <p className="mt-3 text-sm text-muted-foreground">Last updated: 8 April 2026</p>

      <section className="mt-6 space-y-3 text-sm text-muted-foreground">
        <p>
          NPE Study Club collects personal information to operate a private study community for provisional
          psychologists preparing for the National Psychology Exam.
        </p>
        <p>
          Information we collect can include your name, email address, AHPRA registration details, request notes,
          profile display name, community posts, quiz activity, and study progress.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm text-muted-foreground">
        <h2 className="text-xl text-foreground">Why information is collected</h2>
        <p>
          We use your information to review access requests, verify community membership, provide member features,
          personalise study tracking, and maintain safety and moderation in the community.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm text-muted-foreground">
        <h2 className="text-xl text-foreground">Storage and security</h2>
        <p>
          Data is stored on secure infrastructure with encrypted connections. Access to admin-only data is restricted.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm text-muted-foreground">
        <h2 className="text-xl text-foreground">Disclosure</h2>
        <p>
          Personal information is not sold. It is only disclosed to service providers required to run the platform,
          such as hosting, authentication, and database infrastructure.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm text-muted-foreground">
        <h2 className="text-xl text-foreground">Access, correction, and deletion</h2>
        <p>
          You can request access to, correction of, or deletion of your personal information by contacting the study
          group organiser.
        </p>
        <p>
          Members can also manage key account settings from the profile area and can use account deletion features as
          they become available.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm text-muted-foreground">
        <h2 className="text-xl text-foreground">Questions</h2>
        <p>
          If you have privacy questions, contact the organiser directly through the community channel or request form
          follow-up.
        </p>
      </section>

      <p className="mt-10 text-sm">
        <Link href="/" className="underline">
          Return to home
        </Link>
      </p>
    </main>
  );
}
