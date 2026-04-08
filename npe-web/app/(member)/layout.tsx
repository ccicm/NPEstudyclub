import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { isApprovedMember } from "@/lib/access";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/resources", label: "Resources" },
  { href: "/schedule", label: "Schedule" },
  { href: "/community", label: "Community" },
  { href: "/add", label: "Add resource" },
  { href: "/profile", label: "Profile" },
];

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { approved, user } = await isApprovedMember();

  if (!user) {
    redirect("/auth/login");
  }

  if (!approved) {
    redirect("/auth/request-status");
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-6 md:px-8">
      <header className="rounded-2xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">NPE Study Club</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
          <LogoutButton />
        </div>
        <nav className="mt-4 flex flex-wrap gap-2">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
              {link.label}
            </Link>
          ))}
        </nav>
      </header>
      <div className="mt-6">{children}</div>
    </main>
  );
}
