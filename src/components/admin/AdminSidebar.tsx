"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV: { href: string; label: string; icon: string }[] = [
  { href: "/admin", label: "Visão geral", icon: "▦" },
  { href: "/admin/users", label: "Usuários", icon: "◯" },
  { href: "/admin/metrics", label: "Métricas", icon: "◢" },
  { href: "/admin/payments", label: "Pagamentos", icon: "◈" },
  { href: "/admin/preps", label: "Preps", icon: "◤" },
  { href: "/admin/health", label: "Saúde", icon: "◐" },
];

export function AdminSidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-56 shrink-0 border-r border-neutral-200 bg-bg lg:block dark:border-zinc-800">
      <nav className="sticky top-14 flex flex-col gap-0.5 p-3">
        {NAV.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition " +
                (active
                  ? "bg-brand-50 font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-500"
                  : "text-text-secondary hover:bg-neutral-100 hover:text-text-primary dark:hover:bg-zinc-900")
              }
            >
              <span aria-hidden className="text-base leading-none">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function AdminMobileNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Admin nav"
      className="flex gap-1 overflow-x-auto border-b border-neutral-200 bg-bg px-3 py-2 lg:hidden dark:border-zinc-800"
    >
      {NAV.map((item) => {
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium " +
              (active
                ? "bg-brand-600 text-white"
                : "border border-neutral-200 text-text-secondary dark:border-zinc-800")
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
