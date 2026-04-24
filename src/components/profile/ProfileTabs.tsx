"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/profile", label: "Perfil" },
  { href: "/profile/cvs", label: "CVs" },
  { href: "/profile/account", label: "Conta" },
] as const;

export function ProfileTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Seções do perfil" className="border-b border-border">
      <ul role="tablist" className="flex gap-1">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`inline-block px-4 py-3 text-sm font-medium transition-colors ${
                  active
                    ? "border-b-2 border-brand-600 text-text-primary"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
