"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

type NavLink = { href: string; label: string; route?: boolean };

const NAV_LINKS: NavLink[] = [
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#para-quem", label: "Para quem" },
  { href: "#precos", label: "Preços" },
  { href: "/artigos", label: "Artigos", route: true },
];

export function LandingNavbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 h-14 border-b border-neutral-200 bg-bg/85 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
        <Link href="/" aria-label="PrepaVAGA, ir para o início" className="flex items-center">
          <Logo variant="horizontal" size={26} />
        </Link>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Principal">
          {NAV_LINKS.map((l) =>
            l.route ? (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm text-text-secondary transition hover:text-text-primary"
              >
                {l.label}
              </Link>
            ) : (
              <a
                key={l.href}
                href={l.href}
                className="text-sm text-text-secondary transition hover:text-text-primary"
              >
                {l.label}
              </a>
            ),
          )}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <ThemeToggle />
          <Link
            href="/login"
            className="text-sm font-medium text-text-secondary hover:text-text-primary"
          >
            Entrar
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition hover:bg-brand-700"
          >
            Começar grátis
          </Link>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-neutral-200 text-text-primary dark:border-zinc-800"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-neutral-200 bg-bg md:hidden dark:border-zinc-800">
          <nav
            className="mx-auto flex max-w-6xl flex-col gap-1 px-6 py-4"
            aria-label="Principal mobile"
          >
            {NAV_LINKS.map((l) =>
              l.route ? (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-md px-2 py-2 text-sm text-text-secondary hover:bg-neutral-100 hover:text-text-primary dark:hover:bg-zinc-900"
                >
                  {l.label}
                </Link>
              ) : (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-md px-2 py-2 text-sm text-text-secondary hover:bg-neutral-100 hover:text-text-primary dark:hover:bg-zinc-900"
                >
                  {l.label}
                </a>
              ),
            )}
            <div className="mt-2 flex flex-col gap-2 border-t border-neutral-200 pt-4 dark:border-zinc-800">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="rounded-md border border-neutral-200 px-3 py-2 text-center text-sm font-medium text-text-primary dark:border-zinc-800"
              >
                Entrar
              </Link>
              <Link
                href="/signup"
                onClick={() => setOpen(false)}
                className="rounded-full bg-brand-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-brand-700"
              >
                Começar grátis
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
