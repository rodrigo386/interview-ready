import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { requireAdmin } from "@/lib/admin/auth";
import { AdminSidebar, AdminMobileNav } from "@/components/admin/AdminSidebar";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-bg dark:border-zinc-800">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Link href="/admin" aria-label="Admin · PrepaVAGA">
              <Logo variant="horizontal" size={26} />
            </Link>
            <span className="rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-700 dark:border-brand-900 dark:bg-brand-900/30 dark:text-brand-500">
              Admin
            </span>
          </div>
          <nav className="flex items-center gap-5 text-sm">
            <Link
              href="/dashboard"
              className="text-text-secondary hover:text-text-primary"
            >
              Voltar ao painel
            </Link>
            <ThemeToggle />
            <span className="hidden text-xs text-text-tertiary sm:inline">{admin.email}</span>
          </nav>
        </div>
      </header>
      <AdminMobileNav />
      <div className="mx-auto flex max-w-7xl">
        <AdminSidebar />
        <main className="min-w-0 flex-1 px-6 py-10">{children}</main>
      </div>
    </div>
  );
}
