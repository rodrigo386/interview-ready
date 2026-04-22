"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ThemeToggle";

const NAV_LINKS = [
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#precos", label: "Preços" },
  { href: "#faq", label: "FAQ" },
];

export function LandingNavbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 h-16 border-b border-border bg-white/80 backdrop-blur-md dark:bg-zinc-950/80">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
        <Link href="/" aria-label="PrepaVaga — início">
          <Logo variant="horizontal" size={28} />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 md:flex" aria-label="Principal">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-text-secondary hover:text-text-primary"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Entrar
            </Button>
          </Link>
          <Link href="/signup">
            <Button variant="primary" size="sm">
              Começar grátis
            </Button>
          </Link>
        </div>

        {/* Mobile menu button */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-text-primary"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="border-t border-border bg-bg md:hidden">
          <nav
            className="mx-auto flex max-w-6xl flex-col gap-1 px-6 py-4"
            aria-label="Principal mobile"
          >
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-2 text-sm font-medium text-text-secondary hover:bg-surface-muted hover:text-text-primary"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-border pt-4">
              <Link href="/login" onClick={() => setOpen(false)}>
                <Button variant="secondary" size="md" className="w-full">
                  Entrar
                </Button>
              </Link>
              <Link href="/signup" onClick={() => setOpen(false)}>
                <Button variant="primary" size="md" className="w-full">
                  Começar grátis
                </Button>
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
