import Link from "next/link";

export type SidebarItemStatus = "ready" | "generating" | "failed" | "pending";

export type SidebarItem = {
  id: string;
  icon: string;
  label: string;
  status: SidebarItemStatus;
  href: string;
};

const statusDot: Record<SidebarItemStatus, string> = {
  ready: "bg-emerald-500",
  generating: "bg-blue-500 animate-pulse",
  failed: "bg-red-500",
  pending: "bg-zinc-500/50",
};

const statusLabel: Record<SidebarItemStatus, string> = {
  ready: "Pronto",
  generating: "Gerando",
  failed: "Falhou",
  pending: "Pendente",
};

export function PrepSidebar({
  items,
  activeId,
}: {
  items: SidebarItem[];
  activeId: string;
}) {
  return (
    <nav
      aria-label="Navegação do prep"
      className="md:sticky md:top-6 md:h-[calc(100vh-3rem)]"
    >
      <ul className="flex gap-2 overflow-x-auto pb-2 md:flex-col md:gap-1 md:overflow-visible md:pb-0">
        {items.map((item) => {
          const isActive = item.id === activeId;
          return (
            <li key={item.id} className="shrink-0 md:shrink">
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-brand-600 text-white"
                    : "text-text-secondary hover:bg-surface-muted hover:text-text-primary"
                }`}
              >
                <span aria-hidden className="text-base leading-none">
                  {item.icon}
                </span>
                <span className="flex-1 whitespace-nowrap md:whitespace-normal">
                  {item.label}
                </span>
                <span
                  aria-label={statusLabel[item.status]}
                  title={statusLabel[item.status]}
                  className={`h-2 w-2 shrink-0 rounded-full ${statusDot[item.status]}`}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
