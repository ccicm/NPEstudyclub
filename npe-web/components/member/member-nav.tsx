"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLink = {
  href: string;
  label: string;
};

type Props = {
  links: NavLink[];
};

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MemberNav({ links }: Props) {
  const pathname = usePathname();

  return (
    <nav className="mt-4 flex flex-wrap gap-2">
      {links.map((link) => {
        const active = isActive(pathname, link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
              active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
            aria-current={active ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
