import type { ReactNode } from "react";
import Link from "next/link";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://prepavaga.com.br";

export function LegalLayout({
  title,
  path,
  updatedAt,
  children,
}: {
  title: string;
  path: string;
  updatedAt: string;
  children: ReactNode;
}) {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: SITE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: title,
        item: `${SITE_URL}${path}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <LandingNavbar />
      <main className="bg-bg">
        <section className="border-b border-neutral-200 bg-bg pt-20 pb-10 md:pt-28 md:pb-14 dark:border-zinc-800">
          <div className="mx-auto max-w-3xl px-6">
            <nav aria-label="Breadcrumb" className="mb-4 text-xs text-text-tertiary">
              <Link href="/" className="hover:text-text-primary hover:underline">
                Início
              </Link>
              <span aria-hidden className="mx-2">
                ›
              </span>
              <span aria-current="page" className="text-text-primary">
                {title}
              </span>
            </nav>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              Documento legal
            </p>
            <h1 className="mt-3 font-serif text-4xl font-normal tracking-tight text-text-primary leading-[1.05] md:text-5xl">
              {title}
            </h1>
            <p className="mt-4 text-sm text-text-tertiary">
              Última atualização: {updatedAt}
            </p>
          </div>
        </section>

        <article className="mx-auto max-w-3xl px-6 py-14 md:py-20">
          <div className="prose-legal space-y-8 text-base leading-[1.65] text-text-secondary">
            {children}
          </div>
        </article>
      </main>
      <LandingFooter />
    </>
  );
}

export function Section({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-neutral-200 pt-8 first:border-t-0 first:pt-0 dark:border-zinc-800">
      <h2 className="text-xl font-semibold tracking-tight text-text-primary md:text-2xl">
        <span className="text-brand-600">{number}</span> {title}
      </h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function Definition({
  term,
  children,
}: {
  term: string;
  children: ReactNode;
}) {
  return (
    <p>
      <strong className="text-text-primary">{term}.</strong> {children}
    </p>
  );
}
