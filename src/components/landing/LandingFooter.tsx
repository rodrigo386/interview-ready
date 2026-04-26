import Link from "next/link";
import { Logo } from "@/components/Logo";

const PRODUTO = [
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#para-quem", label: "Para quem" },
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

const CONTA = [
  { href: "/login", label: "Entrar" },
  { href: "/signup", label: "Começar grátis" },
  { href: "/pricing", label: "Planos" },
];

export function LandingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-neutral-200 bg-bg dark:border-zinc-800">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]">
          <div>
            <Logo variant="horizontal" size={28} />
            <p className="mt-4 max-w-xs text-sm leading-[1.55] text-text-secondary">
              Coach de carreira com IA. Em 20 minutos, dossiê completo da sua próxima vaga.
            </p>
          </div>
          <FooterColumn title="Produto" links={PRODUTO} />
          <FooterColumn title="Conta" links={CONTA} />
          <FooterColumn title="Empresa" links={EMPRESA} />
          <FooterColumn title="Legal" links={LEGAL} />
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-neutral-200 pt-6 text-xs text-text-tertiary md:flex-row md:items-center dark:border-zinc-800">
          <p>
            © {year} PrepaVAGA · IAgentics — Feito com{" "}
            <span aria-hidden className="text-brand-600">
              ♥
            </span>{" "}
            no Brasil.
          </p>
          <p className="font-medium">prepavaga.com.br</p>
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
      <ul className="mt-4 space-y-2.5">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="text-sm text-text-secondary transition hover:text-text-primary"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
