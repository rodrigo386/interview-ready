import Link from "next/link";
import { Logo } from "@/components/Logo";

const PRODUTO = [
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#precos", label: "Preços" },
  { href: "#faq", label: "FAQ" },
];

const EMPRESA = [
  { href: "/sobre", label: "Sobre" },
  { href: "/blog", label: "Blog" },
  { href: "/contato", label: "Contato" },
];

const LEGAL = [
  { href: "/termos", label: "Termos de uso" },
  { href: "/privacidade", label: "Privacidade" },
  { href: "/lgpd", label: "LGPD" },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <Logo variant="horizontal" size={28} />
            <p className="mt-4 text-sm text-text-secondary">
              Seu coach de carreira com IA.
              <br />
              © 2026 IAgentics.
            </p>
          </div>
          <FooterColumn title="Produto" links={PRODUTO} />
          <FooterColumn title="Empresa" links={EMPRESA} />
          <FooterColumn title="Legal" links={LEGAL} />
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
        {title}
      </h3>
      <ul className="mt-4 space-y-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="text-sm text-text-secondary hover:text-text-primary"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
