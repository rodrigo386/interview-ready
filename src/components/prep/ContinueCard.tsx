import Link from "next/link";

export function ContinueCard({
  title,
  body,
  href,
  ctaLabel,
}: {
  title: string;
  body: string;
  href: string;
  ctaLabel: string;
}) {
  return (
    <section
      aria-label="Próxima parada"
      className="rounded-xl border border-brand-600/30 bg-gradient-to-br from-brand-600/10 to-brand-600/0 p-6"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
        Sua próxima parada
      </p>
      <h2 className="mt-2 text-xl font-semibold text-text-primary">
        {title}
      </h2>
      <p className="mt-2 text-sm text-text-secondary">{body}</p>
      <Link
        href={href}
        className="mt-4 inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
      >
        {ctaLabel}
        <span aria-hidden>→</span>
      </Link>
    </section>
  );
}
