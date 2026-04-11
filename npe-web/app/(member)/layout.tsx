import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { MemberNav } from "@/components/member/member-nav";
import { isApprovedMember } from "@/lib/access";

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { approved, user, bypassed } = await isApprovedMember();

  if (!user) {
    redirect("/auth/login");
  }

  if (!approved) {
    redirect("/auth/request-status");
  }

  const baseLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/resources", label: "Resources" },
    { href: "/quizzes", label: "Quizzes" },
    { href: "/study-plan", label: "Study Plan" },
    { href: "/schedule", label: "Schedule" },
    { href: "/community", label: "Community" },
    { href: "/profile", label: "Profile" },
  ];

  const adminEmails = (process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const userEmail = user.email?.toLowerCase() || "";
  const links = adminEmails.includes(userEmail)
    ? [...baseLinks, { href: "/admin", label: "Admin" }]
    : baseLinks;

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-6 md:px-8">
      <header className="rounded-3xl border bg-card p-4 shadow-sm md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">NPE Study Club</p>
            <p className="text-sm text-muted-foreground">Approved member area · {user.email}</p>
          </div>
          <LogoutButton />
        </div>
        <MemberNav links={links} />
        {bypassed ? (
          <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Limited-access testing is active. Some actions (like saving a study plan) require a regular email sign-in session.
          </p>
        ) : null}
      </header>
      <div className="mt-6">{children}</div>
    </main>
  );
}
